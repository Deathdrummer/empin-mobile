import React from 'react';
import { CallModal } from './CallModal';
import { useCallContext } from '../../contexts/CallContext';
import { formatShortName } from '../../utils/formatName';

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
  console.log('[GlobalCallModal] incomingCallData:', JSON.stringify(incomingCallData));
  console.log('[GlobalCallModal] callState.callData:', JSON.stringify(callState.callData));

  const resolveCallerName = (caller) => {
    if (!caller) return 'Неизвестный';
    const shortName = formatShortName(caller);
    if (shortName && shortName !== 'Без имени') return shortName;
    return caller.full_name || 'Неизвестный';
  };

  const participant = incomingCallData?.caller
    ? {
        id: incomingCallData.caller.id,
        name: resolveCallerName(incomingCallData.caller),
        avatar: incomingCallData.caller.avatar,
      }
    : callState.callData?.participant || {
        id: null,
        name: 'Неизвестный',
        avatar: undefined,
      };

  console.log('[GlobalCallModal] resolved participant:', participant);

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
