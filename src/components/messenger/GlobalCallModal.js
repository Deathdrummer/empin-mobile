import React from 'react';
import { Platform } from 'react-native';
import { CallModal } from './CallModal';
import { useCallContext } from '../../contexts/CallContext';
import { HOLD } from '../../services/callHold';
import { formatShortName } from '../../utils/formatName';

/**
 * Глобальный CallModal, управляемый через CallContext
 */
export const GlobalCallModal = () => {
  const {
    callModalVisible,
    callState,
    incomingCallData,
    outgoingParticipant,
    callEndReason,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    waitingCall,
    parkedCall,
    holdAndAnswerWaitingCall,
    endAndAnswerWaitingCall,
    rejectWaitingCall,
    endParkedCall,
    resumeFromHold,
  } = useCallContext();

  // Для входящего звонка из polling — формируем "синтетический" callState,
  // т.к. useCall() ещё не знает об этом звонке (он в idle)
  const baseCallState = incomingCallData && callState.status === 'idle'
    ? {
        ...callState,
        status: 'ringing',
        callData: { isIncoming: true, callId: incomingCallData.callId },
      }
    : callState;

  // При отклонении звонка вызываемым — переопределяем статус
  const effectiveCallState = callEndReason === 'rejected'
    ? { ...baseCallState, status: 'rejected' }
    : baseCallState;

  // Определяем участника звонка
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
    : callState.callData?.participant
      || outgoingParticipant
      || { id: null, name: 'Неизвестный', avatar: undefined };

  const holdReasons = callState.holdReasons ?? [];

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
      hold={{
        me: holdReasons.length > 0,
        peer: Boolean(callState.peerOnHold),
        // iPhone: удержание системой можно снять самому, если звонок по сотовой связи уже закончился
        canResume: Platform.OS === 'ios' && holdReasons.includes(HOLD.system),
      }}
      onResumeHold={resumeFromHold}
      // На iPhone второй звонок показывает системный экран CallKit — свои кнопки только на Android
      waitingName={Platform.OS === 'ios' || !waitingCall ? null : resolveCallerName(waitingCall.caller)}
      onWaitingHoldAnswer={holdAndAnswerWaitingCall}
      onWaitingEndAnswer={endAndAnswerWaitingCall}
      onWaitingReject={rejectWaitingCall}
      parkedName={parkedCall ? parkedCall.callData.participant?.name || 'Собеседник' : null}
      onEndParked={endParkedCall}
    />
  );
};
