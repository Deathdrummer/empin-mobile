const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const WEEK_DAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

const parseCalendarDate = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const formatTimesheetDay = (item) => {
  const date = parseCalendarDate(item?.day);

  if (!date) {
    return {
      dateText: 'Дата не указана',
      weekDay: '',
      year: '',
    };
  }

  return {
    dateText: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
    weekDay: WEEK_DAYS[date.getDay()],
    year: String(date.getFullYear()),
  };
};

export const formatDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${day}.${month}.${year}`;
};

export const formatEditTime = (createdAt, updatedAt) => {
  if (!updatedAt) return '';

  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return '';

  const hours = String(updated.getHours()).padStart(2, '0');
  const minutes = String(updated.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;

  if (!createdAt) return time;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime()) || created.toDateString() === updated.toDateString()) {
    return time;
  }

  const day = String(updated.getDate()).padStart(2, '0');
  const month = String(updated.getMonth() + 1).padStart(2, '0');
  return `${time} ${day}.${month}`;
};
