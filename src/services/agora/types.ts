export type CallStatus = 'idle' | 'initiating' | 'ringing' | 'active' | 'ended' | 'error';

export interface CallData {
  callId: string;
  channelName: string;
  token: string;
  uid: number;
  participant: {
    id: number;
    name: string;
    avatar?: string;
  };
  isIncoming: boolean;
}

export interface CallState {
  status: CallStatus;
  callData: CallData | null;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  error: string | null;
}
