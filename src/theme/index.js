import { useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Фирменная палитра «Эмпин PRO»: красный акцент из иконки, светлая и тёмная темы.
 * По умолчанию тема следует настройке телефона (app.json: userInterfaceStyle = automatic),
 * переключатель в профиле закрепляет светлую или тёмную.
 */
const brand = {
  accent: '#E3262F',
  accentPressed: '#C21D25',
  onAccent: '#FFFFFF',
  danger: '#E3262F',
  success: '#2E9E6A',
};

const light = {
  ...brand,
  dark: false,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F5',
  surfacePressed: '#F4F4F6',
  separator: '#E7E7EB',
  text: '#14151A',
  textSecondary: '#6B6F76',
  textMuted: '#9A9DA4',
  accentText: '#C7151E',
  accentSoft: '#FDE4E5',
  chatBackground: '#EFECEB',
  bubbleIn: '#FFFFFF',
  bubbleInText: '#14151A',
  bubbleInMeta: '#8A8D94',
  bubbleOut: '#FFE0E2',
  bubbleOutText: '#14151A',
  bubbleOutMeta: '#A0414A',
  bubbleOutAccent: '#C7151E',
  quoteBackground: 'rgba(227, 38, 47, 0.08)',
  dateChip: 'rgba(20, 21, 26, 0.08)',
  dateChipText: '#55585F',
  inputBackground: '#F1F1F4',
  overlay: 'rgba(10, 10, 12, 0.45)',
  veil: 'rgba(255, 255, 255, 0.75)',
  fill: 'rgba(20, 21, 26, 0.05)',
  // Фон панелей там, где нет размытия (Android до 12): плотный, чтобы текст под панелью не двоился
  glass: 'rgba(255, 255, 255, 0.95)',
  glassBorder: 'rgba(20, 21, 26, 0.08)',
  pattern: 'rgba(20, 21, 26, 0.07)',
  online: '#2E9E6A',
  shadow: 'rgba(20, 21, 26, 0.08)',
  sheet: '#FFFFFF',
  reactionBackground: '#FFFFFF',
  reactionBorder: '#E6E6EA',
  reactionMine: '#FDE4E5',
  statusBar: 'dark-content',
};

const dark = {
  ...brand,
  dark: true,
  background: '#0D0D10',
  surface: '#16161A',
  surfaceAlt: '#222228',
  surfacePressed: '#1E1E23',
  separator: '#26262C',
  text: '#F2F2F4',
  textSecondary: '#A5A7AE',
  textMuted: '#6E7078',
  accent: '#FF3B42',
  accentText: '#FF6A70',
  accentSoft: '#3A1418',
  chatBackground: '#0D0D10',
  bubbleIn: '#1F1F25',
  bubbleInText: '#F2F2F4',
  bubbleInMeta: '#8D8F96',
  bubbleOut: '#7D1B22',
  bubbleOutText: '#FFFFFF',
  bubbleOutMeta: '#F3B8BC',
  bubbleOutAccent: '#FFD2D5',
  quoteBackground: 'rgba(255, 255, 255, 0.08)',
  dateChip: '#22222A',
  dateChipText: '#A8AAB0',
  inputBackground: '#24242B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  veil: 'rgba(13, 13, 16, 0.7)',
  fill: 'rgba(255, 255, 255, 0.07)',
  glass: 'rgba(22, 22, 26, 0.95)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  pattern: 'rgba(255, 255, 255, 0.05)',
  online: '#3FBF7F',
  shadow: 'rgba(0, 0, 0, 0)',
  sheet: '#1B1B20',
  reactionBackground: '#26262D',
  reactionBorder: '#34343C',
  reactionMine: '#4A1A1F',
  statusBar: 'light-content',
};

export const themes = { light, dark };

export const useTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
};

const THEME_STORAGE_KEY = '@themePreference';

/**
 * Выбранная вручную тема. Appearance.setColorScheme переключает и системные элементы
 * (диалоги, клавиатуру), а useColorScheme во всём приложении сразу отдаёт новую тему.
 */
export const setThemePreference = (scheme) => {
  Appearance.setColorScheme(scheme);
  AsyncStorage.setItem(THEME_STORAGE_KEY, scheme).catch(() => {});
};

/** Восстанавливает выбранную тему при запуске, пока показывается экран загрузки */
export const restoreThemePreference = async () => {
  try {
    const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') Appearance.setColorScheme(saved);
  } catch {
    // Нет сохранённого выбора — тема как в системе
  }
};

/**
 * Стили, зависящие от темы: factory(theme) => StyleSheet.create(...), объявленная вне компонента.
 * Пересоздаются только при смене темы.
 */
export const useThemedStyles = (factory) => {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
};

// Цвет аватара стабилен для сотрудника: один и тот же человек всегда одного цвета
const AVATAR_COLORS = ['#E3262F', '#5B6B8C', '#2F8A6C', '#8A5BB0', '#C46A1B', '#1F7FA8', '#B23A6E', '#4E7A2B'];

export const avatarColor = (id) => {
  const index = Math.abs(Number(id) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export const radius = {
  bubble: 18,
  card: 14,
  pill: 999,
};
