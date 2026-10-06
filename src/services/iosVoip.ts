import { Platform } from 'react-native';
import EmpinVoip, {
  type VoipCallEvent,
  type VoipTokenEvent,
} from '../../modules/empin-voip';
import { messengerAPI } from './api';

const MAX_PENDING_EVENT_AGE_MS = 2 * 60 * 1000;

export const isIosVoipAvailable = (): boolean => Platform.OS === 'ios' && EmpinVoip !== null;

const registerTokenWithBackend = async (token: string | null): Promise<void> => {
  if (!token) return;

  await messengerAPI.registerVoipToken(token).catch((error) => {
    console.warn('[VoIP] Не удалось зарегистрировать токен на сервере:', error?.response?.status ?? error?.message);
  });
};

export const startIosVoip = async (
  onCallEvent: (event: VoipCallEvent) => Promise<void> | void
): Promise<() => void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) {
    return () => {};
  }

  const deliveredEventIds = new Set<string>();

  const processEvent = async (event: VoipCallEvent) => {
    if (!event?.eventId || deliveredEventIds.has(event.eventId)) return;
    deliveredEventIds.add(event.eventId);

    try {
      const isExpired = !Number.isFinite(event.createdAt)
        || Date.now() - event.createdAt > MAX_PENDING_EVENT_AGE_MS;

      if (!isExpired) {
        await onCallEvent(event);
      }
    } finally {
      await EmpinVoip.acknowledgeEventAsync(event.eventId).catch(() => {});
    }
  };

  const callSubscription = EmpinVoip.addListener('onVoipCallEvent', processEvent);
  const tokenSubscription = EmpinVoip.addListener('onVoipToken', (event: VoipTokenEvent) => {
    registerTokenWithBackend(event.token);
  });

  await EmpinVoip.registerAsync();

  const [token, pendingEvents] = await Promise.all([
    EmpinVoip.getVoipTokenAsync(),
    EmpinVoip.getPendingEventsAsync(),
  ]);

  await registerTokenWithBackend(token);
  // Сохраняем порядок: incoming должен быть обработан до answer/reject/end.
  for (const event of pendingEvents) {
    await processEvent(event);
  }

  return () => {
    callSubscription.remove();
    tokenSubscription.remove();
  };
};

export const unregisterIosVoipToken = async (): Promise<void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) return;

  const token = await EmpinVoip.getVoipTokenAsync().catch(() => null);
  if (token) {
    await messengerAPI.unregisterVoipToken(token).catch(() => {});
  }
  await EmpinVoip.setEnabledAsync(false).catch(() => {});
};

export const disableIosVoip = async (): Promise<void> => {
  if (!isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.setEnabledAsync(false).catch(() => {});
};

export const endIosSystemCall = async (
  callId: string | number | null | undefined,
  reason: 'failed' | 'unanswered' | 'timeout' | 'declined' | 'remoteEnded' = 'remoteEnded'
): Promise<void> => {
  if (!callId || !isIosVoipAvailable() || !EmpinVoip) return;
  await EmpinVoip.endCallAsync(String(callId), reason).catch(() => {});
};
