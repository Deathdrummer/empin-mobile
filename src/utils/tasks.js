/**
 * Логика экранов заданий (ТЗ, раздел 6) без React: даты дня, права для кнопок, подписи плашек, история, фильтры
 * календаря и тело запроса формы
 */

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEK_DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/** Номера прав каталога ТЗ (п. 4.2.2) */
export const RIGHT = {
  TASK_CREATE: 1,
  TASK_EDIT_OWN: 2,
  TASK_EDIT_OTHERS: 4,
  TASK_INVITE: 7,
  TIMESHEET_VIEW: 19,
};

// ---- Даты: строка YYYY-MM-DD, без часовых поясов (дата задания — календарная дата организации) ----

const pad = (value) => String(value).padStart(2, '0');

export const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').slice(0, 10));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === match[0] ? date : null;
};

export const addDays = (key, days) => {
  const date = parseDateKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** Целых дней от a до b (b − a) */
export const daysBetween = (a, b) => {
  const from = parseDateKey(a);
  const to = parseDateKey(b);
  if (!from || !to) return 0;
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
};

/** «17 ноября», «вторник» и год, если он не текущий */
export const formatDay = (key, todayKey) => {
  const date = parseDateKey(key);
  if (!date) return { dateText: 'Дата не указана', weekDay: '', year: '' };
  const currentYear = (parseDateKey(todayKey) || new Date()).getFullYear();
  return {
    dateText: `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`,
    weekDay: WEEK_DAYS[date.getDay()],
    year: date.getFullYear() !== currentYear ? String(date.getFullYear()) : '',
  };
};

/** Коротко для строк и истории: «17 ноября» или «17 ноября 2025» */
export const formatDayShort = (key, todayKey) => {
  const { dateText, year } = formatDay(key, todayKey);
  return year ? `${dateText} ${year}` : dateText;
};

/** «Сегодня», «Завтра», «Вчера» или дата */
export const relativeDayLabel = (key, todayKey) => {
  const diff = daysBetween(todayKey, key);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return formatDayShort(key, todayKey);
};

/**
 * Сегодня по серверу (п. 9.2): последняя присланная сервером дата, сдвинутая на столько дней, сколько прошло по
 * телефону с её получения (приложение могло пережить полночь)
 */
export const currentToday = (serverDay, phoneToday) => {
  if (!serverDay?.today || !serverDay?.phoneDay) return phoneToday;
  return addDays(serverDay.today, Math.max(0, daysBetween(serverDay.phoneDay, phoneToday)));
};

/** Окно дней пейджера: от from до to включительно */
export const dayRange = (from, to) => {
  const days = [];
  for (let key = from, guard = 0; daysBetween(key, to) >= 0 && guard < 1000; key = addDays(key, 1), guard += 1) {
    days.push(key);
  }
  return days;
};

// ---- Права ----

export const hasRight = (me, right) => Array.isArray(me?.rights) && me.rights.some((grant) => Number(grant.right) === right);

/** «Добавить задание» и «Вставить»: право 1 и не прошедшая дата (П-ЗД-05) */
export const canCreateOn = (me, dateKey, todayKey) => hasRight(me, RIGHT.TASK_CREATE) && daysBetween(todayKey, dateKey) >= 0;

/** Справочники формы задания открыты обладателю прав 1, 2 или 4 (п. 5.2) */
export const canUseTaskForm = (me) => [RIGHT.TASK_CREATE, RIGHT.TASK_EDIT_OWN, RIGHT.TASK_EDIT_OTHERS].some((right) => hasRight(me, right));

// ---- Подписи ----

/** «Иванов Сергей Петрович» → «Иванов С. П.» */
export const shortName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const [surname, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0)}.`).join(' ');
  return initials ? `${surname} ${initials}` : surname;
};

export const executorTitle = (executor) => {
  if (!executor) return 'Исполнитель не указан';
  if (executor.type === 'brigade') return executor.name || 'Бригада';
  return executor.name || 'Сотрудник';
};

/** Вторая строка исполнителя: бригадир у бригады, «личное задание» у сотрудника */
export const executorSubtitle = (executor) => {
  if (!executor) return '';
  if (executor.type === 'brigade') return executor.foreman?.name ? `Бригадир: ${shortName(executor.foreman.name)}` : 'Бригада';
  return 'Личное задание';
};

export const objectTitle = (object) => {
  if (!object) return 'Объект';
  return [object.number, object.title].filter(Boolean).join(' · ') || 'Объект';
};

export const vehicleTitle = (vehicle) => {
  if (!vehicle) return '';
  return [vehicle.name, vehicle.plate].filter(Boolean).join(' · ') || 'Техника';
};

export const plural = (count, one, few, many) => {
  const n = Math.abs(Number(count) || 0) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
};

export const formatQuantity = (quantity, unit) => {
  if (quantity === null || quantity === undefined || quantity === '') return unit ? `— ${unit}` : '';
  const number = Number(quantity);
  const text = Number.isFinite(number) ? String(Math.round(number * 1000) / 1000).replace('.', ',') : String(quantity);
  return unit ? `${text} ${unit}` : text;
};

/** «85 %» — утверждённая готовность объекта; нет значения — пусто */
export const formatReadiness = (readiness) => {
  if (readiness === null || readiness === undefined) return '';
  const value = Math.round(Number(readiness) * 10) / 10;
  return `${String(value).replace('.', ',')} %`;
};

/** Ключ исполнителя: бригада или сотрудник */
export const executorKey = (executor) => (executor?.type === 'brigade' ? `b${executor.brigade_id}` : `s${executor?.staff_id}`);

/**
 * Задания дня по исполнителям — «карточки объектов для бригад», как в прежнем «Табеле»: порядок исполнителей —
 * по первому заданию, задания внутри — в порядке сервера.
 */
export const groupByExecutor = (tasks) => {
  const groups = [];
  const byKey = new Map();
  (tasks || []).forEach((task) => {
    const key = executorKey(task.executor);
    if (!byKey.has(key)) {
      const group = { key, executor: task.executor, tasks: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).tasks.push(task);
  });
  return groups;
};

// ---- История задания (журнал изменений, п. 6.6) ----

const FIELD_LABELS = {
  date: 'дата',
  object: 'объект',
  executor: 'исполнитель',
  text: 'текст',
  works: 'виды работ',
  vehicle: 'техника',
  driver: 'водитель',
};

const fieldValue = (field, value, todayKey) => {
  if (value === null || value === undefined || value === '') return 'нет';
  switch (field) {
    case 'date': return formatDayShort(value, todayKey);
    case 'object': return objectTitle(value);
    case 'executor': return executorTitle(value);
    case 'vehicle': return vehicleTitle(value);
    case 'driver': return value.name || 'водитель';
    case 'works': return Array.isArray(value) && value.length ? `${value.length} ${plural(value.length, 'вид', 'вида', 'видов')}` : 'нет';
    default: return '';
  }
};

/** Запись истории для карточки: заголовок, кто и подробности «было → стало» */
export const describeHistoryEntry = (entry, todayKey) => {
  const actor = entry?.actor?.name ? shortName(entry.actor.name) : 'Система';
  switch (entry?.action) {
    case 'created':
      return {
        title: entry.context?.copied_from ? 'Создание копированием' : 'Создание задания',
        actor,
        details: [],
      };
    case 'updated': {
      const fields = (entry.fields || entry.context?.fields || []).filter((field) => FIELD_LABELS[field]);
      const details = fields
        .filter((field) => field !== 'text' && field !== 'works')
        .map((field) => `${FIELD_LABELS[field][0].toUpperCase()}${FIELD_LABELS[field].slice(1)}: ${fieldValue(field, entry.before?.[field], todayKey)} → ${fieldValue(field, entry.after?.[field], todayKey)}`);
      return {
        title: fields.length ? `Изменение: ${fields.map((field) => FIELD_LABELS[field]).join(', ')}` : 'Изменение задания',
        actor,
        details,
      };
    }
    case 'invited':
      return { title: `Приглашение: ${shortName(entry.after?.staff?.name) || 'сотрудник'}`, actor, details: [] };
    case 'invite_revoked':
      return { title: `Отзыв приглашения: ${shortName(entry.before?.staff?.name) || 'сотрудник'}`, actor, details: [] };
    case 'deleted':
      return { title: 'Удаление задания', actor, details: [] };
    default:
      return { title: 'Изменение', actor, details: [] };
  }
};

/** Время записи истории: «17.11 14:05» */
export const formatStamp = (iso) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ---- Фильтры календаря (п. 6.4) ----

export const FILTER_KEYS = [
  { key: 'object', param: 'object_id', label: 'Объект' },
  { key: 'brigade', param: 'brigade_id', label: 'Бригада' },
  { key: 'executor', param: 'executor_staff_id', label: 'Сотрудник' },
  { key: 'creator', param: 'creator_id', label: 'Создатель' },
  { key: 'vehicle', param: 'vehicle_id', label: 'Техника' },
  { key: 'driver', param: 'driver_staff_id', label: 'Водитель' },
];

export const emptyFilters = () => ({});

/** Фильтры {object: {id, label}, …} → параметры запроса календаря */
export const filtersToParams = (filters) => FILTER_KEYS.reduce((params, { key, param }) => {
  const id = filters?.[key]?.id;
  if (id !== undefined && id !== null) params[param] = id;
  return params;
}, {});

export const filterTags = (filters) => FILTER_KEYS
  .filter(({ key }) => filters?.[key]?.id !== undefined && filters?.[key]?.id !== null)
  .map(({ key, label }) => ({ id: key, type: key, itemId: key, label: filters[key].label || label }));

export const hasFilters = (filters) => filterTags(filters).length > 0;

/** Ключ кэша дня с учётом фильтров: отфильтрованный день не подменяет полный */
export const filtersKey = (filters) => {
  const params = filtersToParams(filters);
  return Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
};

// ---- Форма задания ----

/** Начальное состояние формы: новое задание на дату или правка существующего */
export const formFromTask = (task, dateKey) => {
  if (!task) {
    return { date: dateKey, object: null, executor: null, text: '', works: [], vehicle: null, driver: null };
  }
  return {
    date: task.date,
    object: task.object || null,
    executor: task.executor || null,
    text: task.text || '',
    works: (task.works || []).map((work) => ({ ...work, quantity: work.quantity === null || work.quantity === undefined ? '' : String(work.quantity) })),
    vehicle: task.vehicle || null,
    driver: task.driver || null,
  };
};

const sameExecutor = (a, b) => {
  if (!a || !b || a.type !== b.type) return false;
  return a.type === 'brigade' ? Number(a.brigade_id) === Number(b.brigade_id) : Number(a.staff_id) === Number(b.staff_id);
};

const parseQuantity = (value) => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
};

const worksPayload = (works) => (works || []).map((work) => ({ work_type_id: work.work_type_id, quantity: parseQuantity(work.quantity) }));

const sameWorks = (a, b) => JSON.stringify(worksPayload(a)) === JSON.stringify(worksPayload(b));

/** Что не так в форме — первым сообщением; null, если можно сохранять */
export const validateForm = (form) => {
  if (!form.object) return 'Выберите объект';
  if (!form.date) return 'Выберите дату';
  if (!form.executor) return 'Выберите исполнителя';
  if (worksPayload(form.works).some((work) => Number.isNaN(work.quantity) || (work.quantity !== null && work.quantity < 0))) {
    return 'Неверное количество в видах работ';
  }
  return null;
};

/** Тело запроса: для нового задания — всё; для правки — только изменённые поля (сервер пишет их в журнал) */
export const buildTaskPayload = (form, original = null) => {
  const body = {};
  const executorBody = form.executor?.type === 'brigade'
    ? { brigade_id: form.executor.brigade_id }
    : { executor_staff_id: form.executor?.staff_id };
  const vehicleId = form.vehicle?.id ?? null;
  const driverId = form.vehicle ? (form.driver?.id ?? null) : null;
  const text = form.text.trim();

  if (!original) {
    Object.assign(body, { object_id: form.object.id, date: form.date, ...executorBody });
    if (text) body.text = text;
    if (form.works.length) body.works = worksPayload(form.works);
    if (vehicleId) body.vehicle_id = vehicleId;
    if (driverId) body.driver_id = driverId;
    return body;
  }

  if (Number(form.object?.id) !== Number(original.object?.id)) body.object_id = form.object.id;
  if (form.date !== original.date) body.date = form.date;
  if (!sameExecutor(form.executor, original.executor)) Object.assign(body, executorBody);
  if (text !== (original.text || '')) body.text = text;
  if (!sameWorks(form.works, original.works) || body.object_id !== undefined) body.works = worksPayload(form.works);
  const originalVehicle = original.vehicle?.id ?? null;
  const originalDriver = original.driver?.id ?? null;
  if (vehicleId !== originalVehicle || driverId !== originalDriver) {
    body.vehicle_id = vehicleId;
    body.driver_id = driverId;
  }
  return body;
};

/** Водитель для выбранной машины (ИС-ЗД-06): один закреплённый — сам; несколько — выбор; ни одного — без водителя */
export const driverForVehicle = (vehicle, drivers) => {
  const assigned = (vehicle?.driver_ids || []).map(Number);
  const candidates = (drivers || []).filter((driver) => assigned.includes(Number(driver.id)));
  if (candidates.length === 1) return { driver: candidates[0], choose: false, candidates };
  return { driver: null, choose: candidates.length > 1, candidates };
};

export const isDriverAssigned = (vehicle, driver) => !!driver
  && (vehicle?.driver_ids || []).map(Number).includes(Number(driver.id));

/** Предупреждения сервера, о которых пользователь ещё не знал (о чужом объекте и водителе он уже подтвердил в форме) */
export const unseenWarnings = (warnings, acknowledged) => (warnings || [])
  .filter((warning) => !(acknowledged || []).includes(warning.code))
  .map((warning) => warning.message)
  .filter(Boolean);

/** Ошибка без ответа сервера — нет связи (NetInfo в приложении нет) */
export const isOfflineError = (error) => !!error && !error.response && (!!error.request || error.message === 'Network Error');
