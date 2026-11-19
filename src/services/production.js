import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { currentToday, parseDateKey, toDateKey } from '../utils/tasks';

/**
 * Производственный модуль (ТЗ ЭМПИН-pro): запросы к /api/production и состояние вне React-дерева —
 * кэш для работы без связи, скопированное задание и событие «задания изменились».
 */
// Без таймаута запрос на слабой связи может висеть бесконечно, а календарь — крутить индикатор вместо сохранённого
const READ = { timeout: 15000 };
const WRITE = { timeout: 30000 };

export const productionAPI = {
  me: async () => (await api.get('/production/me', READ)).data,
  tasks: async (params) => (await api.get('/production/tasks', { ...READ, params })).data,
  taskDates: async (params) => (await api.get('/production/tasks/dates', { ...READ, params })).data,
  filterOptions: async () => (await api.get('/production/tasks/filters', READ)).data,
  task: async (id) => (await api.get(`/production/tasks/${id}`, READ)).data,
  createTask: async (body) => (await api.post('/production/tasks', body, WRITE)).data,
  updateTask: async (id, body) => (await api.patch(`/production/tasks/${id}`, body, WRITE)).data,
  deleteTask: async (id, readiness = null) => (await api.delete(`/production/tasks/${id}`, { ...WRITE, params: readiness ? { readiness } : undefined })).data,
  copyTask: async (id, date) => (await api.post(`/production/tasks/${id}/copy`, { date }, WRITE)).data,
  invite: async (id, staffId) => (await api.post(`/production/tasks/${id}/invites`, { staff_id: staffId }, WRITE)).data,
  revokeInvite: async (id, staffId) => (await api.delete(`/production/tasks/${id}/invites/${staffId}`, WRITE)).data,
  objects: async (params) => (await api.get('/production/objects', { ...READ, params })).data,
  plan: async (objectId) => (await api.get(`/production/objects/${objectId}/plan`, READ)).data,
  executors: async () => (await api.get('/production/executors', READ)).data,
  vehicles: async () => (await api.get('/production/vehicles', READ)).data,
  notifications: async () => (await api.get('/production/notifications', READ)).data,
  closeNotification: async (id) => (await api.post(`/production/notifications/${id}/close`, null, WRITE)).data,
};

// ---- Кэш для работы без связи (п. 9.1: календарь и загруженные задания открываются без связи) ----

export const PRODUCTION_CACHE_KEY = '@productionCache';
const MAX_DAYS = 120;
const MAX_TASKS = 200;

let cache = null;
let loading = null;
let saveTimer = null;

const currentStaffId = async () => {
  try {
    const raw = await AsyncStorage.getItem('user');
    return raw ? JSON.parse(raw)?.staff_id ?? null : null;
  } catch {
    return null;
  }
};

/** Кэш текущего сотрудника: чужой (после смены учётки на телефоне) не показывается */
const loadCache = async () => {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const staffId = await currentStaffId();
      let stored = null;
      try {
        stored = JSON.parse((await AsyncStorage.getItem(PRODUCTION_CACHE_KEY)) || 'null');
      } catch {
        stored = null;
      }
      cache = stored && stored.staffId === staffId ? stored : { staffId, me: null, days: {}, tasks: {} };
      loading = null;
      return cache;
    })();
  }
  return loading;
};

const prune = (map, limit) => {
  const keys = Object.keys(map);
  if (keys.length <= limit) return;
  keys.sort((a, b) => (map[a].savedAt || 0) - (map[b].savedAt || 0))
    .slice(0, keys.length - limit)
    .forEach((key) => { delete map[key]; });
};

const scheduleSave = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!cache) return;
    prune(cache.days, MAX_DAYS);
    prune(cache.tasks, MAX_TASKS);
    prune(cache.chats || {}, MAX_TASKS);
    AsyncStorage.setItem(PRODUCTION_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
  }, 500);
};

export const cachedMe = async () => (await loadCache()).me;

export const saveMe = async (me) => {
  const store = await loadCache();
  store.me = me;
  scheduleSave();
};

/** Задания дня из кэша: ключ — дата и фильтры */
export const cachedDays = async (keys) => {
  const store = await loadCache();
  return keys.reduce((result, key) => {
    if (store.days[key]) result[key] = store.days[key];
    return result;
  }, {});
};

export const saveDays = async (entries) => {
  const store = await loadCache();
  const savedAt = Date.now();
  Object.entries(entries).forEach(([key, items]) => { store.days[key] = { items, savedAt }; });
  scheduleSave();
};

/** Переписка задания — для просмотра без связи (п. 9.1) */
export const cachedChat = async (taskId) => ((await loadCache()).chats || {})[String(taskId)] || null;

export const saveChat = async (taskId, items) => {
  const store = await loadCache();
  store.chats = store.chats || {};
  store.chats[String(taskId)] = { items, savedAt: Date.now() };
  scheduleSave();
};

export const cachedTask = async (id) => (await loadCache()).tasks[String(id)] || null;

export const saveTask = async (id, data) => {
  const store = await loadCache();
  store.tasks[String(id)] = { ...data, savedAt: Date.now() };
  scheduleSave();
};

export const forgetTask = async (id) => {
  const store = await loadCache();
  delete store.tasks[String(id)];
  Object.values(store.days).forEach((day) => {
    day.items = (day.items || []).filter((item) => Number(item.id) !== Number(id));
  });
  scheduleSave();
};

/** Выход из учётки: кэш другого сотрудника не должен остаться в памяти */
export const resetProductionState = () => {
  clearTimeout(saveTimer);
  cache = null;
  loading = null;
  serverDay = null;
  setMe(null);
  setNotices([]);
  setCopiedTask(null);
};

// ---- «Кто я»: права из ERP с настройками. Без связи — последняя полученная версия (п. 9.1, правило 1) ----

let meValue = null;
const meListeners = new Set();

const setMe = (value) => {
  meValue = value;
  meListeners.forEach((listener) => listener(meValue));
};

export const refreshMe = async () => {
  try {
    const me = await productionAPI.me();
    setMe(me);
    saveMe(me);
    noteServerToday(me?.time?.today);
    return me;
  } catch {
    if (!meValue) setMe(await cachedMe());
    return meValue;
  }
};

export const useProductionMe = () => {
  const [value, setValue] = useState(meValue);
  useEffect(() => {
    meListeners.add(setValue);
    if (meValue) setValue(meValue);
    else refreshMe();
    return () => meListeners.delete(setValue);
  }, []);
  return value;
};

// ---- Сегодня по серверу в часовом поясе организации (п. 9.2), а не по часам телефона ----

let serverDay = null;
const dayListeners = new Set();

/** Дата «сегодня» из ответа сервера; запоминается вместе с датой телефона, чтобы после полуночи сдвинуться самой */
export const noteServerToday = (today) => {
  if (!parseDateKey(today)) return;
  const next = { today, phoneDay: toDateKey(new Date()) };
  if (serverDay?.today === next.today && serverDay?.phoneDay === next.phoneDay) return;
  serverDay = next;
  dayListeners.forEach((listener) => listener(getToday()));
};

export const getToday = () => currentToday(serverDay, toDateKey(new Date()));

export const useToday = () => {
  const [value, setValue] = useState(getToday);
  useEffect(() => {
    dayListeners.add(setValue);
    setValue(getToday());
    return () => dayListeners.delete(setValue);
  }, []);
  return value;
};

// ---- Уведомления до ручного закрытия: плашки на экране текущего дня и список (п. 6.6, п. 9.3, инт. 9.36) ----

let notices = [];
const noticeListeners = new Set();

const setNotices = (items) => {
  notices = items;
  noticeListeners.forEach((listener) => listener(notices));
};

/** С сервера; без связи — последние полученные (они висят до закрытия, и без связи тоже) */
export const loadNotifications = async () => {
  try {
    const items = (await productionAPI.notifications()).items || [];
    setNotices(items);
    const store = await loadCache();
    store.notices = items;
    scheduleSave();
  } catch {
    if (!notices.length) setNotices((await loadCache()).notices || []);
  }
};

/** Закрытие персональное: у других получателей уведомление остаётся */
export const closeNotification = async (id) => {
  await productionAPI.closeNotification(id);
  setNotices(notices.filter((item) => item.id !== id));
  const store = await loadCache();
  store.notices = notices;
  scheduleSave();
};

export const useNotifications = () => {
  const [value, setValue] = useState(notices);
  useEffect(() => {
    noticeListeners.add(setValue);
    setValue(notices);
    return () => noticeListeners.delete(setValue);
  }, []);
  return value;
};

// ---- Скопированное задание: «Копировать» в карточке, «Вставить» на нужном дне (П-ЗД-04) ----

let copiedTask = null;
const copiedListeners = new Set();

export const setCopiedTask = (task) => {
  copiedTask = task ? { id: task.id, object: task.object, executor: task.executor } : null;
  copiedListeners.forEach((listener) => listener(copiedTask));
};

export const useCopiedTask = () => {
  const [value, setValue] = useState(copiedTask);
  useEffect(() => {
    copiedListeners.add(setValue);
    setValue(copiedTask);
    return () => copiedListeners.delete(setValue);
  }, []);
  return value;
};

// ---- Задания изменились (создано, изменено, удалено) — календарь обновляет затронутые дни ----

const changeListeners = new Set();

export const emitTasksChanged = (dates = []) => {
  changeListeners.forEach((listener) => listener(dates.filter(Boolean)));
};

export const subscribeTasksChanged = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};
