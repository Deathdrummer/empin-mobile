import { AppState, Platform } from 'react-native';
import EmpinVoip, {
  type VoipCallEvent,
  type VoipTokenEvent,
} from '../../modules/empin-voip';
import { messengerAPI } from './api';
import { createDeviceRegistration } from './deviceRegistration';
import { recordCallDiagnostic } from './callDiagnostics';

const MAX_PENDING_EVENT_AGE_MS = 2 * 60 * 1000;
let stopCurrentRuntime: (() => void) | null = null;

export const isIosVoipAvailable = (): boolean => Platform.OS === 'ios' && EmpinVoip !== null;

export const startIosVoip = async (
  onCallEvent: (event: VoipCallEvent) => Promise<void> | void
): Promise<() => void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) {
    recordCallDiagnostic('voip-module-missing');
    return () => {};
  }

  const deliveredEventIds = new Set<string>();
  let stopped = false;
  const registration = createDeviceRegistration({
    getToken: () => EmpinVoip!.getVoipTokenAsync(),
    sendToken: (token: string, signal: AbortSignal) => messengerAPI.registerVoipToken(token, signal),
    onState: (state, details) => {
      recordCallDiagnostic(`voip-registration-${state}`, details);
      if (state === 'error') console.warn('[VoIP] Регистрация не завершена:', details?.status ?? 'сеть');
    },
  });

  const processEvent = async (event: VoipCallEvent) => {
    if (stopped || !event?.eventId || deliveredEventIds.has(event.eventId)) return;
    deliveredEventIds.add(event.eventId);

    try {
      const isExpired = !Number.isFinite(event.createdAt)
        || Date.now() - event.createdAt > MAX_PENDING_EVENT_AGE_MS;

      if (!isExpired) {
        recordCallDiagnostic(`callkit-${event.type}`, { callId: Number(event.callId) });
        await onCallEvent(event);
      }
    } finally {
      await EmpinVoip.acknowledgeEventAsync(event.eventId).catch(() => {});
    }
  };

  const callSubscription = EmpinVoip.addListener('onVoipCallEvent', processEvent);
  const tokenSubscription = EmpinVoip.addListener('onVoipToken', (_event: VoipTokenEvent) => {
    registration.sync(true);
  });
  const foregroundSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') registration.sync(true);
  });
  const stop = () => {
    stopped = true;
    registration.dispose();
    callSubscription.remove();
    tokenSubscription.remove();
    foregroundSubscription.remove();
    if (stopCurrentRuntime === stop) stopCurrentRuntime = null;
  };
  stopCurrentRuntime?.();
  stopCurrentRuntime = stop;

  try { await EmpinVoip.registerAsync(); }
  catch (error) {
    stop();
    throw error;
  }
  if (stopped) return stop;
  registration.sync();
  try {
    const pendingEvents = await EmpinVoip.getPendingEventsAsync();
    // Сохраняем порядок: incoming должен быть обработан до answer/reject/end.
    for (const event of pendingEvents) await processEvent(event);
  } catch (error) {
    stop();
    throw error;
  }

  return stop;
};

export const unregisterIosVoipToken = async (): Promise<void> => {
  stopCurrentRuntime?.();
  if (!isIosVoipAvailable() || !EmpinVoip) return;

  const token = await EmpinVoip.getVoipTokenAsync().catch(() => null);
  if (token) {
    await messengerAPI.unregisterVoipToken(token).catch(() => {});
  }
  await EmpinVoip.setEnabledAsync(false).catch(() => {});
};

export const disableIosVoip = async (): Promise<void> => {
  stopCurrentRuntime?.();
  if (!isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.setEnabledAsync(false).catch(() => {});
};

/** Исходящий звонок — в CallKit (журнал вызовов iPhone, системная плашка звонка) */
export const startIosOutgoingCall = async (
  callId: string | number,
  calleeId: string | number,
  calleeName: string
): Promise<void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.startOutgoingCallAsync(String(callId), String(calleeId), calleeName || 'Собеседник').catch(() => {});
};

/** iOS глушит виброотклики, пока идёт запись с микрофона, — разрешаем (для отклика фиксации голосового) */
export const allowHapticsDuringRecording = async (): Promise<void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.allowHapticsDuringRecordingAsync().catch(() => {});
};

export const reportIosOutgoingConnected = async (callId: string | number | null | undefined): Promise<void> => {
  if (!callId || !isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.reportOutgoingConnectedAsync(String(callId)).catch(() => {});
};

export const endIosSystemCall = async (
  callId: string | number | null | undefined,
  reason: 'failed' | 'unanswered' | 'timeout' | 'declined' | 'remoteEnded' = 'remoteEnded'
): Promise<void> => {
  if (!callId || !isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.endCallAsync(String(callId), reason).catch(() => {});
};
