// Библиотека экспортирует класс только по имени: импорт по умолчанию — undefined, подключение не начиналось
import { Pusher } from '@pusher/pusher-websocket-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitMessengerEvent } from './messengerStore';
import { SERVER_URL } from './api';
import { authRetryDelay, isRetryableAuthStatus, PUSHER_APP_KEY, PUSHER_CLUSTER, userChannel } from './pusherConfig';

let pusherInstance = null;
let isConnecting = false;

// Подпись, с которой Pusher откажет в подписке: нативная часть получает ответ и не ждёт его вечно
const REFUSED_AUTH = { auth: '' };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Подпись приватного канала с сервера. Ответ нужен всегда: без него Android ждёт его без срока, и подписка
 * не восстанавливается до перезапуска приложения. Сбой связи или временный ответ сервера — повтор с паузой;
 * отказ в доступе или выход из аккаунта — отказная подпись.
 */
const authorizeChannel = async (channelName, socketId) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return REFUSED_AUTH;
      // Тот же сервер, что и API: при локальном EXPO_PUBLIC_API_BASE_URL токен не уходит на боевой домен
      const response = await fetch(`${SERVER_URL}/broadcasting/auth`, {
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
      if (response.ok) return await response.json();
      if (!isRetryableAuthStatus(response.status)) {
        console.error('[Pusher] Auth refused:', response.status);
        return REFUSED_AUTH;
      }
      console.warn('[Pusher] Auth failed, retry:', response.status);
    } catch (error) {
      console.warn('[Pusher] Auth error, retry:', error?.message ?? error);
    }
    await wait(authRetryDelay(attempt));
  }
};

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
      onAuthorizer: authorizeChannel,
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
 * handlers: { onCallAccepted, onCallRejected, onCallCancelled, onCallEnded, onCallHeld }
 */
export const subscribeToCalls = async (staffId, handlers) => {
  const pusher = await getPusher();
  const channelName = userChannel(staffId);

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
        // Собеседник удержал звонок или вернулся к нему
        case 'call.held':
          handlers.onCallHeld?.(data);
          break;
        // Мессенджер приходит в тот же личный канал, что и звонки
        case 'message.created':
        case 'message.updated':
        case 'message.deleted':
        case 'messages.hidden':
        case 'chat.read':
        case 'chat.typing':
        case 'chat.pinned':
        case 'chat.updated':
          emitMessengerEvent(event.eventName, data);
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
    await pusherInstance.unsubscribe({ channelName: userChannel(staffId) });
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
