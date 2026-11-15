import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, Vibration } from 'react-native';
import { requestRecordingPermissionsAsync, useAudioPlayer } from 'expo-audio';
import { useCall } from '../services/agora/useCall';
import { messengerAPI } from '../services/api';
import { setCallAudioActive } from '../services/callAudioState';
import { HOLD, incomingDuringCall, peerOnHoldFromDetails } from '../services/callHold';
import { incomingCallEvents, resolveNativeAnswer } from '../services/incomingCallEvents';
import { recordCallDiagnostic } from '../services/callDiagnostics';
import { CALL_CAUSES as C } from '../services/callDiagnosticFormat';
import EmpinCallService from '../../modules/empin-call-service';
import { subscribeToCalls, unsubscribeFromCalls } from '../services/pusher';
import { presentMessagePush } from '../services/messagePush';
import {
  endIosSystemCall,
  reportIosOutgoingConnected,
  setIosCallHeld,
  startIosOutgoingCall,
  startIosVoip,
} from '../services/iosVoip';

const IN_CALL = ['initiating', 'ringing', 'connecting', 'active'];
// Второй входящий во время разговора ждёт ответа столько же, сколько обычный
const WAITING_CALL_TIMEOUT_MS = 30000;
// iPhone: возврат к удержанному идёт через CallKit (событие unhold); не пришло — возвращаемся сами
const RESUME_FALLBACK_MS = 1500;

/** Собеседнику — «на удержании». Старый сервер (нет /hold) — удержание только у нас */
const notifyHold = (callId, onHold) => {
  messengerAPI.holdCall(callId, onHold).catch(() => {});
};

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

// Перезвон из журнала iPhone: насколько давнее нажатие ещё набирать
const REDIAL_MAX_AGE_MS = 30 * 1000;

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
  const handleMissedCallRef = useRef(null);
  // Refs для доступа к актуальным значениям в closure с [] deps
  const incomingCallDataRef = useRef(null);
  const callStateRef = useRef(null);
  const handlePushNotificationRef = useRef(null);
  const isLoggedInRef = useRef(isLoggedIn);
  // Флаг: пользователь уже принял звонок — предотвращает race condition
  // между answer event и 30s native timeout → endCall event
  const isAnsweringRef = useRef(false);
  // Звонок, показанный через CallKit: его нужно закрыть, если звонок оборвётся в приложении
  const iosSystemCallIdRef = useRef(null);
  const initiateCallRef = useRef(null);

  const [currentUserStaffId, setCurrentUserStaffId] = useState(null);

  const callState = useCall({ onHoldChange: notifyHold });

  // Второй входящий во время разговора: ждёт ответа («Удержать и ответить», «Завершить и ответить», «Отклонить»),
  // не затирая экран текущего звонка
  const [waitingCall, setWaitingCall] = useState(null);
  const waitingCallRef = useRef(null);
  const waitingTimeoutRef = useRef(null);
  // Удержанный звонок, из канала которого вышли ради второго: вернёмся к нему, когда второй закончится
  const [parkedCall, setParkedCall] = useState(null);
  const parkedCallRef = useRef(null);
  const resumingRef = useRef(false);
  // Идёт переход ко второму звонку: пауза без разговора — не повод возвращаться к удержанному
  const switchingRef = useRef(false);
  const answerWaitingCallRef = useRef(null);
  const resumeParkedCallRef = useRef(null);
  // Второй звонок, на который сейчас отвечаем: закрытие его системного окна — не отказ
  const answeringSecondIdRef = useRef(null);

  const updateWaitingCall = (call) => {
    waitingCallRef.current = call;
    setWaitingCall(call);
    if (!call) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  };
  const updateParkedCall = (call) => {
    parkedCallRef.current = call;
    setParkedCall(call);
  };
  const isWaitingCall = (callId) => callId != null && waitingCallRef.current != null
    && String(waitingCallRef.current.callId) === String(callId);
  const isParkedCall = (callId) => callId != null && parkedCallRef.current != null
    && String(parkedCallRef.current.callData.callId) === String(callId);

  /** Второй входящий ждёт ответа; не ответили за 30 секунд — у звонящего «нет ответа», у нас пропущенный */
  const presentWaitingCall = (callData) => {
    updateWaitingCall(callData);
    recordCallDiagnostic('waiting-call', { callId: callData.callId });
    // Android: свой экран звонка не звонит поверх разговора — короткая вибрация, как вторая линия
    if (Platform.OS === 'android') Vibration.vibrate([0, 300, 200, 300]);
    clearTimeout(waitingTimeoutRef.current);
    waitingTimeoutRef.current = setTimeout(() => {
      if (!isWaitingCall(callData.callId)) return;
      updateWaitingCall(null);
      incomingCallEvents.finish(callData.callId);
      endIosSystemCall(callData.callId, 'unanswered');
      messengerAPI.endCall(callData.callId, C.incomingTimeout).catch(() => {});
    }, WAITING_CALL_TIMEOUT_MS);
  };

  /** Ожидающий второй звонок закончился без ответа: отклонён здесь (reject) или не дождался (timeout) */
  const finishWaitingCall = (callId, how) => {
    if (!isWaitingCall(callId)) return false;
    updateWaitingCall(null);
    incomingCallEvents.finish(callId);
    if (how === 'reject') messengerAPI.rejectCall(callId, C.userReject).catch(() => {});
    if (how === 'timeout') messengerAPI.endCall(callId, C.incomingTimeout).catch(() => {});
    return true;
  };

  /** Удержанный звонок закончился (собеседник положил трубку) или его завершили здесь (end) */
  const finishParkedCall = (callId, how) => {
    if (!isParkedCall(callId)) return false;
    updateParkedCall(null);
    incomingCallEvents.finish(callId);
    endIosSystemCall(callId, 'remoteEnded');
    if (how === 'end') messengerAPI.endCall(callId, C.userHangup).catch(() => {});
    return true;
  };

  useEffect(() => {
    if (isLoggedIn) return;
    callStateRef.current?.resetToIdle?.(C.logout);
    incomingCallDataRef.current = null;
    setIncomingCallData(null);
    setCallModalVisible(false);
    // Второй и удержанный звонки прежнего пользователя — тоже
    updateWaitingCall(null);
    updateParkedCall(null);
  }, [isLoggedIn]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  /**
   * Событие относится к звонку, который сейчас на экране. Запоздавшее событие о прошлом звонке
   * (WebSocket, push) не должно сбрасывать новый звонок.
   */
  const isCurrentCall = (callId) => {
    const current = callStateRef.current;
    const ids = [current?.callData?.callId, incomingCallDataRef.current?.callId]
      .filter(Boolean)
      .map(String);
    // Исходящий ещё создаётся на сервере: событий о нём пока быть не может
    if (ids.length === 0) return current?.status !== 'initiating';
    return callId == null || ids.includes(String(callId));
  };

  /** Входящий ещё не принят: закрыть его экран без запроса к серверу (сервер уже знает) */
  const closeIncomingCall = (reason, cause = C.reset) => {
    recordCallDiagnostic('close-incoming', { callId: incomingCallDataRef.current?.callId, cause });
    incomingCallEvents.finish(incomingCallDataRef.current?.callId);
    RNNotificationCall.hideNotification();
    setCallTimeoutId(prev => { if (prev) clearTimeout(prev); return null; });
    callStateRef.current?.resetToIdle?.(cause);
    incomingCallDataRef.current = null;
    setIncomingCallData(null);
    setCallModalVisible(false);
    setCallEndReason(reason);
    setTimeout(() => setCallEndReason(null), 2000);
  };

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
        recordCallDiagnostic('ws-accepted', { callId: data.call_id });
        // Caller получает подтверждение: callee принял звонок — убираем ringing timeout
        console.log('[WS] Call accepted:', data.call_id);
        if (!isCurrentCall(data.call_id)) return;
        callStateRef.current?.markAccepted?.();
      },

      onCallRejected: (data) => {
        recordCallDiagnostic('ws-rejected', { callId: data.call_id });
        // Caller получает: callee отклонил
        console.log('[WS] Call rejected:', data.call_id);
        if (!isCurrentCall(data.call_id)) return;
        setCallTimeoutId(prev => { if (prev) clearTimeout(prev); return null; });
        callStateRef.current?.resetToIdle?.(C.remoteWs);
        setCallEndReason('rejected');
        setTimeout(() => {
          setCallEndReason(null);
          setCallModalVisible(false);
          setIncomingCallData(null);
        }, 3000);
      },

      onCallCancelled: (data) => {
        recordCallDiagnostic('ws-cancelled', { callId: data.call_id });
        incomingCallEvents.finish(data.call_id);
        // Callee получает: caller отменил до ответа
        console.log('[WS] Call cancelled:', data.call_id);
        endIosSystemCall(data.call_id, 'remoteEnded');
        // Отменил тот, кто ждал ответа во время нашего разговора
        if (finishWaitingCall(data.call_id)) return;
        if (!isCurrentCall(data.call_id)) return;
        closeIncomingCall('cancelled', C.remoteWs);
      },

      onCallEnded: (data) => {
        recordCallDiagnostic('ws-ended', { callId: data.call_id });
        incomingCallEvents.finish(data.call_id);
        // Другой участник завершил активный звонок
        console.log('[WS] Call ended:', data.call_id);
        endIosSystemCall(data.call_id, 'remoteEnded');
        // Положил трубку тот, кто ждал ответа, или собеседник удержанного звонка
        if (finishWaitingCall(data.call_id) || finishParkedCall(data.call_id)) return;
        if (!isCurrentCall(data.call_id)) return;
        if (['active', 'connecting', 'ringing'].includes(callStateRef.current?.status)) {
          handleEndCallRef.current?.(C.remoteWs);
        } else if (incomingCallDataRef.current) {
          // Звонящий положил трубку, пока у нас звонило (сервер шлёт call.ended, а не call.cancelled)
          closeIncomingCall('cancelled', C.remoteWs);
        }
      },

      onCallHeld: (data) => {
        recordCallDiagnostic(data.on_hold ? 'ws-held' : 'ws-unheld', { callId: data.call_id });
        // Собеседник удержал разговор (ему звонят по сотовой связи или он ответил на второй) или вернулся
        if (!isCurrentCall(data.call_id) || callStateRef.current?.callData?.callId == null) return;
        callStateRef.current?.setPeerOnHold?.(Boolean(data.on_hold));
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
        if (!incomingCallEvents.canPresent(callData.callId, callData.expiresAt)) {
          AsyncStorage.removeItem('@pendingCall');
          RNNotificationCall.hideNotification();
          return;
        }
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
  // keepAudioSessionActive: на iOS pause() в expo-audio иначе через 0.1 с делает
  // AVAudioSession.setActive(false) — это общая сессия приложения, и вместе с ней пропадал
  // звук разговора Agora (а в фоне iOS усыплял приложение, и звонок обрывался)
  const ringtonePlayer = useAudioPlayer(require('../../assets/ringtone.mp3'), {
    keepAudioSessionActive: true,
  });

  const stopRingtone = useCallback(() => {
    try {
      // Останавливаем только реально играющий рингтон: stopRingtone вызывается при каждой смене
      // статуса звонка, в том числе во время разговора
      if (!ringtonePlayer.playing) return;
      ringtonePlayer.loop = false;
      ringtonePlayer.pause();
      ringtonePlayer.seekTo(0);
    } catch {}
  }, [ringtonePlayer]);

  /**
   * Воспроизведение рингтона при входящем звонке в foreground
   */
  useEffect(() => {
    // Звонок через CallKit звонит системным рингтоном. Кроме того, после ответа CallKit забирает
    // аудиосессию: play() в expo-audio тогда бросает исключение, и необработанная ошибка в эффекте
    // роняла приложение на iPhone (журналы TestFlight 15.10, сборка 7).
    const isSystemCall = Platform.OS === 'ios' && iosSystemCallIdRef.current !== null;
    const isIncomingRinging =
      !isSystemCall &&
      callModalVisible &&
      incomingCallData !== null &&
      callState.status !== 'active' &&
      callState.status !== 'connecting' &&
      callState.status !== 'ended' &&
      callState.status !== 'error';

    if (isIncomingRinging) {
      try {
        ringtonePlayer.loop = true;
        ringtonePlayer.play();
      } catch (error) {
        console.warn('[Call] Не удалось включить рингтон:', error?.message ?? error);
      }
    } else {
      stopRingtone();
    }
  }, [callModalVisible, incomingCallData, callState.status]);

  // Пока идёт звонок, другие звуки приложения не трогают аудиосессию (см. callAudioState)
  useEffect(() => {
    setCallAudioActive(
      callState.status === 'initiating'
        || callState.status === 'ringing'
        || callState.status === 'connecting'
        || callState.status === 'active'
        || incomingCallData !== null
        || parkedCall !== null
    );
  }, [callState.status, incomingCallData, parkedCall]);

  // Android: служба переднего плана на время звонка. С Android 11 без неё свёрнутое приложение
  // или заблокированный экран теряют микрофон — собеседник перестаёт слышать.
  const callServiceStartedRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android' || !EmpinCallService) return;

    // Пока есть удержанный звонок, служба не останавливается: между разговорами (переход ко второму,
    // возврат к удержанному) свёрнутое приложение не смогло бы запустить её заново
    const inCall = IN_CALL.includes(callState.status) || parkedCall !== null;

    try {
      if (inCall && !callServiceStartedRef.current) {
        callServiceStartedRef.current = EmpinCallService.start('Звонок ЭМПИН');
      } else if (!inCall && callServiceStartedRef.current) {
        EmpinCallService.stop();
        callServiceStartedRef.current = false;
      }
    } catch (error) {
      console.warn('[Call] Служба звонка:', error?.message ?? error);
    }
  }, [callState.status, parkedCall]);

  // Cleanup рингтона при unmount
  useEffect(() => {
    return () => stopRingtone();
  }, []);

  /**
   * Подписка на события нативного полноэкранного окна (RNNotificationCall)
   */
  useEffect(() => {
    RNNotificationCall.addEventListener('answer', async (event) => {
      recordCallDiagnostic('answer-android', { callId: event?.callUUID, cause: C.answerAndroid });
      if (!isLoggedInRef.current) {
        RNNotificationCall.hideNotification();
        await AsyncStorage.removeItem('@pendingCall').catch(() => {});
        return;
      }

      // Второй звонок, пока идёт разговор: приложение было свёрнуто, push показал системное окно звонка.
      // «Ответить» — удержать текущий разговор и ответить, как в WhatsApp
      if (event?.callUUID && IN_CALL.includes(callStateRef.current?.status) && !isCurrentCall(event.callUUID)) {
        const id = String(event.callUUID);
        if (!isWaitingCall(id)) {
          let stored = null;
          try {
            const raw = await AsyncStorage.getItem('@pendingCall');
            stored = raw ? JSON.parse(raw) : null;
          } catch {}
          const decision = incomingDuringCall({
            status: callStateRef.current?.status,
            waitingCallId: waitingCallRef.current?.callId,
            parkedCallId: parkedCallRef.current?.callData.callId,
            callId: id,
          });
          if (String(stored?.callId) !== id || !incomingCallEvents.canPresent(id, stored?.expiresAt) || decision !== 'waiting') {
            RNNotificationCall.hideNotification();
            if (decision === 'busy') messengerAPI.rejectCall(id, C.busy).catch(() => {});
            return;
          }
          presentWaitingCall(stored);
        }
        await AsyncStorage.removeItem('@pendingCall').catch(() => {});
        RNNotificationCall.backToApp();
        await answerWaitingCallRef.current?.({ keepCurrent: true });
        return;
      }
      isAnsweringRef.current = true;
      // backToApp() до hideNotification() — пока IncomingCallActivity видима,
      // Android 12+ разрешает запуск из фона (нет BAL restriction)
      RNNotificationCall.backToApp();
      RNNotificationCall.hideNotification();

      // Всегда читаем AsyncStorage первым — background handler там записывает актуальный callId.
      // incomingCallDataRef может содержать данные от предыдущего звонка (не успел сброситься).
      let storedCall = null;
      try {
        const stored = await AsyncStorage.getItem('@pendingCall');
        if (stored) storedCall = JSON.parse(stored);
      } catch (e) { console.log('[CallCtx][answer] AsyncStorage error:', e); }
      if (event?.callUUID && ['initiating', 'ringing', 'connecting', 'active'].includes(callStateRef.current?.status)
        && !isCurrentCall(event.callUUID)) return;
      const callData = resolveNativeAnswer(event?.callUUID, storedCall, incomingCallDataRef.current, incomingCallEvents.canPresent);
      if (!callData || !incomingCallEvents.canPresent(callData.callId, callData.expiresAt)) {
        recordCallDiagnostic('answer-missing-or-stale', { callId: event?.callUUID, cause: C.answerAndroid });
        isAnsweringRef.current = false;
        return;
      }
      if (storedCall?.callId === callData.callId) await AsyncStorage.removeItem('@pendingCall');
      if (!callData.caller) recordCallDiagnostic('answer-recovered-from-native-id', { callId: callData.callId, cause: C.answerAndroid });
      incomingCallDataRef.current = callData;
      setIncomingCallData(callData);
      handledCallIdRef.current = callData.callId;

      console.log('[CallCtx][answer] callData:', JSON.stringify(callData), 'callStateRef:', callStateRef.current ? 'ok' : 'null');
      setCallModalVisible(true);

      if (callData?.callId) {
        console.log('[CallCtx][answer] calling acceptCall with callId:', callData.callId);
        await callStateRef.current?.acceptCall(callData.callId, getCallParticipant(callData));
      } else {
        console.log('[CallCtx][answer] NO callId, acceptCall skipped');
      }
    });

    RNNotificationCall.addEventListener('endCall', async (event) => {
      recordCallDiagnostic('android-end-event', { callId: event?.callUUID, cause: C.androidEnd });
      if (!isLoggedInRef.current) {
        RNNotificationCall.hideNotification();
        await AsyncStorage.removeItem('@pendingCall').catch(() => {});
        return;
      }

      // Второй звонок, пока идёт разговор: его отклонили в системном окне или окно закрылось само
      const secondId = event?.callUUID != null ? String(event.callUUID) : null;
      if (secondId && secondId !== answeringSecondIdRef.current && !isCurrentCall(secondId)
        && (isWaitingCall(secondId) || IN_CALL.includes(callStateRef.current?.status))) {
        RNNotificationCall.hideNotification();
        const how = event?.endAction === 'ACTION_HIDE_CALL' ? 'timeout' : 'reject';
        if (!finishWaitingCall(secondId, how)) {
          incomingCallEvents.finish(secondId);
          if (how === 'timeout') messengerAPI.endCall(secondId, C.incomingTimeout).catch(() => {});
          else messengerAPI.rejectCall(secondId, C.androidEnd).catch(() => {});
        }
        try {
          const raw = await AsyncStorage.getItem('@pendingCall');
          if (raw && String(JSON.parse(raw).callId) === secondId) await AsyncStorage.removeItem('@pendingCall');
        } catch {}
        return;
      }

      // Race condition guard: если пользователь уже принял звонок (answer event
      // сработал одновременно с 30s native timeout) — не отклоняем
      if (isAnsweringRef.current) return;
      if (event?.callUUID && !isCurrentCall(event.callUUID)) return;

      RNNotificationCall.hideNotification();

      // Когда app в background (телефон заблокирован), FCM обрабатывается
      // headless handler (setBackgroundMessageHandler), а не onMessage.
      // Поэтому incomingCallDataRef может быть null — читаем из AsyncStorage.
      let callId = event?.callUUID ?? incomingCallDataRef.current?.callId;

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
      if (callId && !isCurrentCall(callId)) return;
      incomingCallEvents.finish(callId);
      incomingCallDataRef.current = null;
      await AsyncStorage.removeItem('@pendingCall').catch(() => {});

      if (callId) {
        if (event?.endAction === 'ACTION_HIDE_CALL') {
          // Окно закрылось само по тайм-ауту: на сервере звонок станет пропущенным, а не отклонённым
          messengerAPI.endCall(callId, C.incomingTimeout).catch(() => {});
          callStateRef.current?.resetToIdle?.(C.incomingTimeout);
        } else {
          await callStateRef.current?.rejectCall(callId, C.androidEnd);
        }
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
      if (!incomingCallEvents.canPresent(callId, data.expires_at)) return;

      // Не обрабатываем повторно
      if (handledCallIdRef.current === callId) return;

      // Уже идёт разговор: второй ждёт ответа («Удержать и ответить», «Завершить и ответить», «Отклонить»),
      // не затирая экран текущего. Набираем номер сами, уже ждёт другой или есть удержанный — «занято»
      const decision = incomingDuringCall({
        status: callStateRef.current?.status,
        waitingCallId: waitingCallRef.current?.callId,
        parkedCallId: parkedCallRef.current?.callData.callId,
        callId,
      });
      if (decision === 'duplicate') return;
      if (decision === 'busy') {
        messengerAPI.rejectCall(callId, C.busy).catch(() => {});
        return;
      }
      if (decision === 'waiting') {
        presentWaitingCall({
          callId,
          caller: { id: data.caller_id, sname: data.caller_name ?? 'Неизвестный', fname: '', mname: '' },
          callType: 'audio',
          expiresAt: data.expires_at,
        });
        return;
      }

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
        expiresAt: data.expires_at,
      };

        // Обновляем ref напрямую — не ждём useEffect, исключаем race condition
      incomingCallDataRef.current = callData;
      setIncomingCallData(callData);

      // onMessage срабатывает ТОЛЬКО когда приложение в foreground.
      // React доступен — показываем модал напрямую (полноэкранный красивый UI).
      // Для background/killed состояний → index.js background handler → displayNotification.
      setCallModalVisible(true);
      const timeoutId = setTimeout(() => {
        if (incomingCallDataRef.current?.callId === callId && !isAnsweringRef.current) {
          handleMissedCallRef.current?.();
        }
      }, 30000);
      setCallTimeoutId(timeoutId);
    }

    if (data.type === 'call_cancelled' || data.type === 'call_ended') {
      recordCallDiagnostic('push-ended', { callId: data.call_id, cause: C.remotePush });
      incomingCallEvents.finish(data.call_id);
      endIosSystemCall(data.call_id, 'remoteEnded');
      if (finishWaitingCall(data.call_id) || finishParkedCall(data.call_id)) return;
      // Push о прошлом звонке, пришедший с опозданием, не трогает текущий
      if (!isCurrentCall(data.call_id)) return;
      closeIncomingCall(data.type === 'call_cancelled' ? 'cancelled' : 'ended', C.remotePush);
    }

    if (data.type === 'call_accepted' && isCurrentCall(data.call_id)) {
      callStateRef.current?.markAccepted?.();
    }

    if (data.type === 'call_answered_elsewhere' && isCurrentCall(data.call_id)
      && incomingCallDataRef.current && !['connecting', 'active'].includes(callStateRef.current?.status)) {
      closeIncomingCall('answeredElsewhere', C.remotePush);
    }

  }, [isLoggedIn]);

  // В foreground восстанавливаем входящий даже после пропущенного push/переподключения.
  // Из фона iOS будит PushKit; опрос в фоне не запускается.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let stopped = false;
    let timer;
    let pending = false;
    const poll = async () => {
      if (stopped || pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const response = await messengerAPI.getPendingCall();
        const call = response?.call;
        if (!stopped && call?.id && !incomingCallDataRef.current) {
          handlePushNotificationRef.current?.({ request: { content: { data: {
            type: 'incoming_call', call_id: call.id, caller_id: call.caller?.id,
            caller_name: [call.caller?.sname, call.caller?.fname].filter(Boolean).join(' '),
          } } } });
        }
      } catch { /* Сеть восстановится — следующий foreground-опрос повторится. */ }
      finally { pending = false; if (!stopped) timer = setTimeout(poll, 6000); }
    };
    poll();
    const foreground = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') poll();
    });
    return () => { stopped = true; clearTimeout(timer); foreground.remove(); };
  }, [isLoggedIn]);

  // Подтверждение ответа/завершения через API — страховка от потери WebSocket или push.
  const syncingCallId = callState.callData?.callId ?? incomingCallData?.callId;
  useEffect(() => {
    if (!isLoggedIn || !syncingCallId) return undefined;
    let stopped = false;
    let timer;
    let pending = false;
    const sync = async () => {
      if (stopped || pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const response = await messengerAPI.getCallDetails(syncingCallId);
        if (stopped || !isCurrentCall(syncingCallId)) return;
        const call = response?.call;
        // Удержание собеседника — запасной путь, если событие call.held не дошло (старый сервер не сообщает)
        if (response?.hold && call?.status === 'active' && callStateRef.current?.status === 'active') {
          callStateRef.current?.setPeerOnHold?.(peerOnHoldFromDetails(response));
        }
        if (call?.status === 'active' && callStateRef.current?.callData?.isIncoming === false) {
          callStateRef.current?.markAccepted?.();
        } else if (call?.status === 'active' && incomingCallDataRef.current
          && !['connecting', 'active'].includes(callStateRef.current?.status)) {
          endIosSystemCall(syncingCallId, 'remoteEnded');
          closeIncomingCall('answeredElsewhere', C.apiState);
        } else if (['completed', 'cancelled', 'rejected', 'missed'].includes(call?.status)) {
          incomingCallEvents.finish(syncingCallId);
          endIosSystemCall(syncingCallId, 'remoteEnded');
          closeIncomingCall('ended', C.apiState);
        }
      } catch (error) {
        if (!stopped && error?.response?.status === 404 && isCurrentCall(syncingCallId)) {
          endIosSystemCall(syncingCallId, 'remoteEnded');
          closeIncomingCall('ended', C.apiState);
        }
        // При временном сбое HTTP голосовой канал продолжает работать.
      } finally {
        pending = false;
        if (!stopped) { clearTimeout(timer); timer = setTimeout(sync, 3000); }
      }
    };
    sync();
    const foreground = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') sync();
    });
    return () => { stopped = true; clearTimeout(timer); foreground.remove(); };
  }, [isLoggedIn, syncingCallId, callState.status]);

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
        // Сообщение: показываем уведомление (из открытого чата его скроет обработчик уведомлений)
        if (data?.type === 'message' && isLoggedInRef.current) {
          presentMessagePush(raw, data).catch(() => {});
          return;
        }
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

      if (event.type === 'redial') {
        // Нажали звонок приложения в журнале «Недавние» iPhone — набираем сотрудника, если сейчас нет звонка.
        // Нажатие старше 30 с (например, пришлось сначала войти в аккаунт) не набираем — это было бы неожиданно
        const staffId = Number(event.callerId);
        const status = callStateRef.current?.status;
        const fresh = Date.now() - event.createdAt < REDIAL_MAX_AGE_MS;
        if (staffId && fresh && (!status || status === 'idle')) {
          initiateCallRef.current?.(staffId, event.callerName || 'Сотрудник');
        }
        return;
      }

      // Удержание из CallKit: «Удержать и ответить» на звонок по сотовой связи, из другого мессенджера или
      // на наш второй, кнопка на системном экране, переключение между двумя звонками
      if (event.type === 'hold' || event.type === 'unhold') {
        const onHold = event.type === 'hold';
        if (isParkedCall(event.callId)) {
          // Вернуться к удержанному (второй закончился или переключились) — войти в его канал снова
          if (!onHold) await resumeParkedCallRef.current?.();
          return;
        }
        if (String(callStateRef.current?.callData?.callId) === String(event.callId)) {
          callStateRef.current?.setHold?.(HOLD.system, onHold);
        }
        return;
      }

      if (event.type === 'audioActivated') {
        callStateRef.current?.restartAudioAfterHold?.();
        return;
      }

      const callData = getCallDataFromVoipEvent(event);
      const participant = getCallParticipant(callData);

      if (event.type === 'busy') {
        // Второй входящий во время другого звонка: CallKit его уже закрыл, сообщаем серверу отказ.
        // Текущий звонок и экран не трогаем.
        messengerAPI.rejectCall(callData.callId, C.busy).catch(() => {});
        return;
      }

      if (event.type === 'incoming') {
        if (!incomingCallEvents.canPresent(callData.callId)) {
          await endIosSystemCall(callData.callId, 'remoteEnded');
          return;
        }
        // Уже идёт разговор: CallKit сам покажет «Удержать и ответить», «Завершить и ответить», «Отклонить»,
        // а экран текущего звонка не трогаем. Набираем номер сами или есть удержанный — «занято»
        const decision = incomingDuringCall({
          status: callStateRef.current?.status,
          waitingCallId: waitingCallRef.current?.callId,
          parkedCallId: parkedCallRef.current?.callData.callId,
          callId: callData.callId,
        });
        if (decision === 'duplicate') return;
        if (decision === 'busy') {
          await endIosSystemCall(callData.callId, 'declined');
          messengerAPI.rejectCall(callData.callId, C.busy).catch(() => {});
          return;
        }
        if (decision === 'waiting') {
          presentWaitingCall(callData);
          return;
        }
        iosSystemCallIdRef.current = callData.callId;
        handledCallIdRef.current = callData.callId;
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        // CallKit уже показывает системный экран и воспроизводит рингтон.
        setCallModalVisible(false);
        // Проверяем и в фоне: foreground-опрос здесь может ещё не работать.
        // PushKit обязан сразу отчитаться CallKit, но законченный вызов сразу закрываем.
        try {
          const response = await messengerAPI.getCallDetails(callData.callId);
          if (disposed || !isCurrentCall(callData.callId)) return;
          const status = callStateRef.current?.status;
          const finished = ['completed', 'cancelled', 'rejected', 'missed'].includes(response?.call?.status);
          const answeredElsewhere = response?.call?.status === 'active' && !['connecting', 'active'].includes(status);
          if (finished || answeredElsewhere) {
            incomingCallEvents.finish(callData.callId);
            await endIosSystemCall(callData.callId, 'remoteEnded');
            if (isCurrentCall(callData.callId)) closeIncomingCall('ended', C.apiState);
          }
        } catch (error) {
          if (!disposed && error?.response?.status === 404 && isCurrentCall(callData.callId)) {
            incomingCallEvents.finish(callData.callId);
            await endIosSystemCall(callData.callId, 'remoteEnded');
            if (isCurrentCall(callData.callId)) closeIncomingCall('ended', C.apiState);
          }
        }
        return;
      }

      if (event.type === 'answer') {
        if (!incomingCallEvents.canPresent(callData.callId)) {
          await endIosSystemCall(callData.callId, 'remoteEnded');
          return;
        }
        // Ответ на второй: «Удержать и ответить» — CallKit уже удержал текущий (событие hold),
        // «Завершить и ответить» — уже завершил его (событие end). Удерживаем, если он ещё идёт
        if (isWaitingCall(callData.callId)) {
          await answerWaitingCallRef.current?.({ keepCurrent: true });
          return;
        }
        iosSystemCallIdRef.current = callData.callId;
        handledCallIdRef.current = callData.callId;
        incomingCallDataRef.current = callData;
        setIncomingCallData(callData);
        setCallModalVisible(true);
        const accepted = await callStateRef.current?.acceptCall(callData.callId, participant);
        if (!accepted) {
          // Звонящий успел отменить, нет сети или доступа к микрофону — убираем «идущий» системный звонок
          iosSystemCallIdRef.current = null;
          await endIosSystemCall(callData.callId, 'failed');
        }
        return;
      }

      incomingCallEvents.finish(callData.callId);
      // Второй, ждавший ответа: отклонили на системном экране, не дождался или отменил звонящий
      if (isWaitingCall(callData.callId)) {
        const how = event.type === 'reject' || event.type === 'end' ? 'reject' : event.type === 'timeout' ? 'timeout' : null;
        finishWaitingCall(callData.callId, how);
        return;
      }
      // Удержанный: завершили на системном экране или собеседник положил трубку
      if (isParkedCall(callData.callId)) {
        finishParkedCall(callData.callId, event.type === 'end' || event.type === 'reject' ? 'end' : null);
        return;
      }
      // Завершение старого CallKit-вызова не должно сбрасывать новый разговор.
      if (!isCurrentCall(callData.callId)) return;
      iosSystemCallIdRef.current = null;

      if (event.type === 'remoteEnded' || event.type === 'answeredElsewhere') {
        // Сервер уже знает о завершении — только сбрасываем экран
        callStateRef.current?.resetToIdle?.(C.callkitEnd);
      } else if (event.type === 'timeout') {
        // Не ответили: на сервере звонок станет пропущенным, а не отклонённым
        await messengerAPI.endCall(callData.callId, C.callkitTimeout).catch(() => {});
        callStateRef.current?.resetToIdle?.(C.callkitTimeout);
      } else if (event.type === 'end' && (['active', 'connecting'].includes(callStateRef.current?.status) || callStateRef.current?.callData?.isIncoming === false)) {
        // Разговор или наш исходящий завершили с системного экрана (плашка звонка, экран блокировки)
        await callStateRef.current?.endCall(C.callkitEnd);
      } else {
        await callStateRef.current?.rejectCall(callData.callId, C.callkitEnd);
        callStateRef.current?.resetToIdle?.(C.callkitEnd);
      }

      incomingCallDataRef.current = null;
      setIncomingCallData(null);
      setCallModalVisible(false);
      setCallEndReason(event.type === 'timeout' ? 'ended' : 'rejected');
      setTimeout(() => setCallEndReason(null), 2000);
    };

    // Разрешение на микрофон спрашиваем заранее: при ответе с заблокированного экрана iOS не покажет запрос
    requestRecordingPermissionsAsync().catch(() => {});

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
  /**
   * Инициация исходящего звонка
   */
  const initiateCall = useCallback(async (userId, userName, userAvatar) => {
    // Хвосты прошлого звонка (восстановленный входящий, «отклонён») не должны попасть на экран нового:
    // имя чужого собеседника, кнопки входящего или экран без кнопок
    incomingCallDataRef.current = null;
    setIncomingCallData(null);
    setCallEndReason(null);
    setOutgoingParticipant({ id: userId, name: userName, avatar: userAvatar });
    setCallModalVisible(true);
    await callState.initiateCall(userId, userName, userAvatar);
  }, [callState]);
  // Для событий CallKit (перезвон из журнала): обработчик создаётся один раз, функция — всегда свежая
  initiateCallRef.current = initiateCall;

  /**
   * Принятие звонка
   */
  const handleAcceptCall = useCallback(async () => {
    recordCallDiagnostic('answer-ui', { callId: incomingCallData?.callId, cause: C.answerUi });
    isAnsweringRef.current = true;
    RNNotificationCall.hideNotification();
    stopRingtone();

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

    // Экран закрывается в любом случае: кроме этой кнопки выхода с него нет
    try {
      if (incomingCallData?.callId) {
        incomingCallEvents.finish(incomingCallData.callId);
        endIosSystemCall(incomingCallData.callId, 'declined');
        await callState.rejectCall(incomingCallData.callId, C.userReject);
      }
    } finally {
      setCallModalVisible(false);
      setIncomingCallData(null);
    }
  }, [callState, callTimeoutId, incomingCallData]);

  /**
   * Входящий не приняли за 30 секунд: на сервере он станет пропущенным (end от вызываемого),
   * а звонящий получит call.ended
   */
  const handleMissedCall = useCallback(async () => {
    RNNotificationCall.hideNotification();
    setCallTimeoutId(null);

    const callId = incomingCallData?.callId;
    if (callId) {
      incomingCallEvents.finish(callId);
      await endIosSystemCall(callId, 'unanswered');
      messengerAPI.endCall(callId, C.incomingTimeout).catch(() => {});
    }
    callState.resetToIdle(C.incomingTimeout);
    setCallModalVisible(false);
    setIncomingCallData(null);
  }, [callState, incomingCallData]);

  /**
   * Завершение звонка
   */
  const handleEndCall = useCallback(async (cause = C.userHangup) => {
    const endCause = Number.isInteger(cause) ? cause : C.userHangup;
    incomingCallEvents.finish(callState.callData?.callId ?? incomingCallData?.callId);
    RNNotificationCall.hideNotification();

    if (callTimeoutId) {
      clearTimeout(callTimeoutId);
      setCallTimeoutId(null);
    }

    // Экран закрывается в любом случае и не ждёт системный звонок: кроме этой кнопки выхода с него нет
    try {
      endIosSystemCall(callState.callData?.callId ?? incomingCallData?.callId, 'remoteEnded');
      await callState.endCall(endCause);
    } finally {
      setCallModalVisible(false);
      setIncomingCallData(null);
    }
  }, [callState, callTimeoutId, incomingCallData]);

  /**
   * Ответ на второй звонок во время разговора. keepCurrent — «Удержать и ответить»: сервер отмечает удержание
   * (собеседник увидит «на удержании» и не завершит разговор, когда мы выйдем из канала), затем выходим из канала
   * текущего и отвечаем. Иначе («Завершить и ответить» или сервер без удержания) текущий завершается
   */
  const answerWaitingCall = async ({ keepCurrent }) => {
    const waiting = waitingCallRef.current;
    if (!waiting) return;
    updateWaitingCall(null);
    switchingRef.current = true;
    answeringSecondIdRef.current = String(waiting.callId);
    RNNotificationCall.hideNotification();
    stopRingtone();
    setCallEndReason(null);
    try {
      const current = callStateRef.current;
      const currentId = current?.callData?.callId;
      if (currentId && ['active', 'connecting'].includes(current.status)) {
        let parked = null;
        if (keepCurrent) {
          try {
            await messengerAPI.holdCall(currentId, true, C.holdSecondCall);
            parked = callStateRef.current?.park?.() ?? null;
          } catch (error) {
            recordCallDiagnostic('hold-failed', { callId: currentId, status: error?.response?.status ?? 0 });
          }
        }
        if (parked) {
          updateParkedCall(parked);
        } else {
          // Без состояния «завершён»: его обработчик закрыл бы в CallKit уже второй звонок
          iosSystemCallIdRef.current = null;
          endIosSystemCall(currentId, 'remoteEnded');
          messengerAPI.endCall(currentId, C.endAndAnswer).catch(() => {});
          callStateRef.current?.resetToIdle?.(C.endAndAnswer);
        }
      }
      // Второй — как обычный входящий: экран звонка показывает его
      handledCallIdRef.current = waiting.callId;
      isAnsweringRef.current = true;
      incomingCallDataRef.current = waiting;
      setIncomingCallData(waiting);
      setCallModalVisible(true);
      const accepted = await callStateRef.current?.acceptCall(waiting.callId, getCallParticipant(waiting));
      // Системный звонок CallKit, который закрывается вместе с этим разговором, — только когда он принят:
      // раньше обработчик окончания прежнего разговора мог закрыть его вместо прежнего
      if (Platform.OS === 'ios') {
        if (accepted) iosSystemCallIdRef.current = waiting.callId;
        else await endIosSystemCall(waiting.callId, 'failed');
      }
    } finally {
      switchingRef.current = false;
      answeringSecondIdRef.current = null;
    }
    // Второй не соединился — сразу назад к удержанному
    if (parkedCallRef.current && !IN_CALL.includes(callStateRef.current?.status)) requestResumeParkedCall();
  };

  /** Кнопка «Отклонить» у второго звонка (Android; на iPhone — системный экран CallKit) */
  const rejectWaitingCall = () => {
    const waiting = waitingCallRef.current;
    if (!waiting) return;
    RNNotificationCall.hideNotification();
    endIosSystemCall(waiting.callId, 'declined');
    finishWaitingCall(waiting.callId, 'reject');
  };

  /**
   * Вернуться к удержанному звонку: снять удержание на сервере (он отдаёт новый токен канала) и войти в канал.
   * Если сейчас идёт другой разговор (переключение на iPhone), он сам встаёт на удержание
   */
  const resumeParkedCall = async () => {
    const parked = parkedCallRef.current;
    if (!parked || resumingRef.current) return;
    resumingRef.current = true;
    const parkedId = parked.callData.callId;
    let nextParked = null;
    try {
      const current = callStateRef.current;
      const currentId = current?.callData?.callId;
      if (currentId && IN_CALL.includes(current.status)) {
        try {
          await messengerAPI.holdCall(currentId, true, C.holdSecondCall);
          nextParked = callStateRef.current?.park?.() ?? null;
        } catch {
          // Текущий удержать не удалось — остаёмся в нём, к удержанному вернёмся, когда он закончится
          return;
        }
      }
      const response = await messengerAPI.holdCall(parkedId, false, C.resumeHeld);
      updateParkedCall(nextParked);
      // Экран берёт собеседника из звонка, а не из прежнего входящего
      incomingCallDataRef.current = null;
      setIncomingCallData(null);
      setCallEndReason(null);
      setCallModalVisible(true);
      const resumed = await callStateRef.current?.resume?.(parked, {
        appId: response.agora_app_id,
        token: response.token,
        channelName: response.channel_name,
        uid: response.uid,
        peerOnHold: Boolean(response.hold?.peer),
      });
      // Как и при ответе: системный звонок привязываем к разговору, только когда вернулись в канал
      if (Platform.OS === 'ios') {
        if (resumed) iosSystemCallIdRef.current = parkedId;
        else endIosSystemCall(parkedId, 'failed');
      }
    } catch (error) {
      // Удержанный уже завершён (собеседник положил трубку) или сервер недоступен — закрываем его
      recordCallDiagnostic('resume-failed', { callId: parkedId, status: error?.response?.status ?? 0, cause: C.resumeHeld });
      if (isParkedCall(parkedId)) updateParkedCall(nextParked);
      incomingCallEvents.finish(parkedId);
      endIosSystemCall(parkedId, 'remoteEnded');
      if (![404, 422].includes(error?.response?.status)) messengerAPI.endCall(parkedId, C.resumeHeld).catch(() => {});
    } finally {
      resumingRef.current = false;
    }
  };

  /** Удержанный — обратно. iPhone: через CallKit, чтобы системный экран знал, какой звонок идёт */
  const resumeFallbackRef = useRef(null);
  const requestResumeParkedCall = () => {
    const parked = parkedCallRef.current;
    if (!parked) return;
    if (Platform.OS !== 'ios') {
      resumeParkedCall();
      return;
    }
    setIosCallHeld(parked.callData.callId, false);
    clearTimeout(resumeFallbackRef.current);
    resumeFallbackRef.current = setTimeout(() => {
      if (parkedCallRef.current === parked && !IN_CALL.includes(callStateRef.current?.status)) resumeParkedCallRef.current?.();
    }, RESUME_FALLBACK_MS);
  };

  /** Завершить удержанный звонок, не трогая текущий */
  const endParkedCall = () => {
    const parked = parkedCallRef.current;
    if (parked) finishParkedCall(parked.callData.callId, 'end');
  };

  /** iPhone: продолжить разговор, удержанный системой (звонок по сотовой связи уже закончился) */
  const resumeFromHold = () => {
    setIosCallHeld(callState.callData?.callId, false);
  };

  answerWaitingCallRef.current = answerWaitingCall;
  resumeParkedCallRef.current = resumeParkedCall;

  // Разговор закончился, а удержанный ждёт — возвращаемся к нему, как в WhatsApp
  useEffect(() => {
    if (!parkedCall || switchingRef.current || waitingCallRef.current) return;
    if (IN_CALL.includes(callState.status)) return;
    requestResumeParkedCall();
  }, [callState.status, parkedCall]);

  useEffect(() => () => clearTimeout(resumeFallbackRef.current), []);

  // Android: разговор закончился раньше, чем ответили на второй, — второй звонит как обычный входящий
  // (кнопки ожидания были на экране разговора, а он закрылся). Ждём «idle»: при «завершён» экран ещё
  // закрывается сам и унёс бы с собой входящий. iPhone: CallKit сам показывает его как обычный входящий
  useEffect(() => {
    if (Platform.OS === 'ios' || !waitingCall || callState.status !== 'idle') return;
    if (switchingRef.current || parkedCallRef.current) return;
    const waiting = waitingCallRef.current;
    updateWaitingCall(null);
    handledCallIdRef.current = null;
    handlePushNotificationRef.current?.({ request: { content: { data: {
      type: 'incoming_call',
      call_id: waiting.callId,
      caller_id: waiting.caller?.id,
      caller_name: waiting.caller?.sname,
      expires_at: waiting.expiresAt,
    } } } });
  }, [callState.status, waitingCall]);

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

  useEffect(() => {
    handleMissedCallRef.current = handleMissedCall;
  }, [handleMissedCall]);

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

  // Звонок оборвался в приложении (собеседник пропал из канала, ошибка соединения) —
  // системный экран CallKit не должен оставаться «идущим»
  useEffect(() => {
    const isTerminal = callState.status === 'ended'
      || callState.status === 'no_answer'
      || callState.status === 'error';

    if (isTerminal && iosSystemCallIdRef.current) {
      const reason = { error: 'failed', no_answer: 'unanswered' }[callState.status] ?? 'remoteEnded';
      endIosSystemCall(iosSystemCallIdRef.current, reason);
      iosSystemCallIdRef.current = null;
    }
  }, [callState.status]);

  // Исходящий звонок — в CallKit: строка в журнале вызовов iPhone, системная плашка звонка.
  // Собеседник ответил — CallKit начинает отсчёт длительности
  const outgoingConnectedRef = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const data = callState.callData;
    if (!data || data.isIncoming) return;
    if (callState.status === 'ringing' && iosSystemCallIdRef.current !== data.callId) {
      iosSystemCallIdRef.current = data.callId;
      // В журнал пишется id сотрудника — по нему работает перезвон. Без id — не число, перезвон его пропустит
      startIosOutgoingCall(data.callId, data.participant?.id ?? `call-${data.callId}`, data.participant?.name);
    } else if (callState.status === 'active' && iosSystemCallIdRef.current === data.callId && outgoingConnectedRef.current !== data.callId) {
      outgoingConnectedRef.current = data.callId;
      reportIosOutgoingConnected(data.callId);
    }
  }, [callState.status, callState.callData]);

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
    // Второй звонок во время разговора и удержанный звонок
    waitingCall,
    parkedCall,
    holdAndAnswerWaitingCall: () => answerWaitingCall({ keepCurrent: true }),
    endAndAnswerWaitingCall: () => answerWaitingCall({ keepCurrent: false }),
    rejectWaitingCall,
    endParkedCall,
    resumeFromHold,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
