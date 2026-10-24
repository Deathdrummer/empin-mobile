import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * «При открытии приложения показывать чаты» (по умолчанию — табель).
 * Хранится на сервере (одинаково на всех устройствах) и копией на телефоне: при запуске решение
 * нужно сразу, без ожидания сети.
 */
const STORAGE_KEY = '@openChatsOnStart';

export const getOpenChatsOnStart = async () => {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'on';
  } catch {
    return false;
  }
};

export const setOpenChatsOnStart = (value) =>
  AsyncStorage.setItem(STORAGE_KEY, value ? 'on' : 'off').catch(() => {});

export const START_SCREEN_STORAGE_KEY = STORAGE_KEY;
