import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MESSAGE_CATEGORY, READ_ACTION, REPLY_ACTION } from '../utils/notificationActions';

export const MESSAGES_CHANNEL_ID = 'messages';

let categoryPromise = null;

/**
 * Кнопки уведомления о сообщении, как в Telegram: «Ответить» с полем ввода и «Прочитано».
 * Приложение при этом не открывается (что делают кнопки — services/messageActions)
 */
export const ensureMessageCategory = () => {
  if (!categoryPromise) {
    categoryPromise = Notifications.setNotificationCategoryAsync(MESSAGE_CATEGORY, [
      {
        identifier: REPLY_ACTION,
        buttonTitle: 'Ответить',
        textInput: { submitButtonTitle: 'Отправить', placeholder: 'Сообщение' },
        options: { opensAppToForeground: false },
      },
      {
        identifier: READ_ACTION,
        buttonTitle: 'Прочитано',
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {
      categoryPromise = null;
    });
  }
  return categoryPromise;
};

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

// Беззвучный канал — для обновления уже показанного уведомления (после ответа из него)
export const MESSAGES_QUIET_CHANNEL_ID = 'messages-quiet';

export const ensureQuietMessagesChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MESSAGES_QUIET_CHANNEL_ID, {
    name: 'Сообщения: обновления',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  }).catch(() => {});
};

/**
 * Android: все FCM-сообщения получает сервис @react-native-firebase (его приоритет выше, чем у сервиса
 * expo-notifications). Показываем уведомление о сообщении локально — с кнопками «Ответить» / «Прочитано».
 * Сервер шлёт этому приложению push только данными (флаг data_only при регистрации токена): push с заголовком
 * Firebase показал бы и сам — второе уведомление, без кнопок.
 *
 * raw — remoteMessage.data от Expo: title — заголовок, message — текст (у push только данными их нет),
 * body — наши данные в JSON. data — разобранные наши данные (type, chat_id, message_id, sender_id,
 * push_title / push_body — заголовок и текст у push только данными).
 */
export const presentMessagePush = async (raw, data) => {
  if (Platform.OS !== 'android' || data?.type !== 'message') return;

  await ensureMessagesChannel();
  // Кнопки — только у уведомления о сообщении (у «вас добавили в группу» нечего отмечать прочитанным)
  if (data.message_id) await ensureMessageCategory();
  await Notifications.scheduleNotificationAsync({
    // Повторная доставка того же push не создаёт второе уведомление
    identifier: data.message_id ? `message-${data.message_id}` : undefined,
    content: {
      title: raw?.title || data.push_title || 'Новое сообщение',
      body: raw?.message || data.push_body || '',
      data,
      sound: 'default',
      ...(data.message_id ? { categoryIdentifier: MESSAGE_CATEGORY } : {}),
    },
    trigger: { channelId: MESSAGES_CHANNEL_ID },
  });
};
