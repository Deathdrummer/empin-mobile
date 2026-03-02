import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
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

  const handledCallIdRef = useRef(null);
  const notifListenerRef = useRef(null);
  const notifResponseListenerRef = useRef(null);
  const handleEndCallRef = useRef(null);

  const callState = useCall();

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

      handleIncomingCall({
        callId,
        caller: {
          id: data.caller_id,
          sname: data.caller_name ?? 'Неизвестный',
          fname: '',
          mname: '',
        },
        callType: 'audio',
      });
    }

    if (data.type === 'call_cancelled') {
      const callId = String(data.call_id);
      const currentCallId = callState.callData?.callId;

      // Проверяем: это уведомление о нашем текущем звонке?
      const isOurCall =
        (incomingCallData?.callId === callId) ||
        (currentCallId === callId);

      if (callModalVisible && isOurCall) {
        if (callState.status === 'active') {
          // Активный звонок: принудительно завершаем через ref (избегаем stale closure)
          handleEndCallRef.current?.();
        } else {
          // Ожидающий звонок: просто скрываем модал
          setCallTimeoutId((prev) => { if (prev) clearTimeout(prev); return null; });
          setCallModalVisible(false);
          setIncomingCallData(null);
        }
      }
    }
  }, [callModalVisible, incomingCallData, callState.status, callState.callData]);

  /**
   * Подписка на уведомления (foreground + tap)
   */
  useEffect(() => {
    // Уведомления пришедшие пока приложение открыто
    notifListenerRef.current = Notifications.addNotificationReceivedListener(handlePushNotification);

    // Тап по уведомлению когда приложение свёрнуто/закрыто
    notifResponseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushNotification(response.notification);
    });

    return () => {
      notifListenerRef.current?.remove();
      notifResponseListenerRef.current?.remove();
    };
  }, [handlePushNotification]);

  /**
   * Обработка входящего звонка
   */
  const handleIncomingCall = useCallback((callData) => {
    setIncomingCallData(callData);
    setCallModalVisible(true);

    // Автоотклонение через 30 секунд
    const timeoutId = setTimeout(() => {
      handleRejectCall();
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

  // Синхронизируем ref с актуальной версией handleEndCall
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  // Сброс при закрытии модала
  useEffect(() => {
    if (!callModalVisible && !incomingCallData) {
      handledCallIdRef.current = null;
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
    outgoingParticipant,
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
