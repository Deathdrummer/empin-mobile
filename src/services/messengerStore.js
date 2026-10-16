import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Общее состояние мессенджера вне React-дерева:
 * - события реального времени из Pusher (message.created/updated/deleted, chat.read, chat.typing);
 * - открытый сейчас чат — его сообщения не показываем уведомлением;
 * - общее число непрочитанных — значок на вкладке «Чаты» и на иконке приложения.
 */
const eventListeners = new Set();
const unreadListeners = new Set();

let activeChatId = null;
let totalUnread = 0;

export const emitMessengerEvent = (name, data) => {
  eventListeners.forEach((listener) => {
    try {
      listener(name, data);
    } catch (error) {
      console.warn('[Messenger] Event listener failed:', error?.message ?? error);
    }
  });
};

export const subscribeMessengerEvents = (listener) => {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
};

export const setActiveChatId = (chatId) => {
  activeChatId = chatId ? Number(chatId) : null;
};

export const getActiveChatId = () => activeChatId;

export const setTotalUnread = (count) => {
  const next = Math.max(0, Number(count) || 0);
  if (next === totalUnread) return;
  totalUnread = next;
  unreadListeners.forEach((listener) => listener(totalUnread));
  if (Platform.OS === 'ios') {
    Notifications.setBadgeCountAsync(totalUnread).catch(() => {});
  }
};

export const getTotalUnread = () => totalUnread;

export const useTotalUnread = () => {
  const [count, setCount] = useState(totalUnread);

  useEffect(() => {
    unreadListeners.add(setCount);
    setCount(totalUnread);
    return () => unreadListeners.delete(setCount);
  }, []);

  return count;
};
