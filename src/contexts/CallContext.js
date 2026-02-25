import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useCall } from '../services/livekit/useCall';
import { messengerAPI } from '../services/api';

const CallContext = createContext(null);

// Интервал polling (временно, до FCM)
const POLL_INTERVAL = 5000;

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
  const [callTimeoutId, setCallTimeoutId] = useState(null);
  const pollRef = useRef(null);
  const handledCallIdRef = useRef(null); // Трекинг обработанного звонка

  const callState = useCall();

  /**
   * Polling входящих звонков (временно, до FCM push-уведомлений)
   * TODO: заменить на FCM push notifications
   */
  useEffect(() => {
    const isIdle = callState.status === 'idle';

    const poll = async () => {
      try {
        const { call } = await messengerAPI.getPendingCall();
        if (call && String(call.id) !== handledCallIdRef.current) {
          console.log('[CallContext] Incoming call detected:', call.id);
          console.log('[CallContext] Pending call data:', JSON.stringify(call, null, 2));
          handledCallIdRef.current = String(call.id);
          handleIncomingCall({
            callId: String(call.id),
            caller: call.caller,
            callType: call.call_type,
          });
        }
      } catch (err) {
        // Тихо игнорируем — polling не должен ломать приложение
      }
    };

    if (isIdle && !callModalVisible) {
      poll(); // Первый запрос сразу
      pollRef.current = setInterval(poll, POLL_INTERVAL);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [callState.status, callModalVisible]);

  // Останавливаем polling когда приложение свернуто
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    });

    return () => sub.remove();
  }, []);

  /**
   * Обработка входящего звонка (из polling или будущего FCM)
   */
  const handleIncomingCall = useCallback((callData) => {
    console.log('Incoming call:', callData);

    setIncomingCallData(callData);
    setCallModalVisible(true);

    // Таймаут 30 секунд для автоматического отклонения
    const timeoutId = setTimeout(() => {
      console.log('Call timeout - auto rejecting');
      handleRejectCall();
    }, 30000);

    setCallTimeoutId(timeoutId);
  }, []);

  /**
   * Инициация исходящего звонка
   */
  const initiateCall = useCallback(async (userId, userName, userAvatar) => {
    await callState.initiateCall(userId, userName, userAvatar);
    setCallModalVisible(true);
  }, [callState]);

  /**
   * Принятие звонка
   */
  const handleAcceptCall = useCallback(async () => {
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
    if (callTimeoutId) {
      clearTimeout(callTimeoutId);
      setCallTimeoutId(null);
    }

    await callState.endCall();
    setCallModalVisible(false);
    setIncomingCallData(null);
  }, [callState, callTimeoutId]);

  // Сброс handledCallId при завершении/отклонении (чтобы новый звонок от того же человека работал)
  useEffect(() => {
    if (!callModalVisible && !incomingCallData) {
      handledCallIdRef.current = null;
    }
  }, [callModalVisible, incomingCallData]);

  /**
   * Cleanup таймаута
   */
  useEffect(() => {
    return () => {
      if (callTimeoutId) {
        clearTimeout(callTimeoutId);
      }
    };
  }, [callTimeoutId]);

  /**
   * Закрытие модального окна при завершении звонка
   */
  useEffect(() => {
    if (callState.status === 'ended' || callState.status === 'error') {
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
