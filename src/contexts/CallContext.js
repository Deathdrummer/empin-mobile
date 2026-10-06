import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useCall } from '../services/agora/useCall';
import { subscribeToCalls, unsubscribeFromCalls } from '../services/pusher';
import {
  endIosSystemCall,
  startIosVoip,
} from '../services/iosVoip';

const createNoopIncomingCallModule = () => ({
  addEventListener: () => {},
  removeEventListener: () => {},
  backToApp: () => {},
  hideNotification: () => {},
});

const RNNotificationCall = Platform.OS === 'android'
  ? (() => {
      const incomingCallModule = require('react-native-full-screen-notification-incoming-call');
      return incomingCallModule.default ?? incomingCallModule;
    })()
  : createNoopIncomingCallModule();

const CallContext = createContext(null);

const getCallParticipant = (callData) => {
  const caller = callData?.caller ?? {};
  const name = [caller.sname, caller.fname, caller.mname]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: Number(caller.id) || 0,
    name: name || 'Неизвестный',
    avatar: caller.avatar,
  };
};

const getCallDataFromVoipEvent = (event) => ({
  callId: String(event.callId),
  caller: {
    id: event.callerId,
    sname: event.callerName ?? 'Неизвестный',
    fname: '',
    mname: '',
    avatar: event.callerAvatar,
  },
  callType: 'audio',
});

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children, isLoggedIn }) => {
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
  const isLoggedInRef = useRef(isLoggedIn);
  // Флаг: пользователь уже принял звонок — предотвращает race condition
  // между answer event и 30s native timeout → endCall event
  const isAnsweringRef = useRef(false);

  const [currentUserStaffId, setCurrentUserStaffId] = useState(null);

  const callState = useCall();

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // Загружаем staff_id текущего пользователя для WebSocket подписки
  useEffect(() => {
    let cancelled = false;

    if (!isLoggedIn) {
      setCurrentUserStaffId(null);
      return undefined;
    }

    AsyncStorage.getItem('user').then(raw => {
      if (cancelled) return;

      if (!raw) {
        setCurrentUserStaffId(null);
        return;
      }

      try {
        const user = JSON.parse(raw);
        setCurrentUserStaffId(user.staff_id ?? null);
      } catch {
        setCurrentUserStaffId(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // Синхронизируем refs для использования в closures с [] deps
  useEffect(() => { incomingCallDataRef.current = incomingCallData; }, [incomingCallData]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // WebSocket подписка на события звонков
  useEffect(() => {
    if (!currentUserStaffId) return;

    subscribeToCalls(currentUserStaffId, {
      onCallAccepted: (data) => {
        // Caller получает подтверждение: callee принял звонок — убираем ringing timeout
        console.log('[WS] Call accepted:', data.call_id);
        callStateRef.current?.clearRingingTimeout?.();
      },

      onCallRejected: (data) => {
        // Caller получает: callee отклонил
        console.log('[WS] Call rejected:', data.call_id);
        setCallTimeoutId(prev => { if (prev) clearTimeout(prev); return null; });
        callStateRef.current?.resetToIdle?.();
        setCallEndReason('rejected');
        setTimeout(() => {
          setCallEndReason(null);
          setCallModalVisible(false);
          setIncomingCallData(null);
        }, 3000);
      },

      onCallCancelled: (data) => {
        // Callee получает: caller отменил до ответа
        console.log('[WS] Call cancelled:', data.call_id);
        RNNotificationCall.hideNotification();
        endIosSystemCall(data.call_id, 'remoteEnded');
        setCallTimeoutId(prev => { if (prev) clearTimeout(prev); return null; });
        callStateRef.current?.resetToIdle?.();
        setCallEndReason('rejected');
        setTimeout(() => {
          setCallEndReason(null);
          setCallModalVisible(false);
          setIncomingCallData(null);
        }, 3000);
      },

      onCallEnded: (data) => {
        // Другой участник завершил активный звонок
        console.log('[WS] Call ended:', data.call_id);
        endIosSystemCall(data.call_id, 'remoteEnded');
        if (callStateRef.current?.status === 'active' || callStateRef.current?.status === 'ringing') {
          handleEndCallRef.current?.();
        }
      },
    });

    return () => {
      unsubscribeFromCalls(currentUserStaffId);
    };
  }, [currentUserStaffId]);

  // Восстанавливаем данные звонка из AsyncStorage (background handler не имеет React state)
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    let cancelled = false;
    AsyncStorage.getItem('@pendingCall').then(stored => {
      if (!stored || cancelled) return;
      try {
        const callData = JSON.parse(stored);
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        handledCallIdRef.current = callData.callId;
        AsyncStorage.removeItem('@pendingCall');
      } catch {}
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

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
      if (!isLoggedInRef.current) {
        RNNotificationCall.hideNotification();
        await AsyncStorage.removeItem('@pendingCall').catch(() => {});
        return;
      }

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
        await callStateRef.current?.acceptCall(callData.callId, getCallParticipant(callData));
      } else {
        console.log('[CallCtx][answer] NO callId, acceptCall skipped');
      }
    });

    RNNotificationCall.addEventListener('endCall', async () => {
      if (!isLoggedInRef.current) {
        RNNotificationCall.hideNotification();
        await AsyncStorage.removeItem('@pendingCall').catch(() => {});
        return;
      }

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
    if (!isLoggedIn) return;

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

    if (data.type === 'call_cancelled' || data.type === 'call_ended') {
      RNNotificationCall.hideNotification();
      endIosSystemCall(data.call_id, 'remoteEnded');
      setCallTimeoutId(previousTimeoutId => {
        if (previousTimeoutId) clearTimeout(previousTimeoutId);
        return null;
      });
      callStateRef.current?.resetToIdle?.();
      incomingCallDataRef.current = null;
      setIncomingCallData(null);
      setCallModalVisible(false);
      setCallEndReason(data.type === 'call_cancelled' ? 'rejected' : 'ended');
      setTimeout(() => setCallEndReason(null), 2000);
    }

  }, [isLoggedIn]);

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
    let unsubscribeFirebase = () => {};
    if (Platform.OS === 'android') {
      const { getMessaging, onMessage } = require('@react-native-firebase/messaging');
      unsubscribeFirebase = onMessage(getMessaging(), (remoteMessage) => {
        const raw = remoteMessage.data ?? {};
        let data = raw;
        try {
          if (raw.body) data = JSON.parse(raw.body);
        } catch {}
        handlePushNotificationRef.current?.({
          request: { content: { data } },
        });
      });
    }

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
   * PushKit/CallKit на iOS. Нативный модуль показывает системный экран звонка
   * ещё до запуска JavaScript, а сюда передаёт действия пользователя.
   */
  useEffect(() => {
    if (Platform.OS !== 'ios' || !isLoggedIn) return undefined;

    let disposed = false;
    let unsubscribe = () => {};

    const handleVoipCallEvent = async (event) => {
      if (disposed || !event?.callId) return;

      const callData = getCallDataFromVoipEvent(event);
      const participant = getCallParticipant(callData);

      if (event.type === 'incoming') {
        handledCallIdRef.current = callData.callId;
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        // CallKit уже показывает системный экран и воспроизводит рингтон.
        setCallModalVisible(false);
        return;
      }

      if (event.type === 'answer') {
        handledCallIdRef.current = callData.callId;
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        setCallModalVisible(true);
        await callStateRef.current?.acceptCall(callData.callId, participant);
        return;
      }

      if (event.type === 'end' && callStateRef.current?.status === 'active') {
        await callStateRef.current?.endCall();
      } else {
        await callStateRef.current?.rejectCall(callData.callId);
        callStateRef.current?.resetToIdle?.();
      }

      incomingCallDataRef.current = null;
      setIncomingCallData(null);
      setCallModalVisible(false);
      setCallEndReason(event.type === 'timeout' ? 'ended' : 'rejected');
      setTimeout(() => setCallEndReason(null), 2000);
    };

    startIosVoip(handleVoipCallEvent)
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unsubscribe = cleanup;
        }
      })
      .catch((error) => {
        console.warn('[VoIP] Не удалось запустить PushKit:', error?.message ?? error);
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [isLoggedIn]);

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
      await callState.acceptCall(
        incomingCallData.callId,
        getCallParticipant(incomingCallData)
      );
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
      await endIosSystemCall(incomingCallData.callId, 'declined');
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

    const callId = callState.callData?.callId ?? incomingCallData?.callId;
    await endIosSystemCall(callId, 'remoteEnded');
    await callState.endCall();
    setCallModalVisible(false);
    setIncomingCallData(null);
  }, [callState, callTimeoutId, incomingCallData]);

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
