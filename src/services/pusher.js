import Pusher from '@pusher/pusher-websocket-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSHER_APP_KEY = '88f644943a85b36b115e';
const PUSHER_CLUSTER = 'eu';

let pusherInstance = null;
let isConnecting = false;

/**
 * Получить/инициализировать Pusher instance.
 * Создаётся один раз — singleton.
 */
export const getPusher = async () => {
  if (pusherInstance) return pusherInstance;
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return pusherInstance;
  }

  isConnecting = true;
  try {
    const pusher = Pusher.getInstance();
    await pusher.init({
      apiKey: PUSHER_APP_KEY,
      cluster: PUSHER_CLUSTER,
      useTLS: true,
      onAuthorizer: async (channelName, socketId) => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) throw new Error('No auth token in storage');

          const response = await fetch('https://empin-pro.ru/broadcasting/auth', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channelName,
            }),
          });

          if (!response.ok) {
            throw new Error(`Auth failed: ${response.status}`);
          }

          return await response.json();
        } catch (error) {
          console.error('[Pusher] Auth error:', error);
          throw error;
        }
      },
    });

    await pusher.connect();
    pusherInstance = pusher;
    console.log('[Pusher] Connected');
    return pusher;
  } finally {
    isConnecting = false;
  }
};

/**
 * Подписаться на канал звонков пользователя.
 * handlers: { onCallAccepted, onCallRejected, onCallCancelled, onCallEnded }
 */
export const subscribeToCalls = async (staffId, handlers) => {
  const pusher = await getPusher();
  const channelName = `private-user.${staffId}`;

  await pusher.subscribe({
    channelName,
    onEvent: (event) => {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      console.log('[Pusher] Event:', event.eventName, data);

      switch (event.eventName) {
        case 'call.accepted':
          handlers.onCallAccepted?.(data);
          break;
        case 'call.rejected':
          handlers.onCallRejected?.(data);
          break;
        case 'call.cancelled':
          handlers.onCallCancelled?.(data);
          break;
        case 'call.ended':
          handlers.onCallEnded?.(data);
          break;
      }
    },
    onSubscriptionSucceeded: () => {
      console.log('[Pusher] Subscribed to', channelName);
    },
    onSubscriptionError: (channelName, message, error) => {
      console.error('[Pusher] Subscription error:', channelName, message, error);
    },
  });
};

/**
 * Отписаться от канала звонков.
 */
export const unsubscribeFromCalls = async (staffId) => {
  if (!pusherInstance) return;
  try {
    await pusherInstance.unsubscribe({ channelName: `private-user.${staffId}` });
  } catch (e) {
    console.warn('[Pusher] Unsubscribe error:', e);
  }
};

/**
 * Отключить Pusher (при logout).
 */
export const disconnectPusher = async () => {
  if (!pusherInstance) return;
  try {
    await pusherInstance.disconnect();
    pusherInstance = null;
  } catch (e) {
    console.warn('[Pusher] Disconnect error:', e);
  }
};
