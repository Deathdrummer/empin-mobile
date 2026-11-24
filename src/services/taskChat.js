import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import api, { commentFormData } from './api';
import { getUserFacingError } from '../utils/userFacingError';
import { isOfflineError } from '../utils/tasks';

/**
 * Переписка задания (мини-чат в карточке, п. 6.4; П-ЗД-20…24) и её отправка без связи (ИС-ЗД-16, п. 9.1): сообщение и
 * копии вложений лежат в очереди на телефоне и уходят по одному, когда появляется связь
 */

const SEND_TIMEOUT_MS = 60000;

export const taskChatAPI = {
  list: async (taskId) => (await api.get(`/production/tasks/${taskId}/comments`, { timeout: 15000 })).data,
  send: async (taskId, item) => {
    const fields = { message: item.message, reply_to_id: item.replyToId, client_uuid: item.uuid };
    const body = item.files?.length ? commentFormData(fields, item.files) : fields;
    const config = item.files?.length
      ? { headers: { 'Content-Type': 'multipart/form-data' }, timeout: SEND_TIMEOUT_MS }
      : { timeout: SEND_TIMEOUT_MS };
    return (await api.post(`/production/tasks/${taskId}/comments`, body, config)).data;
  },
  // keepMedia — пути оставленных вложений; без него сервер вложения не меняет
  update: async (taskId, commentId, message, keepMedia) => (await api.put(
    `/production/tasks/${taskId}/comments/${commentId}`,
    keepMedia ? { message, keep_media: keepMedia } : { message },
    { timeout: 30000 },
  )).data,
  remove: async (taskId, commentId) => (await api.delete(`/production/tasks/${taskId}/comments/${commentId}`, { timeout: 30000 })).data,
  react: async (taskId, commentId, emoji) => (await api.post(`/production/tasks/${taskId}/comments/${commentId}/reaction`, { emoji }, { timeout: 15000 })).data,
};

// ---- Очередь отправки ----

export const TASK_CHAT_OUTBOX_KEY = '@taskChatOutbox';
const OUTBOX_DIR = 'task-chat-outbox';
const RETRY_MS = 20000;

let queue = null;
let flushing = false;
let retryTimer = null;
const listeners = new Set();
const sentListeners = new Set();

const notify = () => listeners.forEach((listener) => listener(queue || []));

const load = async () => {
  if (queue) return queue;
  try {
    queue = JSON.parse((await AsyncStorage.getItem(TASK_CHAT_OUTBOX_KEY)) || '[]');
  } catch {
    queue = [];
  }
  return queue;
};

const persist = () => AsyncStorage.setItem(TASK_CHAT_OUTBOX_KEY, JSON.stringify(queue || [])).catch(() => {});

const newUuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Копия вложения в папку приложения: временный файл камеры или галереи система может удалить до появления связи */
const keepFiles = (uuid, files) => {
  if (!files?.length) return [];
  const dir = new Directory(Paths.document, OUTBOX_DIR, uuid);
  if (!dir.exists) dir.create({ intermediates: true });
  return files.map((file, index) => {
    const name = file.name || file.fileName || file.uri.split('/').pop() || `file-${index}`;
    const target = new File(dir, `${index}-${name}`);
    new File(file.uri).copy(target);
    const thumb = file.thumbnailUri ? new File(dir, `${index}-thumb.jpg`) : null;
    if (thumb) new File(file.thumbnailUri).copy(thumb);
    return { ...file, uri: target.uri, name, thumbnailUri: thumb ? thumb.uri : undefined };
  });
};

const dropFiles = (uuid) => {
  try {
    const dir = new Directory(Paths.document, OUTBOX_DIR, uuid);
    if (dir.exists) dir.delete();
  } catch {
    // Файлы не удалились — займут место до очистки кэша, на отправку не влияют
  }
};

const scheduleRetry = () => {
  clearTimeout(retryTimer);
  if ((queue || []).some((item) => item.status === 'pending')) {
    retryTimer = setTimeout(() => flushTaskChat(), RETRY_MS);
  }
};

/** Отправить ожидающее по порядку */
export const flushTaskChat = async () => {
  if (flushing) return;
  flushing = true;
  try {
    await load();
    for (const item of [...queue]) {
      if (item.status !== 'pending') continue;
      try {
        const saved = await taskChatAPI.send(item.taskId, item);
        queue = queue.filter((entry) => entry.uuid !== item.uuid);
        persist();
        notify();
        dropFiles(item.uuid);
        sentListeners.forEach((listener) => listener(item.taskId, saved?.data ?? saved));
      } catch (error) {
        const status = error?.response?.status;
        if (isOfflineError(error) || !status || status >= 500 || status === 429) break;
        queue = queue.map((entry) => (entry.uuid === item.uuid
          ? { ...entry, status: 'failed', error: getUserFacingError(error, 'Сервер не принял сообщение') }
          : entry));
        persist();
        notify();
      }
    }
  } finally {
    flushing = false;
    scheduleRetry();
  }
};

/** Поставить сообщение в очередь и сразу попробовать отправить */
export const enqueueTaskMessage = async ({ taskId, staffId, message, replyToId, files }) => {
  await load();
  const uuid = newUuid();
  const item = {
    uuid,
    taskId,
    staffId,
    message: message || '',
    replyToId: replyToId || null,
    files: keepFiles(uuid, files),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  queue = [...queue, item];
  persist();
  notify();
  flushTaskChat();
  return item;
};

export const retryTaskMessage = async (uuid) => {
  await load();
  queue = queue.map((item) => (item.uuid === uuid ? { ...item, status: 'pending', error: undefined } : item));
  persist();
  notify();
  flushTaskChat();
};

export const discardTaskMessage = async (uuid) => {
  await load();
  queue = queue.filter((item) => item.uuid !== uuid);
  persist();
  notify();
  dropFiles(uuid);
};

/** Неотправленное текущего сотрудника по заданию (после смены учётки чужое не показывается и не отправляется) */
export const useTaskOutbox = (taskId, staffId) => {
  const [items, setItems] = useState(queue || []);
  useEffect(() => {
    listeners.add(setItems);
    load().then(() => setItems(queue));
    return () => listeners.delete(setItems);
  }, []);
  return items.filter((item) => Number(item.taskId) === Number(taskId) && Number(item.staffId) === Number(staffId));
};

/** Сообщение из очереди дошло до сервера — карточка задания обновляет переписку */
export const subscribeTaskMessageSent = (listener) => {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
};

/** Выход из учётки: очередь прежнего сотрудника не должна уйти от имени следующего */
export const clearTaskChatOutbox = async () => {
  clearTimeout(retryTimer);
  const items = await load();
  items.forEach((item) => dropFiles(item.uuid));
  queue = [];
  notify();
  await AsyncStorage.removeItem(TASK_CHAT_OUTBOX_KEY).catch(() => {});
};

// Приложение вернулось из фона — связь могла появиться
AppState.addEventListener('change', (state) => {
  if (state === 'active') flushTaskChat();
});
