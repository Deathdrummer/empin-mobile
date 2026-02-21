import React from 'react';
import { CallModal } from './CallModal';
import { useCallContext } from '../../contexts/CallContext';

/**
 * Глобальный CallModal, управляемый через CallContext
 */
export const GlobalCallModal = () => {
  const {
    callModalVisible,
    callState,
    incomingCallData,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = useCallContext();

  // Для входящего звонка из polling — формируем "синтетический" callState,
  // т.к. useCall() ещё не знает об этом звонке (он в idle)
  const effectiveCallState = incomingCallData && callState.status === 'idle'
    ? {
        ...callState,
        status: 'ringing',
        callData: { isIncoming: true, callId: incomingCallData.callId },
      }
    : callState;

  // Определяем участника звонка
  const participant = incomingCallData?.caller
    ? {
        id: incomingCallData.caller.id,
        name: incomingCallData.caller.full_name || 'Неизвестный',
        avatar: incomingCallData.caller.avatar,
      }
    : callState.callData?.participant || {
        id: null,
        name: 'Неизвестный',
        avatar: undefined,
      };

  return (
    <CallModal
      visible={callModalVisible}
      callState={effectiveCallState}
      participant={participant}
      onAccept={acceptCall}
      onReject={rejectCall}
      onEnd={endCall}
      onToggleMute={toggleMute}
      onToggleSpeaker={toggleSpeaker}
    />
  );
};
