/**
 * Форматирование для мессенджера: имена, время, даты, длительность, размер файла.
 */
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEK_DAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad = (value) => String(value).padStart(2, '0');

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysAgo = (date, now = new Date()) =>
  Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

/** «Самсонов Артём» */
export const fullName = (person) => {
  if (!person) return 'Без имени';
  const name = [person.sname, person.fname].filter(Boolean).join(' ').trim();
  return name || 'Без имени';
};

/** «СА» */
export const initials = (person) => {
  if (!person) return '?';
  const letters = [person.sname, person.fname]
    .filter(Boolean)
    .map((part) => part.trim().charAt(0).toUpperCase())
    .join('');
  return letters || '?';
};

/** Время в пузыре: «16:03» */
export const formatMessageTime = (value) => {
  const date = toDate(value);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
};

/** Время в списке чатов: сегодня — «16:03», вчера — «вчера», за неделю — «пн», раньше — «12.10.26» */
export const formatListTime = (value, now = new Date()) => {
  const date = toDate(value);
  if (!date) return '';
  const ago = daysAgo(date, now);
  if (ago <= 0) return formatMessageTime(date);
  if (ago === 1) return 'вчера';
  if (ago < 7) return WEEK_DAYS_SHORT[date.getDay()];
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
};

/** Разделитель дат в переписке: «Сегодня», «Вчера», «12 октября», «12 октября 2025» */
export const formatDateSeparator = (value, now = new Date()) => {
  const date = toDate(value);
  if (!date) return '';
  const ago = daysAgo(date, now);
  if (ago === 0) return 'Сегодня';
  if (ago === 1) return 'Вчера';
  const label = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
};

export const isSameDay = (a, b) => {
  const first = toDate(a);
  const second = toDate(b);
  return Boolean(first && second)
    && first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
};

/** «0:12», «12:05» */
export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

/** «1,2 МБ» */
export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!size) return '';
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
};

/** Превью вложения в списке и цитате */
export const mediaLabel = (type) => ({
  image: 'Фото',
  video: 'Видео',
  audio: 'Голосовое сообщение',
  document: 'Документ',
  archive: 'Архив',
  file: 'Файл',
}[type] || '');
