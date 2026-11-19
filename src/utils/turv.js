/** Логика ТУРВ без React (ТЗ, раздел 7): месяцы, обозначения ячеек, перестановки, порядок для сервера */

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const monthOf = (dateKey) => String(dateKey || '').slice(0, 7);

export const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const monthTitle = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** Обозначение в ячейке: «Р» — выход, пусто — нет, «—» — дата недоступна по правам, «?» — неподтверждённая отметка */
export const cellText = (code) => ({ R: 'Р', '-': '—', '?': '?' })[code] ?? '';

/** Ячейку можно исправить: дата в пределах права 18 этого раздела и не закрыта правами просмотра */
export const canCorrectCell = (section, date, code) => !!section?.correct_dates?.includes(date) && code !== '-';

export const isWeekend = (date) => date.weekday >= 6;

/** Переставить элемент на шаг вверх или вниз (режим «Изменить порядок») */
export const move = (items, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Переставить бригадный раздел: бригады всегда выше «Водителей» и персонального (П-СМ-29) */
export const moveSection = (sections, key, delta) => {
  const brigades = sections.filter((s) => s.type === 'brigade');
  const index = brigades.findIndex((s) => s.key === key);
  if (index < 0) return sections;
  return [...move(brigades, index, delta), ...sections.filter((s) => s.type !== 'brigade')];
};

export const moveRow = (sections, key, staffId, delta) => sections.map((section) => {
  if (section.key !== key) return section;
  const index = section.rows.findIndex((row) => row.staff_id === staffId);
  return index < 0 ? section : { ...section, rows: move(section.rows, index, delta) };
});

/** Порядок для сервера: бригады и строки каждого раздела — как сейчас на экране */
export const orderOf = (sections) => ({
  brigade_ids: sections.filter((s) => s.type === 'brigade').map((s) => s.brigade_id),
  rows: sections.reduce((rows, section) => ({ ...rows, [section.key]: section.rows.map((row) => row.staff_id) }), {}),
});

/** Число выходов в строке */
export const totalOf = (row) => (row?.cells || []).filter((code) => code === 'R').length;
