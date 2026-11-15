export type CallStatus = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'active' | 'ended' | 'no_answer' | 'error';

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
  /** Почему разговор у нас на удержании (см. callHold); пусто — разговор идёт */
  holdReasons?: string[];
  /** Собеседник поставил разговор на удержание */
  peerOnHold?: boolean;
}

/** Удержанный звонок, из канала которого мы вышли, чтобы ответить на второй */
export interface ParkedCall {
  callData: CallData;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
}

/** Параметры повторного входа в канал удержанного звонка (ответ POST /calls/{id}/hold) */
export interface ResumeParams {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
  peerOnHold: boolean;
}
