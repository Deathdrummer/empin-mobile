export type CallStatus = 'idle' | 'initiating' | 'ringing' | 'active' | 'ended' | 'error';

export interface CallData {
  callId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
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
