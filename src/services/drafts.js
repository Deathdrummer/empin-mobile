import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Черновики сообщений по чатам: недописанный текст сохраняется при выходе из чата
 * и показывается в списке «Черновик: …». Хранятся только на этом телефоне.
 */
export const DRAFTS_STORAGE_KEY = '@messengerDrafts';

let drafts = {};
let loadPromise = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(drafts));

const load = () => {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(DRAFTS_STORAGE_KEY)
      .then((raw) => {
        drafts = { ...(raw ? JSON.parse(raw) : {}), ...drafts };
      })
      .catch(() => {})
      .finally(notify);
  }
  return loadPromise;
};

export const getDraft = async (chatId) => {
  await load();
  return drafts[chatId] ?? '';
};

export const setDraft = (chatId, text) => {
  if (!chatId) return;
  const value = (text || '').trim() ? text : undefined;
  if (drafts[chatId] === value) return;

  drafts = { ...drafts };
  if (value === undefined) delete drafts[chatId];
  else drafts[chatId] = value;

  AsyncStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts)).catch(() => {});
  notify();
};

/** При выходе из аккаунта черновики не должны достаться следующему пользователю */
export const clearDrafts = () => {
  drafts = {};
  loadPromise = Promise.resolve();
  notify();
};

export const useDrafts = () => {
  const [value, setValue] = useState(drafts);

  useEffect(() => {
    listeners.add(setValue);
    load();
    setValue(drafts);
    return () => listeners.delete(setValue);
  }, []);

  return value;
};
