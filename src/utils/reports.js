/**
 * Логика отчёта по заданию (ТЗ, раздел 8) без React: статусы, позиции, превышение проекта и работы вне плана по
 * правам 11–14, какие кнопки показать, тело запроса
 */
import { formatQuantity, formatReadiness, shortName } from './tasks.js';

export const REPORT_STATUS = {
  draft: 'Черновик',
  submitted: 'Отправлен',
  approved: 'Согласован',
  rejected: 'Отклонён',
};

export const reportStatusTitle = (status) => REPORT_STATUS[status] || 'Нет отчёта';

/**
 * Отметка в плане-графике (FR9-026): статус отчёта; «нет отчёта» у прошедшего задания без предоставленного
 * (П-ЗД-37). tone — цвет темы: danger, accent, success, muted
 */
export const reportMark = (mark) => {
  if (!mark) return null;
  if (!mark.status) return { title: 'Нет отчёта', tone: mark.missing ? 'danger' : 'muted' };
  const tone = mark.missing ? 'danger' : ({ approved: 'success', submitted: 'accent', rejected: 'danger' }[mark.status] || 'muted');
  return { title: REPORT_STATUS[mark.status], tone };
};

/** Число из поля: «12,5» → 12.5; пусто → null; не число → NaN */
export const parseNumber = (text) => {
  const value = String(text ?? '').replace(/\s/g, '').replace(',', '.').replace('%', '');
  if (value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

/** Процент 0–100 или null; ошибка — текстом */
export const checkPercent = (text) => {
  const value = parseNumber(text);
  if (value === null) return { value: null };
  if (Number.isNaN(value) || value < 0 || value > 100) return { error: 'Процент — число от 0 до 100' };
  return { value: Math.round(value * 100) / 100 };
};

export const percentText = (value) => (value === null || value === undefined ? '' : String(value).replace('.', ','));

/**
 * Что пользователь делает с отчётом: create — создаёт, edit — правит свой несогласованный, approve — согласует чужой
 * (или свой, если он и заявитель, и согласующий), correct — правит согласованный (право 10), view — только смотрит
 */
export const reportMode = (report, abilities = {}) => {
  if (!report) return abilities.create ? 'create' : 'view';
  if (abilities.edit) return 'edit';
  if (abilities.approve) return 'approve';
  if (abilities.correct) return 'correct';
  return 'view';
};

/** Строки редактора: из отчёта; нового — из видов работ задания (П-ФК-04: можно добавить из плана объекта) */
export const rowsFrom = (report, task, mode) => {
  if (!report) {
    return (task?.works || []).map((work) => ({ work_type_id: work.work_type_id, name: work.name, unit: work.unit, declared: null, approved: null, quantity: '' }));
  }
  return (report.items || []).map((item) => {
    // Согласующий и правка согласованного вводят согласованное (по умолчанию — заявленное), автор — заявленное
    const value = mode === 'approve' || mode === 'correct' ? (item.approved ?? item.declared) : item.declared;
    return { ...item, quantity: value === null || value === undefined ? '' : String(value).replace('.', ',') };
  });
};

/**
 * Проверка позиции по плану объекта и согласованному (П-ФК-20, П-ФК-21): превышение и работа вне плана; у объекта
 * без плана не проверяется (П-ФК-04). approving — права согласовать (12, 14), иначе заявить (11, 13).
 */
export const checkRow = (row, context, abilities = {}, approving = false) => {
  const quantity = parseNumber(row.quantity);
  const plan = context?.plan;
  const planItem = plan ? plan.find((item) => Number(item.work_type_id) === Number(row.work_type_id)) : null;
  const done = Number(context?.approved?.[row.work_type_id] ?? context?.approved?.[String(row.work_type_id)] ?? 0);
  const result = {
    quantity,
    invalid: Number.isNaN(quantity) || (quantity !== null && quantity < 0),
    planned: planItem ? Number(planItem.quantity) : null,
    done,
    offPlan: !!plan && !planItem,
    overage: false,
    blocked: false,
  };
  if (planItem && quantity > 0 && Math.round((done + quantity) * 1000) / 1000 > Number(planItem.quantity)) result.overage = true;
  const canOverage = approving ? abilities.approve_overage : abilities.declare_overage;
  const canOffPlan = approving ? abilities.approve_off_plan : abilities.declare_off_plan;
  result.blocked = (result.overage && !canOverage) || (result.offPlan && !canOffPlan);
  return result;
};

/** Предупреждение у позиции — текстом, как требует ТЗ (П-ФК-20) */
export const rowWarning = (check) => {
  if (check.offPlan) return 'Нет в плане объекта';
  if (check.overage) return 'Больше проекта';
  return null;
};

/**
 * Подпись под позицией: план объекта и согласовано по объекту (ИС-ФК-10). own — количество самого отчёта, если он
 * уже согласован (накопительный факт включает его)
 */
export const rowPlanText = (row, check, own = 0) => {
  const parts = [];
  if (check.planned !== null) parts.push(`План: ${formatQuantity(check.planned, row.unit)}`);
  parts.push(`Согласовано: ${formatQuantity(Math.round((check.done + (Number(own) || 0)) * 1000) / 1000, row.unit)}`);
  return parts.join(' · ');
};

/**
 * Какие решения доступны в текущем содержимом: «Согласовать» — если вправе согласовать и нет запрета по правам 12/14;
 * иначе заявитель «Отправить» (П-ФК-13, раздел 12, п. 26)
 */
export const decisionButtons = ({ report, mode, abilities = {}, rows, context }) => {
  const declareBlocked = rows.some((row) => checkRow(row, context, abilities, false).blocked);
  const approveBlocked = rows.some((row) => checkRow(row, context, abilities, true).blocked);
  const status = report?.status || null;
  if (mode === 'create' || mode === 'edit') {
    const canApprove = abilities.approver && (mode === 'create' || abilities.approve) && !approveBlocked;
    return {
      save: true,
      approve: canApprove,
      submit: !canApprove && status !== 'submitted',
      submitBlocked: declareBlocked,
      reject: false,
    };
  }
  if (mode === 'approve') {
    return { save: false, approve: true, approveBlocked, submit: false, reject: !!abilities.reject };
  }
  return { save: false, approve: false, submit: false, reject: false };
};

/** Тело запроса: позиции и проценты из полей */
export const reportBody = (rows, form) => ({
  text: form.text?.trim() ? form.text : null,
  task_percent: checkPercent(form.taskPercent).value ?? null,
  object_percent: checkPercent(form.objectPercent).value ?? null,
  items: rows.map((row) => ({ work_type_id: row.work_type_id, quantity: parseNumber(row.quantity) })),
});

/** Ошибка заполнения перед отправкой; null — можно отправлять */
export const validateReport = (rows, form, requireQuantity) => {
  for (const row of rows) {
    const value = parseNumber(row.quantity);
    if (Number.isNaN(value) || (value !== null && value < 0)) return `${row.name || 'Вид работ'}: количество — число не меньше нуля`;
    if (requireQuantity && value === null) return 'Укажите количество в каждой позиции';
  }
  return checkPercent(form.taskPercent).error || checkPercent(form.objectPercent).error || null;
};

/** Виды работ для добавления: из плана объекта, остальные из справочника — если плана нет или есть право (П-ФК-04) */
export const workSections = (context, catalog, rows, canOffPlan) => {
  const used = new Set(rows.map((row) => Number(row.work_type_id)));
  const plan = context?.plan;
  const planIds = new Set((plan || []).map((item) => Number(item.work_type_id)));
  const sections = [];
  if (plan) {
    sections.push({
      key: 'plan',
      title: 'План объекта',
      data: plan.filter((item) => !used.has(Number(item.work_type_id))).map((item) => ({
        key: `p${item.work_type_id}`,
        work: { work_type_id: item.work_type_id, name: item.name, unit: item.unit },
        title: item.name,
        subtitle: `План: ${formatQuantity(item.quantity, item.unit)}`,
        search: item.name,
      })),
    });
  }
  if (!plan || canOffPlan) {
    sections.push({
      key: 'catalog',
      title: plan ? 'Справочник' : null,
      data: (catalog || []).filter((type) => !used.has(Number(type.id)) && !planIds.has(Number(type.id))).map((type) => ({
        key: `c${type.id}`,
        work: { work_type_id: type.id, name: type.name, unit: type.unit },
        title: type.name,
        subtitle: type.unit,
        search: type.name,
      })),
    });
  }
  return sections.filter((section) => section.data.length);
};

/** «Кто что сделал» в шапке отчёта (П-ФК-19) */
export const reportPeople = (report) => {
  if (!report) return [];
  const lines = [];
  const at = (iso) => {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `, ${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  if (report.author) lines.push(`Создал: ${shortName(report.author.name)}`);
  if (report.submitted_by) lines.push(`Заявил: ${shortName(report.submitted_by.name)}${at(report.submitted_at)}`);
  if (report.decided_by && report.status === 'approved') lines.push(`Согласовал: ${shortName(report.decided_by.name)}${at(report.decided_at)}`);
  if (report.decided_by && report.status === 'rejected') lines.push(`Отклонил: ${shortName(report.decided_by.name)}${at(report.decided_at)}`);
  if (report.edited_by) lines.push(`Изменено: ${shortName(report.edited_by.name)}${at(report.edited_at)}`);
  return lines;
};

/** Процент для шкалы: «30 %», предварительный — с пометкой (П-ФК-30) */
export const scaleText = (value, approved) => {
  const text = formatReadiness(value ?? 0) || '0 %';
  return approved ? text : `${text} · предварительно`;
};

const ACTIONS = {
  created: 'Создание отчёта',
  saved: 'Изменение',
  submitted: 'Отправка на согласование',
  approved: 'Согласование',
  rejected: 'Отклонение',
  corrected: 'Правка согласованного',
  photo_added: 'Добавлено фото',
  photo_removed: 'Удалено фото',
  author_locked: 'Смена исполнителя',
  deleted: 'Удаление',
};

/** Запись истории отчёта: что, подробности «было → стало» по количествам */
export const describeReportEntry = (entry) => {
  const title = ACTIONS[entry?.action] || 'Изменение';
  const details = [];
  const before = new Map((entry?.before?.items || []).map((item) => [item.work_type_id, item]));
  const after = new Map((entry?.after?.items || []).map((item) => [item.work_type_id, item]));
  const key = entry?.action === 'approved' || entry?.action === 'corrected' ? 'approved' : 'declared';
  if (entry?.before && entry?.after) {
    after.forEach((item, id) => {
      const was = before.get(id);
      const old = was ? (key === 'approved' && entry.action === 'approved' ? was.declared : was[key]) : null;
      if (!was || old !== item[key]) details.push(`${item.name}: ${formatQuantity(old, item.unit)} → ${formatQuantity(item[key], item.unit)}`);
    });
    before.forEach((item, id) => {
      if (!after.has(id)) details.push(`${item.name}: снято`);
    });
  }
  if (entry?.action === 'rejected' && entry?.after?.reject_comment) details.push(entry.after.reject_comment);
  return { title, actor: entry?.actor?.name ? shortName(entry.actor.name) : 'Система', details };
};

/** Запись истории выполнения объекта (П-ФК-34) */
export const describeObjectEntry = (entry) => {
  if (entry.type === 'readiness') {
    const choice = entry.choice === 'restore' ? ' · возвращена прежняя' : entry.choice === 'keep' ? ' · оставлена' : '';
    return {
      title: `Готовность: ${formatReadiness(entry.before) || 'не задана'} → ${formatReadiness(entry.after) || 'не задана'}`,
      details: [`${entry.source_title}${choice}`, ...(entry.reason ? [entry.reason] : [])],
      actor: entry.by?.name ? (entry.by.id ? shortName(entry.by.name) : entry.by.name) : '',
    };
  }
  return {
    title: 'Согласованный отчёт',
    details: (entry.items || []).map((item) => `${item.name}: ${formatQuantity(item.approved, item.unit)}${item.edited ? ' · изменено' : ''}`),
    actor: [entry.submitted_by && `Заявил: ${shortName(entry.submitted_by.name)}`, entry.decided_by && `Согласовал: ${shortName(entry.decided_by.name)}`]
      .filter(Boolean).join(' · '),
  };
};

// ---- Очередь отправки: данные, не принятые сервером (П-ФК-44, п. 9.1, правила 3–4) ----

/**
 * Что делать очереди с ошибкой отправки: нет связи или сервер просит подождать — остановиться до следующей попытки;
 * сбой сервера — отложить только это задание (порядок внутри задания сохраняется), остальные отправлять; ответ с
 * причиной — не принято
 */
export const outboxFailure = (status, offline) => {
  if (offline || !status || status === 429) return 'stop';
  if (status >= 500) return 'skip';
  return 'refuse';
};

/** Пауза до следующей попытки: после сбоев сервера подряд — вдвое дольше каждый раз, не больше 10 минут */
export const retryDelay = (serverFailures, base) => Math.min(base * 2 ** serverFailures, 600000);

/** Элемент очереди не принят: остаётся с причиной и больше сам не отправляется */
export const markRefused = (queue, uuid, error) => queue.map((entry) => (entry.uuid === uuid ? { ...entry, failed: error } : entry));

/**
 * Отчёт задания сохранён на сервере: непринятый прежний текст убирается, непринятые фото снова в отправку.
 * Нечего менять — та же очередь (без лишней записи на устройство).
 */
export const settleRefusedQueue = (queue, staffId, taskId) => {
  const mine = (entry) => Number(entry.staffId) === Number(staffId) && Number(entry.taskId) === Number(taskId);
  if (!queue.some((entry) => mine(entry) && entry.failed)) return queue;
  return queue
    .filter((entry) => !(mine(entry) && entry.failed && entry.kind === 'save'))
    .map((entry) => {
      if (!(mine(entry) && entry.failed)) return entry;
      const { failed, ...rest } = entry;
      return rest;
    });
};
