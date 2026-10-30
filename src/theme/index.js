import { useMemo, useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Оформление «Эмпин PRO»: светлая и тёмная темы в нескольких цветах. По умолчанию — фирменная
 * красная (цвет иконки). Светлая или тёмная по умолчанию следует настройке телефона
 * (app.json: userInterfaceStyle = automatic), переключатель в профиле закрепляет выбор.
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
  bubbleOutTrack: 'rgba(160, 65, 74, 0.3)',
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
  pattern: 'rgba(20, 21, 26, 0.085)',
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
  bubbleOutTrack: 'rgba(255, 210, 213, 0.3)',
  quoteBackground: 'rgba(255, 255, 255, 0.08)',
  dateChip: '#22222A',
  dateChipText: '#A8AAB0',
  inputBackground: '#24242B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  veil: 'rgba(13, 13, 16, 0.7)',
  fill: 'rgba(255, 255, 255, 0.07)',
  glass: 'rgba(22, 22, 26, 0.95)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  pattern: 'rgba(255, 255, 255, 0.055)',
  online: '#3FBF7F',
  shadow: 'rgba(0, 0, 0, 0)',
  sheet: '#1B1B20',
  reactionBackground: '#26262D',
  reactionBorder: '#34343C',
  reactionMine: '#4A1A1F',
  statusBar: 'light-content',
};

/**
 * Цвета оформления: акцент, свои сообщения, фон переписки и узор. Остальное — из светлой или тёмной темы.
 * «Опасные» действия (удалить, выйти) остаются красными в любом цвете.
 */
const PALETTES = [
  { key: 'brand', label: 'Фирменная', light: {}, dark: {} },
  {
    key: 'blue',
    label: 'Синяя',
    light: {
      accent: '#2F7FE0', accentPressed: '#1F68C2', accentText: '#1E64C8', accentSoft: '#E1EDFD',
      chatBackground: '#E5EBF1', pattern: 'rgba(28, 60, 104, 0.085)',
      bubbleOut: '#D9EAFF', bubbleOutMeta: '#4A6E9C', bubbleOutAccent: '#1E64C8', bubbleOutTrack: 'rgba(74, 110, 156, 0.3)',
      quoteBackground: 'rgba(47, 127, 224, 0.09)', reactionMine: '#E1EDFD',
    },
    dark: {
      accent: '#4C9BFF', accentPressed: '#3585EA', accentText: '#7DB6FF', accentSoft: '#14263F',
      chatBackground: '#0B0F15', pattern: 'rgba(150, 190, 255, 0.06)',
      bubbleOut: '#22508A', bubbleOutMeta: '#B5CDEB', bubbleOutAccent: '#D6E7FF', bubbleOutTrack: 'rgba(214, 231, 255, 0.3)',
      reactionMine: '#1C3554',
    },
  },
  {
    key: 'green',
    label: 'Зелёная',
    light: {
      accent: '#1E9E62', accentPressed: '#168452', accentText: '#137A4A', accentSoft: '#DDF4E8',
      chatBackground: '#ECE6DD', pattern: 'rgba(70, 58, 36, 0.085)',
      bubbleOut: '#DCF8D4', bubbleOutMeta: '#4E7F5C', bubbleOutAccent: '#137A4A', bubbleOutTrack: 'rgba(78, 127, 92, 0.3)',
      quoteBackground: 'rgba(30, 158, 98, 0.09)', reactionMine: '#DDF4E8',
    },
    dark: {
      accent: '#2FBF7A', accentPressed: '#25A468', accentText: '#5ED69B', accentSoft: '#12301F',
      chatBackground: '#0B1110', pattern: 'rgba(190, 255, 220, 0.055)',
      bubbleOut: '#0F5A40', bubbleOutMeta: '#A8D8BE', bubbleOutAccent: '#C9F2DA', bubbleOutTrack: 'rgba(201, 242, 218, 0.3)',
      reactionMine: '#173B29',
    },
  },
  {
    key: 'violet',
    label: 'Фиолетовая',
    light: {
      accent: '#7B4FD6', accentPressed: '#683DC0', accentText: '#5E37B8', accentSoft: '#EEE6FD',
      chatBackground: '#ECE8F3', pattern: 'rgba(64, 40, 110, 0.085)',
      bubbleOut: '#E9DEFF', bubbleOutMeta: '#6E58A0', bubbleOutAccent: '#5E37B8', bubbleOutTrack: 'rgba(110, 88, 160, 0.3)',
      quoteBackground: 'rgba(123, 79, 214, 0.09)', reactionMine: '#EEE6FD',
    },
    dark: {
      accent: '#9D7BFF', accentPressed: '#8866F0', accentText: '#B9A0FF', accentSoft: '#241A3D',
      chatBackground: '#0E0C14', pattern: 'rgba(210, 190, 255, 0.055)',
      bubbleOut: '#46307E', bubbleOutMeta: '#CDBDF5', bubbleOutAccent: '#E3D8FF', bubbleOutTrack: 'rgba(227, 216, 255, 0.3)',
      reactionMine: '#2E2150',
    },
  },
  {
    key: 'orange',
    label: 'Оранжевая',
    light: {
      accent: '#E8730C', accentPressed: '#CC6309', accentText: '#B95A07', accentSoft: '#FDEBDA',
      chatBackground: '#EFEAE3', pattern: 'rgba(90, 56, 20, 0.085)',
      bubbleOut: '#FFE6CF', bubbleOutMeta: '#9C5E28', bubbleOutAccent: '#B95A07', bubbleOutTrack: 'rgba(156, 94, 40, 0.3)',
      quoteBackground: 'rgba(232, 115, 12, 0.09)', reactionMine: '#FDEBDA',
    },
    dark: {
      accent: '#FF8A2A', accentPressed: '#EA7716', accentText: '#FFA65C', accentSoft: '#3A230F',
      chatBackground: '#100D0A', pattern: 'rgba(255, 220, 190, 0.055)',
      bubbleOut: '#7A3E10', bubbleOutMeta: '#F2C9A5', bubbleOutAccent: '#FFE0C7', bubbleOutTrack: 'rgba(255, 224, 199, 0.3)',
      reactionMine: '#4A2A10',
    },
  },
  {
    key: 'teal',
    label: 'Бирюзовая',
    light: {
      accent: '#0E9AA7', accentPressed: '#0A8390', accentText: '#0A7882', accentSoft: '#DAF2F3',
      chatBackground: '#E5EDED', pattern: 'rgba(18, 70, 74, 0.085)',
      bubbleOut: '#D3F1F2', bubbleOutMeta: '#3D7C80', bubbleOutAccent: '#0A7882', bubbleOutTrack: 'rgba(61, 124, 128, 0.3)',
      quoteBackground: 'rgba(14, 154, 167, 0.09)', reactionMine: '#DAF2F3',
    },
    dark: {
      accent: '#2CC4D0', accentPressed: '#1DAEB9', accentText: '#5DD6DF', accentSoft: '#0F2E31',
      chatBackground: '#0A1112', pattern: 'rgba(190, 250, 255, 0.055)',
      bubbleOut: '#0F5258', bubbleOutMeta: '#A5DADF', bubbleOutAccent: '#CFF3F5', bubbleOutTrack: 'rgba(207, 243, 245, 0.3)',
      reactionMine: '#133A3E',
    },
  },
];

/** Цвета оформления для выбора в профиле: ключ, название и образец (акцент и своё сообщение) */
export const palettes = PALETTES.map(({ key, label }) => ({
  key,
  label,
  swatch: { ...light, ...PALETTES.find((item) => item.key === key).light },
}));

// Все сочетания собраны заранее: тема — один и тот же объект, стили не пересоздаются зря
const THEMES = Object.fromEntries(PALETTES.map((palette) => [palette.key, {
  light: { ...light, ...palette.light, palette: palette.key },
  dark: { ...dark, ...palette.dark, palette: palette.key },
}]));

const DEFAULT_PALETTE = 'brand';
const PALETTE_STORAGE_KEY = '@themePalette';
let currentPalette = DEFAULT_PALETTE;
const paletteListeners = new Set();

const subscribePalette = (listener) => {
  paletteListeners.add(listener);
  return () => paletteListeners.delete(listener);
};

const getPalette = () => currentPalette;

const applyPalette = (key) => {
  if (!THEMES[key] || key === currentPalette) return;
  currentPalette = key;
  paletteListeners.forEach((listener) => listener());
};

/** Выбрать цвет оформления — сразу во всём приложении, запоминается на телефоне */
export const setPalettePreference = (key) => {
  applyPalette(key);
  AsyncStorage.setItem(PALETTE_STORAGE_KEY, key).catch(() => {});
};

export const useTheme = () => {
  const scheme = useColorScheme();
  const palette = useSyncExternalStore(subscribePalette, getPalette);
  return THEMES[palette][scheme === 'dark' ? 'dark' : 'light'];
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

/** Восстанавливает выбранные тему и цвет при запуске, пока показывается экран загрузки */
export const restoreThemePreference = async () => {
  try {
    const [[, scheme], [, palette]] = await AsyncStorage.multiGet([THEME_STORAGE_KEY, PALETTE_STORAGE_KEY]);
    if (scheme === 'light' || scheme === 'dark') Appearance.setColorScheme(scheme);
    if (palette) applyPalette(palette);
  } catch {
    // Нет сохранённого выбора — тема как в системе, цвет фирменный
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

/** Цвет темы (#RRGGBB) с прозрачностью — для затуханий и подложек */
export const withAlpha = (hex, alpha) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!match) return hex;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
};

export const radius = {
  bubble: 18,
  card: 14,
  pill: 999,
};
