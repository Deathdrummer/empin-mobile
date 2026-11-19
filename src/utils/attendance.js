import { shortName } from './tasks.js';

/** Логика выхода на смену без React (ТЗ, раздел 7): окно отметки, выбор бригады, подписи статусов */

/** Минуты от начала суток по времени организации; смещение пояса берётся из серверного «сейчас» («…+03:00») */
export const orgMinutes = (serverNowIso, nowMs) => {
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(serverNowIso || '');
  const offset = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  const local = new Date(nowMs + offset * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + m;
};

/** Окно отметки 05:00–10:00 сейчас открыто (10:00 — уже нет) */
export const markWindowOpen = (state, nowMs) => {
  if (!state?.window) return false;
  const now = orgMinutes(state.now, nowMs);
  return now >= minutesOf(state.window.from) && now < minutesOf(state.window.to);
};

/** Подтверждение сегодняшнего выхода доступно с 10:00 */
export const confirmOpen = (confirmFrom, serverNowIso, nowMs) => !confirmFrom || orgMinutes(serverNowIso, nowMs) >= minutesOf(confirmFrom);

/**
 * Что выбрать при отметке: одна бригада — сразу; несколько — выбор бригады; водитель в бригаде — «в бригаде»
 * или «водителем» (П-СМ-04, П-СМ-20а)
 *
 * @returns {{key: string, title: string, body: object}[]}
 */
export const markChoices = (state) => {
  const brigades = state?.brigades || [];
  const choices = brigades.map((brigade) => ({
    key: `b${brigade.id}`,
    title: brigades.length > 1 || state?.driver ? brigade.name : 'В бригаде',
    body: { brigade_id: brigade.id, ...(state?.driver ? { as_driver: false } : {}) },
  }));
  if (state?.driver) choices.push({ key: 'driver', title: 'Водителем', body: { as_driver: true } });
  return choices;
};

/** Бригада, где сотрудник отметился, — её состав показывает плашка */
export const markedBrigade = (state) => (state?.mark?.brigade_id
  ? (state.brigades || []).find((brigade) => brigade.id === state.mark.brigade_id) || null
  : null);

export const markTitle = (mark) => (mark?.as_driver ? 'Водителем' : mark?.brigade_name || '');

export const crewText = (crew) => (crew || []).map((person) => shortName(person.name)).filter(Boolean).join(', ');

export const brigadeStatus = (brigade) => (brigade?.status === 'confirmed'
  ? `Подтверждено: ${shortName(brigade.confirmed_by?.name)}`
  : 'Не подтверждён');

export const driverStatus = (driver) => {
  switch (driver?.status) {
    case 'confirmed': return `Подтверждено: ${shortName(driver.confirmed_by?.name)}`;
    case 'in_brigade': return 'Отметился в бригаде';
    case 'not_marked': return 'Не отметился';
    default: return 'Не подтверждён';
  }
};

/** Служебные пометки для подтверждающего (П-СМ-11) */
export const personMarks = (person) => [
  person?.in_crew === false ? 'нет в заявке' : null,
  person?.offline ? 'без связи' : null,
  person?.time_unverified ? 'время не проверено' : null,
].filter(Boolean);

/**
 * Тело подтверждения: отмеченные в составе (снять можно, добавить нельзя) и список, который был на экране, —
 * без связи сервер подтверждает именно его (П-СМ-13а)
 */
export const confirmBody = (block, checkedIds, driverChecked) => {
  // Отметить можно только видимый состав; тех, кого бригадир не заявил, подтверждающий видит, но не добавляет
  const crew = block?.brigade?.can_confirm
    ? (block.brigade.crew || []).filter((person) => person.in_crew !== false).map((person) => person.id)
    : null;
  return {
    staff_ids: crew ? crew.filter((id) => checkedIds.includes(id)) : null,
    shown_staff_ids: crew,
    driver: !!(block?.driver?.can_confirm && driverChecked),
  };
};
