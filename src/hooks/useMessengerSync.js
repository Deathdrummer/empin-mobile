import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { StackActions } from '@react-navigation/native';
import { messengerAPI } from '../services/api';
import { getActiveChatId, setTotalUnread, subscribeMessengerEvents } from '../services/messengerStore';
import { navigationRef } from '../services/navigationRef';

const PRESENCE_INTERVAL_MS = 60000;

/**
 * Мессенджер вне экранов чата:
 * - число непрочитанных (значок на вкладке и иконке) — после входа, при возврате в приложение и при новых сообщениях;
 * - «в сети»: пока приложение открыто, раз в минуту отмечаемся на сервере;
 * - нажатие на уведомление о сообщении открывает нужный чат (в том числе при запуске приложения из уведомления).
 */
export const useMessengerSync = (isLoggedIn) => {
  const pendingOpenRef = useRef(null);
  const handledResponseRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setTotalUnread(0);
      return undefined;
    }

    let timer = null;
    const refresh = () => {
      messengerAPI.getChats()
        .then((data) => setTotalUnread(data.total_unread))
        .catch(() => {});
    };
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 500);
    };

    const ping = () => {
      if (AppState.currentState === 'active') messengerAPI.presence().catch(() => {});
    };

    refresh();
    ping();
    const presenceTimer = setInterval(ping, PRESENCE_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        ping();
      }
    });
    const unsubscribe = subscribeMessengerEvents((name, data) => {
      // Открытый чат сам отмечает прочитанное и обновляет счётчик
      if (name === 'message.created' && Number(data?.chat_id) !== getActiveChatId()) refreshSoon();
      if (name === 'message.deleted' || name === 'chat.updated') refreshSoon();
    });

    return () => {
      clearTimeout(timer);
      clearInterval(presenceTimer);
      appState.remove();
      unsubscribe();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const openFromResponse = (response) => {
      const content = response?.notification?.request?.content;
      const data = content?.data;
      if (data?.type !== 'message' || (!data.sender_id && !data.chat_id)) return;

      // Один и тот же ответ (например, из getLastNotificationResponseAsync) не открываем дважды
      const responseId = response.notification.request.identifier;
      if (handledResponseRef.current === responseId) return;
      handledResponseRef.current = responseId;
      // Иначе после выхода и повторного входа чат открылся бы снова
      Notifications.clearLastNotificationResponseAsync().catch(() => {});

      const chatType = data.chat_type || 'direct';
      const params = chatType === 'direct'
        ? {
          chatType,
          staffId: Number(data.sender_id),
          staffName: data.chat_title || content.title || 'Собеседник',
          chatId: data.chat_id ? Number(data.chat_id) : null,
        }
        : {
          chatType,
          chatId: Number(data.chat_id),
          title: data.chat_title || content.title || 'Чат',
        };
      const open = () => {
        const current = navigationRef.getCurrentRoute();
        if (current?.name === 'Chat' && (
          (params.chatId && Number(current.params?.chatId) === params.chatId)
          || (chatType === 'direct' && Number(current.params?.staffId) === params.staffId)
        )) return;
        navigationRef.dispatch(StackActions.push('Chat', params));
      };

      if (navigationRef.isReady()) open();
      else pendingOpenRef.current = open;
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    Notifications.getLastNotificationResponseAsync().then(openFromResponse).catch(() => {});

    const readyTimer = setInterval(() => {
      if (pendingOpenRef.current && navigationRef.isReady()) {
        const open = pendingOpenRef.current;
        pendingOpenRef.current = null;
        open();
      }
    }, 300);

    return () => {
      subscription.remove();
      clearInterval(readyTimer);
    };
  }, [isLoggedIn]);
};
