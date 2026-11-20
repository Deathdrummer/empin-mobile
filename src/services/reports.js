import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import api from './api';
import { markRefused, settleRefusedQueue } from '../utils/reports';
import { emitTasksChanged } from './production';
import { getUserFacingError } from '../utils/userFacingError';
import { isOfflineError } from '../utils/tasks';

/**
 * Отчёт по заданию (ТЗ, раздел 8). Без связи отчёт заполняется и отправляется: изменение и фото ложатся в очередь и
 * уходят при появлении связи (ИС-ФК-01, п. 8.6); фото до выгрузки — в папке приложения. Согласование, отклонение,
 * правка согласованного и готовность — только при связи (раздел 12, п. 18)
 */
const READ = { timeout: 15000 };
const WRITE = { timeout: 30000 };

export const reportsAPI = {
  show: async (taskId) => (await api.get(`/production/tasks/${taskId}/report`, READ)).data,
  save: async (taskId, body) => (await api.put(`/production/tasks/${taskId}/report`, body, WRITE)).data,
  approve: async (taskId, body) => (await api.post(`/production/tasks/${taskId}/report/approve`, body, WRITE)).data,
  reject: async (taskId, body) => (await api.post(`/production/tasks/${taskId}/report/reject`, body, WRITE)).data,
  correct: async (taskId, body) => (await api.post(`/production/tasks/${taskId}/report/correct`, body, WRITE)).data,
  removePhoto: async (taskId, photoId) => (await api.delete(`/production/tasks/${taskId}/report/photos/${photoId}`, WRITE)).data,
  addPhoto: async (taskId, { uri, name, mimeType }, extra = {}) => {
    const form = new FormData();
    form.append('photo', { uri, name: name || 'photo.jpg', type: mimeType || 'image/jpeg' });
    Object.entries(extra).forEach(([key, value]) => form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value)));
    return (await api.post(`/production/tasks/${taskId}/report/photos`, form, { timeout: 120000, headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  readiness: async (taskId, body) => (await api.post(`/production/tasks/${taskId}/readiness`, body, WRITE)).data,
  objectHistory: async (taskId) => (await api.get(`/production/tasks/${taskId}/object-history`, READ)).data,
  pending: async () => (await api.get('/production/reports/pending', READ)).data,
  due: async () => (await api.get('/production/reports/due', READ)).data,
  workTypes: async () => (await api.get('/production/work-types', READ)).data,
};

const newUuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// ---- Справочник видов работ: на устройстве последняя полученная версия (раздел 12, п. 19) ----

const CATALOG_KEY = '@workTypes';

export const loadWorkTypes = async () => {
  try {
    const items = (await reportsAPI.workTypes()).items || [];
    AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(items)).catch(() => {});
    return items;
  } catch {
    try {
      return JSON.parse((await AsyncStorage.getItem(CATALOG_KEY)) || '[]');
    } catch {
      return [];
    }
  }
};

// ---- Экран отчёта без связи: последний полученный с сервера и неотправленное своё ----

const SCREENS_KEY = '@reportScreens';
let screens = null;

const loadScreens = async () => {
  if (screens) return screens;
  try {
    screens = JSON.parse((await AsyncStorage.getItem(SCREENS_KEY)) || '{}');
  } catch {
    screens = {};
  }
  return screens;
};

const persistScreens = () => {
  const keys = Object.keys(screens || {});
  // Не больше 100 последних заданий
  keys.sort((a, b) => (screens[a].savedAt || 0) - (screens[b].savedAt || 0)).slice(0, Math.max(0, keys.length - 100))
    .forEach((key) => { delete screens[key]; });
  AsyncStorage.setItem(SCREENS_KEY, JSON.stringify(screens || {})).catch(() => {});
};

export const cachedReport = async (staffId, taskId) => {
  const entry = (await loadScreens())[`${staffId}:${taskId}`];
  return entry ? entry.data : null;
};

export const saveReportScreen = async (staffId, taskId, data) => {
  await loadScreens();
  screens[`${staffId}:${taskId}`] = { data, savedAt: Date.now() };
  persistScreens();
};

// ---- Очередь отправки: изменения отчёта и фото, по порядку ----

const OUTBOX_KEY = '@reportOutbox';
const RETRY_MS = 20000;
let queue = null;
let flushing = false;
let retryTimer = null;
const queueListeners = new Set();
const resultListeners = new Set();

const notify = () => queueListeners.forEach((listener) => listener(queue || []));

const load = async () => {
  if (queue) return queue;
  try {
    queue = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) || '[]');
  } catch {
    queue = [];
  }
  return queue;
};

const persist = () => AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue || [])).catch(() => {});

const scheduleRetry = () => {
  clearTimeout(retryTimer);
  if ((queue || []).some((item) => !item.failed)) retryTimer = setTimeout(() => flushReports(), RETRY_MS);
};

const photoDir = () => {
  const dir = new Directory(Paths.document, 'report-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const dropFile = (uri) => {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // файла уже нет
  }
};

const send = (item, offline) => {
  if (item.kind === 'save') return reportsAPI.save(item.taskId, { ...item.body, client_uuid: item.clientUuid, offline });
  return reportsAPI.addPhoto(item.taskId, item.file, { client_uuid: item.uuid, offline });
};

const finish = (item, data, error = null) => {
  queue = queue.filter((entry) => entry.uuid !== item.uuid);
  persist();
  notify();
  if (item.kind === 'photo' && (data || error)) dropFile(item.file.uri);
  if (data) {
    saveReportScreen(item.staffId, item.taskId, data);
    emitTasksChanged([item.date]);
    if (item.kind === 'save') settleRefused(item.staffId, item.taskId);
  }
  resultListeners.forEach((listener) => listener(item, data, error));
};

/**
 * Сервер не принял данные, внесённые без связи (П-ФК-44, п. 9.1, правила 3–4): заполненное остаётся на устройстве —
 * в очереди с причиной, без повторной отправки; открывается в отчёте и уходит заново после сохранения отчёта
 */
const refuse = (item, error) => {
  queue = markRefused(queue, item.uuid, error);
  persist();
  notify();
  resultListeners.forEach((listener) => listener(item, null, error));
};

/** Отчёт задания сохранён на сервере: прежний непринятый текст больше не нужен, непринятые фото — отправить снова */
const settleRefused = (staffId, taskId) => {
  const next = settleRefusedQueue(queue || [], staffId, taskId);
  if (next === queue) return;
  queue = next;
  persist();
  notify();
  flushReports();
};

/** Отправить ожидающее; ошибка сервера по одному заданию не держит остальные */
export const flushReports = async () => {
  if (flushing) return;
  flushing = true;
  try {
    await load();
    for (const item of [...queue]) {
      if (item.failed) continue;
      // Фото — после изменения отчёта того же задания: без отчёта его некуда прикрепить
      try {
        finish(item, await send(item, true));
      } catch (error) {
        const status = error?.response?.status;
        if (isOfflineError(error) || !status || status >= 500 || status === 429) break;
        refuse(item, getUserFacingError(error, 'Не принято'));
      }
    }
  } finally {
    flushing = false;
    scheduleRetry();
  }
};

/**
 * Сохранить или отправить отчёт автором. Нет связи — в очередь (последнее изменение задания заменяет прежнее).
 *
 * @returns {Promise<{data?: object, queued?: boolean}>}
 */
export const submitReport = async ({ staffId, taskId, date, body, clientUuid }) => {
  await load();
  try {
    const data = await reportsAPI.save(taskId, { ...body, client_uuid: clientUuid });
    saveReportScreen(staffId, taskId, data);
    settleRefused(staffId, taskId);
    return { data };
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    const previous = queue.find((item) => item.kind === 'save' && Number(item.taskId) === Number(taskId) && Number(item.staffId) === Number(staffId));
    // Отправка, ожидающая связи, не отменяется следующим сохранением; непринятая — не наследуется
    const merged = previous?.body?.submit && !previous.failed ? { ...body, submit: true } : body;
    const item = { uuid: newUuid(), kind: 'save', staffId, taskId, date, body: merged, clientUuid };
    queue = previous ? queue.map((entry) => (entry === previous ? item : entry)) : [...queue, item];
    persist();
    notify();
    scheduleRetry();
    return { queued: true };
  }
};

/** Фото в очередь: копия в папке приложения, выгрузка сразу или при появлении связи */
export const queuePhoto = async ({ staffId, taskId, date, asset }) => {
  await load();
  const uuid = newUuid();
  const target = new File(photoDir(), `${uuid}.jpg`);
  new File(asset.uri).copy(target);
  const item = { uuid, kind: 'photo', staffId, taskId, date, file: { uri: target.uri, name: `${uuid}.jpg`, mimeType: asset.mimeType || 'image/jpeg', width: asset.width, height: asset.height } };
  queue = [...queue, item];
  persist();
  notify();
  await flushReports();
  return item;
};

/** Убрать неотправленное фото из очереди */
export const cancelPhoto = async (uuid) => {
  await load();
  const item = queue.find((entry) => entry.uuid === uuid);
  if (!item) return;
  queue = queue.filter((entry) => entry.uuid !== uuid);
  persist();
  notify();
  dropFile(item.file.uri);
};

export const usePendingReports = (staffId, taskId) => {
  const [items, setItems] = useState(queue || []);
  useEffect(() => {
    queueListeners.add(setItems);
    load().then(() => setItems(queue));
    return () => queueListeners.delete(setItems);
  }, []);
  return items.filter((item) => Number(item.staffId) === Number(staffId) && Number(item.taskId) === Number(taskId));
};

/** Отправленное из очереди принято или отклонено сервером */
export const subscribeReportResult = (listener) => {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
};

/** Метка создания отчёта с телефона: повтор из очереди не создаёт второй отчёт */
export const reportClientUuid = async (staffId, taskId) => {
  const key = `@reportUuid:${staffId}:${taskId}`;
  let value = null;
  try {
    value = await AsyncStorage.getItem(key);
  } catch {
    value = null;
  }
  if (!value) {
    value = newUuid();
    AsyncStorage.setItem(key, value).catch(() => {});
  }
  return value;
};

// ---- Задания без отчёта: плашка вверху текущего дня (П-ЗД-37) ----

const DUE_KEY = '@reportsDue';
let due = [];
const dueListeners = new Set();

const setDue = (items) => {
  due = items;
  dueListeners.forEach((listener) => listener(due));
};

export const loadDueReports = async (staffId) => {
  try {
    const items = (await reportsAPI.due()).items || [];
    setDue(items);
    AsyncStorage.setItem(DUE_KEY, JSON.stringify({ staffId, items })).catch(() => {});
  } catch {
    if (!due.length) {
      try {
        const saved = JSON.parse((await AsyncStorage.getItem(DUE_KEY)) || 'null');
        if (saved && Number(saved.staffId) === Number(staffId)) setDue(saved.items || []);
      } catch {
        // сохранённого нет
      }
    }
  }
};

export const useDueReports = () => {
  const [value, setValue] = useState(due);
  useEffect(() => {
    dueListeners.add(setValue);
    setValue(due);
    return () => dueListeners.delete(setValue);
  }, []);
  return value;
};

/** Выход из учётки: очередь, кэш и фото прежнего сотрудника не должны остаться */
export const clearReportsState = async () => {
  clearTimeout(retryTimer);
  (queue || []).forEach((item) => item.kind === 'photo' && dropFile(item.file.uri));
  queue = [];
  screens = {};
  notify();
  setDue([]);
  const keys = (await AsyncStorage.getAllKeys().catch(() => [])).filter((key) => key.startsWith('@reportUuid:'));
  await AsyncStorage.multiRemove([OUTBOX_KEY, SCREENS_KEY, DUE_KEY, ...keys]).catch(() => {});
};

AppState.addEventListener('change', (state) => {
  if (state === 'active') flushReports();
});
