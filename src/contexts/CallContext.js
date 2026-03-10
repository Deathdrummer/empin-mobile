import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import RNNotificationCall from 'react-native-full-screen-notification-incoming-call';
import { useCall } from '../services/agora/useCall';

const CallContext = createContext(null);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [outgoingParticipant, setOutgoingParticipant] = useState(null);
  const [callTimeoutId, setCallTimeoutId] = useState(null);
  const [callEndReason, setCallEndReason] = useState(null); // null | 'rejected' | 'ended'

  const handledCallIdRef = useRef(null);
  const notifListenerRef = useRef(null);
  const notifResponseListenerRef = useRef(null);
  const handleEndCallRef = useRef(null);
  const handleAcceptCallRef = useRef(null);
  const handleRejectCallRef = useRef(null);
  // Refs для доступа к актуальным значениям в closure с [] deps
  const incomingCallDataRef = useRef(null);
  const callStateRef = useRef(null);
  const handlePushNotificationRef = useRef(null);
  // Флаг: пользователь уже принял звонок — предотвращает race condition
  // между answer event и 30s native timeout → endCall event
  const isAnsweringRef = useRef(false);

  const callState = useCall();

  // Синхронизируем refs для использования в closures с [] deps
  useEffect(() => { incomingCallDataRef.current = incomingCallData; }, [incomingCallData]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // Восстанавливаем данные звонка из AsyncStorage (background handler не имеет React state)
  useEffect(() => {
    AsyncStorage.getItem('@pendingCall').then(stored => {
      if (!stored) return;
      try {
        const callData = JSON.parse(stored);
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        handledCallIdRef.current = callData.callId;
        AsyncStorage.removeItem('@pendingCall');
      } catch {}
    });
  }, []);

  // Рингтон (foreground)
  const ringtonePlayer = useAudioPlayer(require('../../assets/ringtone.mp3'));

  const stopRingtone = useCallback(() => {
    try {
      ringtonePlayer.loop = false;
      ringtonePlayer.pause();
      ringtonePlayer.seekTo(0);
    } catch {}
  }, [ringtonePlayer]);

  /**
   * Воспроизведение рингтона при входящем звонке в foreground
   */
  useEffect(() => {
    const isIncomingRinging =
      callModalVisible &&
      incomingCallData !== null &&
      callState.status !== 'active' &&
      callState.status !== 'ended' &&
      callState.status !== 'error';

    if (isIncomingRinging) {
      ringtonePlayer.loop = true;
      ringtonePlayer.play();
    } else {
      stopRingtone();
    }
  }, [callModalVisible, incomingCallData, callState.status]);

  // Cleanup рингтона при unmount
  useEffect(() => {
    return () => stopRingtone();
  }, []);

  /**
   * Подписка на события нативного полноэкранного окна (RNNotificationCall)
   */
  useEffect(() => {
    RNNotificationCall.addEventListener('answer', async () => {
      isAnsweringRef.current = true;
      // backToApp() до hideNotification() — пока IncomingCallActivity видима,
      // Android 12+ разрешает запуск из фона (нет BAL restriction)
      RNNotificationCall.backToApp();
      RNNotificationCall.hideNotification();

      // Всегда читаем AsyncStorage первым — background handler там записывает актуальный callId.
      // incomingCallDataRef может содержать данные от предыдущего звонка (не успел сброситься).
      let callData = null;
      try {
        const stored = await AsyncStorage.getItem('@pendingCall');
        if (stored) {
          callData = JSON.parse(stored);
          await AsyncStorage.removeItem('@pendingCall');
          incomingCallDataRef.current = callData;
          setIncomingCallData(callData);
          handledCallIdRef.current = callData.callId;
        }
      } catch (e) { console.log('[CallCtx][answer] AsyncStorage error:', e); }

      // Fallback: foreground звонок (onMessage) — AsyncStorage не заполняется,
      // данные только в ref
      if (!callData) {
        callData = incomingCallDataRef.current;
      }

      console.log('[CallCtx][answer] callData:', JSON.stringify(callData), 'callStateRef:', callStateRef.current ? 'ok' : 'null');
      setCallModalVisible(true);

      if (callData?.callId) {
        console.log('[CallCtx][answer] calling acceptCall with callId:', callData.callId);
        await callStateRef.current?.acceptCall(callData.callId);
      } else {
        console.log('[CallCtx][answer] NO callId, acceptCall skipped');
      }
    });

    RNNotificationCall.addEventListener('endCall', async () => {
      // Race condition guard: если пользователь уже принял звонок (answer event
      // сработал одновременно с 30s native timeout) — не отклоняем
      if (isAnsweringRef.current) return;

      RNNotificationCall.hideNotification();

      // Когда app в background (телефон заблокирован), FCM обрабатывается
      // headless handler (setBackgroundMessageHandler), а не onMessage.
      // Поэтому incomingCallDataRef может быть null — читаем из AsyncStorage.
      let callId = incomingCallDataRef.current?.callId;

      if (!callId) {
        try {
          const stored = await AsyncStorage.getItem('@pendingCall');
          if (stored) {
            const callData = JSON.parse(stored);
            callId = callData.callId;
          }
        } catch (e) { console.log('[CallCtx][endCall] AsyncStorage error:', e); }
      }

      // Сбрасываем ref сразу — чтобы следующий answer event не получил устаревшие данные
      incomingCallDataRef.current = null;
      await AsyncStorage.removeItem('@pendingCall').catch(() => {});

      if (callId) {
        await callStateRef.current?.rejectCall(callId);
      }

      setCallModalVisible(false);
      setIncomingCallData(null);
    });

    return () => {
      RNNotificationCall.removeEventListener('answer');
      RNNotificationCall.removeEventListener('endCall');
    };
  }, []);

  /**
   * Обработка входящего push-уведомления
   */
  const handlePushNotification = useCallback((notification) => {
    const data = notification.request.content.data ?? {};

    if (data.type === 'incoming_call') {
      const callId = String(data.call_id);

      // Не обрабатываем повторно
      if (handledCallIdRef.current === callId) return;

      handledCallIdRef.current = callId;

      const callData = {
        callId,
        caller: {
          id: data.caller_id,
          sname: data.caller_name ?? 'Неизвестный',
          fname: '',
          mname: '',
        },
        callType: 'audio',
      };

        // Обновляем ref напрямую — не ждём useEffect, исключаем race condition
      incomingCallDataRef.current = callData;
      setIncomingCallData(callData);

      // onMessage срабатывает ТОЛЬКО когда приложение в foreground.
      // React доступен — показываем модал напрямую (полноэкранный красивый UI).
      // Для background/killed состояний → index.js background handler → displayNotification.
      setCallModalVisible(true);
      const timeoutId = setTimeout(() => {
        handleRejectCallRef.current?.();
      }, 30000);
      setCallTimeoutId(timeoutId);
    }

    if (data.type === 'call_cancelled') {
      const callId = String(data.call_id);
      // Используем ref для получения актуального callData без зависимости от closure
      const currentCallId = callStateRef.current?.callData?.callId;

      const isOurCall =
        (incomingCallData?.callId === callId) ||
        (currentCallId === callId);

      if (isOurCall) {
        RNNotificationCall.hideNotification();

        if (callModalVisible && callStateRef.current?.status === 'active') {
          handleEndCallRef.current?.();
        } else {
          setCallTimeoutId((prev) => { if (prev) clearTimeout(prev); return null; });
          // Сбрасываем таймер и Agora engine — без API вызова (бэкенд уже обработал)
          callStateRef.current?.resetToIdle?.();
          // Показываем "Звонок отклонён" 3 секунды, потом закрываем
          setCallEndReason('rejected');
          setTimeout(() => {
            setCallEndReason(null);
            setCallModalVisible(false);
            setIncomingCallData(null);
          }, 3000);
        }
      }
    }
  }, [callModalVisible, incomingCallData]);

  // Синхронизируем ref с актуальной версией handlePushNotification
  useEffect(() => {
    handlePushNotificationRef.current = handlePushNotification;
  }, [handlePushNotification]);

  /**
   * Подписка на уведомления (foreground + tap)
   * Firebase onMessage — для data-only FCM в foreground (expo-notifications их не перехватывает)
   * expo-notifications listener — резервный + обработка тапа по уведомлению
   * Подписка создаётся один раз, актуальный handler берётся через ref
   */
  useEffect(() => {
    // Firebase foreground handler (data-only FCM, modular API)
    // Expo Push API оборачивает наш data-объект в строку remoteMessage.data.body
    const unsubscribeFirebase = onMessage(getMessaging(), (remoteMessage) => {
      const raw = remoteMessage.data ?? {};
      let data = raw;
      try {
        if (raw.body) data = JSON.parse(raw.body);
      } catch {}
      handlePushNotificationRef.current?.({
        request: { content: { data } },
      });
    });

    // expo-notifications: тап по уведомлению (когда app в background и юзер тапнул)
    notifResponseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushNotificationRef.current?.(response.notification);
    });

    return () => {
      unsubscribeFirebase();
      notifResponseListenerRef.current?.remove();
    };
  }, []);

  /**
   * Обработка входящего звонка (foreground)
   */
  const handleIncomingCall = useCallback((callData) => {
    setIncomingCallData(callData);
    setCallModalVisible(true);

    const timeoutId = setTimeout(() => {
      handleRejectCallRef.current?.();
    }, 30000);

    setCallTimeoutId(timeoutId);
  }, []);

  /**
   * Инициация исходящего звонка
   */
  const initiateCall = useCallback(async (userId, userName, userAvatar) => {
    setOutgoingParticipant({ id: userId, name: userName, avatar: userAvatar });
    setCallModalVisible(true);
    await callState.initiateCall(userId, userName, userAvatar);
  }, [callState]);

  /**
   * Принятие звонка
   */
  const handleAcceptCall = useCallback(async () => {
    RNNotificationCall.hideNotification();

    if (callTimeoutId) {
      clearTimeout(callTimeoutId);
      setCallTimeoutId(null);
    }

    if (incomingCallData?.callId) {
      await callState.acceptCall(incomingCallData.callId);
    }
  }, [callState, callTimeoutId, incomingCallData]);

  /**
   * Отклонение звонка
   */
  const handleRejectCall = useCallback(async () => {
    RNNotificationCall.hideNotification();

    if (callTimeoutId) {
      clearTimeout(callTimeoutId);
      setCallTimeoutId(null);
    }

    if (incomingCallData?.callId) {
      await callState.rejectCall(incomingCallData.callId);
    }

    setCallModalVisible(false);
    setIncomingCallData(null);
  }, [callState, callTimeoutId, incomingCallData]);

  /**
   * Завершение звонка
   */
  const handleEndCall = useCallback(async () => {
    RNNotificationCall.hideNotification();

    if (callTimeoutId) {
      clearTimeout(callTimeoutId);
      setCallTimeoutId(null);
    }

    await callState.endCall();
    setCallModalVisible(false);
    setIncomingCallData(null);
  }, [callState, callTimeoutId]);

  // Синхронизируем refs с актуальными версиями обработчиков (избегаем stale closure в event listeners)
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  useEffect(() => {
    handleAcceptCallRef.current = handleAcceptCall;
  }, [handleAcceptCall]);

  useEffect(() => {
    handleRejectCallRef.current = handleRejectCall;
  }, [handleRejectCall]);

  // Сброс при закрытии модала
  useEffect(() => {
    if (!callModalVisible && !incomingCallData) {
      handledCallIdRef.current = null;
      isAnsweringRef.current = false;
      setOutgoingParticipant(null);
    }
  }, [callModalVisible, incomingCallData]);

  // Cleanup таймаута
  useEffect(() => {
    return () => {
      if (callTimeoutId) clearTimeout(callTimeoutId);
    };
  }, [callTimeoutId]);

  // Закрытие модала при завершении звонка
  useEffect(() => {
    if (callState.status === 'ended' || callState.status === 'no_answer' || callState.status === 'error') {
      const timer = setTimeout(() => {
        setCallModalVisible(false);
        setIncomingCallData(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [callState.status]);

  const value = {
    callState,
    callModalVisible,
    incomingCallData,
    outgoingParticipant,
    callEndReason,
    initiateCall,
    acceptCall: handleAcceptCall,
    rejectCall: handleRejectCall,
    endCall: handleEndCall,
    toggleMute: callState.toggleMute,
    toggleSpeaker: callState.toggleSpeaker,
    setCallModalVisible,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
