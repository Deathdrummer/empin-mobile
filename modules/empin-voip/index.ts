import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type VoipTokenEvent = {
  token: string | null;
};

export type VoipCallEvent = {
  eventId: string;
  // redial — нажали звонок приложения в журнале «Недавние» iPhone: callerId — кому звонить.
  // hold / unhold — CallKit удержал звонок или вернул его; audioActivated — iOS снова отдала звук разговору
  type: 'incoming' | 'answer' | 'reject' | 'end' | 'timeout' | 'remoteEnded' | 'busy' | 'redial' | 'answeredElsewhere'
    | 'hold' | 'unhold' | 'audioActivated';
  callId: string;
  callUUID: string;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  createdAt: number;
};

type EmpinVoipEvents = {
  onVoipToken(event: VoipTokenEvent): void;
  onVoipCallEvent(event: VoipCallEvent): void;
};

declare class EmpinVoipNativeModule extends NativeModule<EmpinVoipEvents> {
  registerAsync(): Promise<void>;
  setEnabledAsync(enabled: boolean): Promise<void>;
  getVoipTokenAsync(): Promise<string | null>;
  getPendingEventsAsync(): Promise<VoipCallEvent[]>;
  acknowledgeEventAsync(eventId: string): Promise<void>;
  endCallAsync(callId: string, reason: string): Promise<void>;
  startOutgoingCallAsync(callId: string, calleeId: string, calleeName: string): Promise<void>;
  reportOutgoingConnectedAsync(callId: string): Promise<void>;
  setHeldAsync(callId: string, onHold: boolean): Promise<void>;
  allowHapticsDuringRecordingAsync(): Promise<void>;
}

export default requireOptionalNativeModule<EmpinVoipNativeModule>('EmpinVoip');
