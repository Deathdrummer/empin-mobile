import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { getUserFacingError } from '../utils/userFacingError';
import { isOfflineError } from '../utils/tasks';

/**
 * Выход на смену (ТЗ, раздел 7): плашка, самоотметка, заявка состава, подтверждение в задании. Без связи действие лежит
 * в очереди с временем нажатия и уходит при появлении связи; засчитывается по времени нажатия (П-СМ-03а, п. 9.1)
 */

const WRITE = { timeout: 30000 };

export const attendanceAPI = {
  today: async () => (await api.get('/production/attendance/today', { timeout: 15000 })).data,
  mark: async (body) => (await api.post('/production/attendance/mark', body, WRITE)).data,
  crew: async (body) => (await api.post('/production/attendance/crew', body, WRITE)).data,
  confirm: async (taskId, body) => (await api.post(`/production/tasks/${taskId}/attendance`, body, WRITE)).data,
};

// ---- Плашка на сегодня: с сервера; без связи — последняя полученная ----

const TODAY_KEY = '@attendanceToday';
let todayValue = null;
let clockOffset = 0; // серверное время − время телефона, мс
const todayListeners = new Set();

const setToday = (value) => {
  todayValue = value;
  todayListeners.forEach((listener) => listener(todayValue));
};

export const loadAttendanceToday = async (staffId) => {
  try {
    const data = await attendanceAPI.today();
    const now = Date.parse(data?.now);
    if (!Number.isNaN(now)) clockOffset = now - Date.now();
    setToday({ ...data, staffId });
    AsyncStorage.setItem(TODAY_KEY, JSON.stringify({ ...data, staffId })).catch(() => {});
  } catch {
    if (!todayValue) {
      try {
        const saved = JSON.parse((await AsyncStorage.getItem(TODAY_KEY)) || 'null');
        if (saved && Number(saved.staffId) === Number(staffId)) setToday({ ...saved, offline: true });
      } catch {
        // сохранённого нет — плашка появится при связи
      }
    }
  }
  return todayValue;
};

export const useAttendanceToday = () => {
  const [value, setValue] = useState(todayValue);
  useEffect(() => {
    todayListeners.add(setValue);
    setValue(todayValue);
    return () => todayListeners.delete(setValue);
  }, []);
  return value;
};

/** «Сейчас» по серверу: окна 05:00–10:00 и с 10:00 считаются по серверному времени (п. 9.2) */
export const serverNow = () => new Date(Date.now() + clockOffset);

// ---- Очередь отправки ----

const OUTBOX_KEY = '@attendanceOutbox';
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

const newUuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const send = (item, offline) => {
  const body = {
    ...item.body,
    client_uuid: item.uuid,
    ...(offline ? { offline: true, pressed_at: item.pressedAt, device_now: new Date().toISOString() } : {}),
  };
  if (item.kind === 'mark') return attendanceAPI.mark(body);
  if (item.kind === 'crew') return attendanceAPI.crew(body);
  return attendanceAPI.confirm(item.taskId, body);
};

const scheduleRetry = () => {
  clearTimeout(retryTimer);
  if ((queue || []).length) retryTimer = setTimeout(() => flushAttendance(), RETRY_MS);
};

const finish = (item, result, error = null) => {
  queue = queue.filter((entry) => entry.uuid !== item.uuid);
  persist();
  notify();
  resultListeners.forEach((listener) => listener(item, result, error));
};

/** Отправить ожидающее по порядку: отметка раньше заявки и подтверждения */
export const flushAttendance = async () => {
  if (flushing) return;
  flushing = true;
  try {
    await load();
    for (const item of [...queue]) {
      try {
        finish(item, await send(item, true));
      } catch (error) {
        const status = error?.response?.status;
        if (isOfflineError(error) || !status || status >= 500 || status === 429) break;
        finish(item, null, getUserFacingError(error, 'Не принято'));
      }
    }
  } finally {
    flushing = false;
    scheduleRetry();
  }
};

/**
 * Отправить сразу; нет связи — в очередь с временем нажатия.
 *
 * @returns {Promise<{data?: object, queued?: boolean}>} ответ сервера или признак «уйдёт при появлении связи»
 */
export const submitAttendance = async ({ kind, taskId = null, body, staffId }) => {
  await load();
  const item = { uuid: newUuid(), kind, taskId, body, staffId, pressedAt: new Date().toISOString() };
  try {
    return { data: await send(item, false) };
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    queue = [...queue, item];
    persist();
    notify();
    scheduleRetry();
    return { queued: true };
  }
};

/** Неотправленное текущего сотрудника */
export const useAttendanceOutbox = (staffId) => {
  const [items, setItems] = useState(queue || []);
  useEffect(() => {
    queueListeners.add(setItems);
    load().then(() => setItems(queue));
    return () => queueListeners.delete(setItems);
  }, []);
  return items.filter((item) => Number(item.staffId) === Number(staffId));
};

/** Действие из очереди принято или отклонено сервером */
export const subscribeAttendanceResult = (listener) => {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
};

/** Выход из учётки: очередь и плашка прежнего сотрудника не должны остаться */
export const clearAttendanceState = async () => {
  clearTimeout(retryTimer);
  queue = [];
  notify();
  setToday(null);
  await AsyncStorage.multiRemove([OUTBOX_KEY, TODAY_KEY]).catch(() => {});
};

AppState.addEventListener('change', (state) => {
  if (state === 'active') flushAttendance();
});
