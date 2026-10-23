import { Platform, StatusBar } from 'react-native';

/**
 * На Android приложение работает без строки состояния (во весь экран), на iPhone она видна:
 * без неё содержимое заходит под «чёлку» и в скруглённые углы экрана.
 */
export const STATUS_BAR_HIDDEN = Platform.OS === 'android';

/** Системные окна (камера, галерея, файлы) показывают строку состояния — после них прячем снова */
export const restoreStatusBar = () => {
  if (STATUS_BAR_HIDDEN) StatusBar.setHidden(true);
};
