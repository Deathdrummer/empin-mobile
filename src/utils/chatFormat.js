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

/** «Самсонов А.» — подпись автора в группе и в упоминании */
export const shortName = (person) => {
  if (!person) return 'Без имени';
  const initial = person.fname ? ` ${person.fname.trim().charAt(0)}.` : '';
  return `${person.sname || ''}${initial}`.trim() || 'Без имени';
};

/** «1 участник», «3 участника», «5 участников» */
export const plural = (count, one, few, many) => {
  const n = Math.abs(Number(count) || 0) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

/** «в сети», «был(а) 5 мин назад», «был(а) в 12:40», «был(а) вчера в 18:02», «был(а) 12 октября» */
export const formatLastSeen = (online, lastSeenAt, now = new Date()) => {
  if (online) return 'в сети';
  const date = toDate(lastSeenAt);
  if (!date) return 'был(а) давно';
  const minutes = Math.floor((now - date) / 60000);
  if (minutes < 1) return 'был(а) только что';
  if (minutes < 60) return `был(а) ${minutes} мин назад`;
  const ago = daysAgo(date, now);
  if (ago === 0) return `был(а) в ${formatMessageTime(date)}`;
  if (ago === 1) return `был(а) вчера в ${formatMessageTime(date)}`;
  return `был(а) ${formatDateSeparator(date, now)}`;
};

/** Короткая дата табеля для чата объекта: «16 окт» */
export const formatShortDay = (value) => {
  // «2026-10-16» — календарный день табеля, без сдвига по часовому поясу
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : toDate(value);
  if (!date) return '';
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()].slice(0, 3)}`;
};
