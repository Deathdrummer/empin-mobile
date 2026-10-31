import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messengerAPI } from './api';
import { setDraft } from './drafts';
import { setTotalUnread } from './messengerStore';
import { MESSAGES_CHANNEL_ID, MESSAGES_QUIET_CHANNEL_ID, ensureMessagesChannel, ensureQuietMessagesChannel } from './messagePush';
import {
  READ_ACTION,
  actionKey,
  clientKeyFor,
  isMessageAction,
  responseData,
  withHandled,
} from '../utils/notificationActions';

/**
 * «Ответить» и «Прочитано» прямо из уведомления о сообщении, как в Telegram.
 *
 * Одно нажатие может прийти несколько раз: на Android, пока приложение не на экране, — и в фоновую задачу,
 * и обработчику; если приложение было закрыто — ещё раз при следующем запуске. Поэтому нажатие помечается
 * обработанным (в памяти и на телефоне), а сервер не отправляет повтор с тем же ключом попытки.
 * Ответ сначала кладётся в очередь: если связи нет или iOS усыпил приложение до отправки, он уйдёт при
 * следующем открытии приложения (flushReplies).
 */

const HANDLED_KEY = '@notificationActionsHandled';
const OUTBOX_KEY = '@notificationRepliesOutbox';

const inFlight = new Set();
let flushing = null;

const readJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});

/** Убрать из шторки уведомления этого чата — как при открытии чата */
const dismissChatNotifications = async (chatId) => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presented
      .filter((item) => Number(item.request.content.data?.chat_id) === Number(chatId))
      .map((item) => Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})));
  } catch {
    // Шторка недоступна — не страшно
  }
};

// Android после ответа из уведомления держит его в шторке («отправляется»), пока приложение его не обновит —
// даже если убрать его. Поэтому сначала беззвучно обновляем (с ответом), а через секунду убираем
const ANDROID_REPLY_SETTLE_MS = 1000;

const settleRepliedNotification = async (reply) => {
  if (Platform.OS !== 'android' || !reply.notificationId) return;
  try {
    await ensureQuietMessagesChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: reply.notificationId,
      content: { title: reply.title || 'Ответ отправлен', body: `Вы: ${reply.text}`, data: reply.data },
      trigger: { channelId: MESSAGES_QUIET_CHANNEL_ID },
    });
    await new Promise((resolve) => setTimeout(resolve, ANDROID_REPLY_SETTLE_MS));
    await Notifications.dismissNotificationAsync(reply.notificationId);
  } catch {
    // Не вышло — останется в шторке до смахивания, ответ всё равно отправлен
  }
};

const presentFailure = async (reply, willRetry) => {
  // Android — на месте исходного уведомления (иначе оно так и висело бы «отправляется») и беззвучно:
  // человек только что сам нажал «Отправить»
  const inPlace = Platform.OS === 'android' && Boolean(reply.notificationId);
  await (inPlace ? ensureQuietMessagesChannel() : ensureMessagesChannel());
  await Notifications.scheduleNotificationAsync({
    ...(inPlace ? { identifier: reply.notificationId } : {}),
    content: {
      title: 'Ответ не отправлен',
      body: willRetry
        ? `«${reply.text}» — отправим, когда появится связь и вы откроете приложение`
        : `«${reply.text}» — сохранён в черновике чата`,
      // Касание открывает чат (без кнопок: это не новое сообщение)
      data: { ...reply.data, type: 'message', message_id: null },
    },
    trigger: Platform.OS === 'android' ? { channelId: inPlace ? MESSAGES_QUIET_CHANNEL_ID : MESSAGES_CHANNEL_ID } : null,
  }).catch(() => {});
};

const removeFromOutbox = async (key) => {
  const outbox = await readJson(OUTBOX_KEY, {});
  if (!outbox[key]) return;
  delete outbox[key];
  await writeJson(OUTBOX_KEY, outbox);
};

const sendReply = async (reply, { notifyOnRetry = true } = {}) => {
  try {
    const sent = await messengerAPI.addMessage(reply.chatId, reply.text, null, [], { clientKey: clientKeyFor(reply.key) });
    await removeFromOutbox(reply.key);
    // Отправка отмечает чат прочитанным на сервере — уведомления этого чата больше не нужны
    await settleRepliedNotification(reply);
    await dismissChatNotifications(reply.chatId);
    messengerAPI.getChats().then((data) => setTotalUnread(data.total_unread)).catch(() => {});
    return sent;
  } catch (error) {
    const status = error?.response?.status;
    // Не уйдёт и при повторе (нет прав, чат недоступен) — текст в черновик чата
    if (status >= 400 && status < 500 && ![408, 409, 429].includes(status)) {
      await removeFromOutbox(reply.key);
      setDraft(reply.chatId, reply.text);
      await presentFailure(reply, false);
    } else if (notifyOnRetry) {
      await presentFailure(reply, true);
    }
    return null;
  }
};

const markChatRead = async (chatId, messageId) => {
  if (messageId) {
    try {
      const data = await messengerAPI.markRead(chatId, Number(messageId));
      setTotalUnread(data.total_unread);
    } catch {
      // Без связи — прочитается при открытии чата
    }
  }
  await dismissChatNotifications(chatId);
};

/**
 * Нажатие «Ответить» или «Прочитано». true — нажатие наше (обработано или уже обрабатывалось),
 * false — обычное касание уведомления: его обрабатывает открытие чата
 */
export const handleMessageAction = async (response) => {
  if (!isMessageAction(response)) return false;
  const key = actionKey(response);
  const data = responseData(response);
  const chatId = Number(data.chat_id);
  if (!key || data.type !== 'message' || !chatId) return true;

  // Синхронно, до первого await: второе такое же нажатие в этом же процессе дальше не пройдёт
  if (inFlight.has(key)) return true;
  inFlight.add(key);
  try {
    const handled = await readJson(HANDLED_KEY, []);
    if (handled.includes(key)) return true;
    await writeJson(HANDLED_KEY, withHandled(handled, key));

    // После выхода из аккаунта не отвечаем от имени следующего пользователя
    if (!(await AsyncStorage.getItem('token'))) return true;

    if (response.actionIdentifier === READ_ACTION) {
      await markChatRead(chatId, data.message_id);
      return true;
    }

    const text = (response.userText || '').trim();
    if (!text) return true;
    const request = response.notification.request;
    const reply = { key, chatId, text, data, notificationId: request.identifier, title: request.content?.title };
    const outbox = await readJson(OUTBOX_KEY, {});
    await writeJson(OUTBOX_KEY, { ...outbox, [key]: reply });
    await sendReply(reply);
    return true;
  } finally {
    inFlight.delete(key);
  }
};

/** Отправить ответы из уведомлений, которые не ушли (не было связи, iOS усыпил приложение) */
export const flushReplies = () => {
  if (!flushing) {
    flushing = (async () => {
      if (!(await AsyncStorage.getItem('token'))) return;
      const outbox = await readJson(OUTBOX_KEY, {});
      for (const reply of Object.values(outbox)) {
        // О неудаче уже сообщили, когда нажали «Отправить» — повторно не беспокоим
        await sendReply(reply, { notifyOnRetry: false });
      }
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
};

/** При выходе из аккаунта неотправленные ответы не должны уйти от имени следующего пользователя */
export const clearPendingReplies = () => AsyncStorage.removeItem(OUTBOX_KEY).catch(() => {});
