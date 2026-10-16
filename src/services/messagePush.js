import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const MESSAGES_CHANNEL_ID = 'messages';

/** Android-канал уведомлений о сообщениях: всплывают поверх экрана и со звуком */
export const ensureMessagesChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
    name: 'Сообщения',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
  }).catch(() => {});
};

/**
 * Android: все FCM-сообщения получает сервис @react-native-firebase (его приоритет выше, чем у сервиса
 * expo-notifications), а Expo присылает уведомления data-сообщением — сами они на экране не появятся.
 * Показываем уведомление о сообщении локально.
 *
 * raw — remoteMessage.data от Expo: title — заголовок, message — текст, body — наши данные в JSON.
 * data — разобранные наши данные (type, chat_id, message_id, sender_id).
 */
export const presentMessagePush = async (raw, data) => {
  if (Platform.OS !== 'android' || data?.type !== 'message') return;

  await ensureMessagesChannel();
  await Notifications.scheduleNotificationAsync({
    // Повторная доставка того же push не создаёт второе уведомление
    identifier: data.message_id ? `message-${data.message_id}` : undefined,
    content: {
      title: raw?.title || 'Новое сообщение',
      body: raw?.message || '',
      data,
      sound: 'default',
    },
    trigger: { channelId: MESSAGES_CHANNEL_ID },
  });
};
