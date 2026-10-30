/**
 * «Волна» голосового, как в Telegram: громкость во время записи → столбики 0…31 (5 бит, как у Telegram),
 * хранится в сообщении; при показе сжимается до числа столбиков в пузырьке.
 */

export const WAVEFORM_BARS = 63;
const MAX_VALUE = 31;
// Тише этого — тишина. Обычная речь у микрофона телефона — около −30…−10 дБ
const SILENCE_DB = -50;

/** Громкость микрофона (дБ, −160…0) → 0…1 */
export const levelFromDb = (db) => {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;
  return Math.min(1, Math.max(0, (db - SILENCE_DB) / -SILENCE_DB));
};

/** Столбики для отправки: средняя громкость по равным отрезкам записи, громкий участок — 31 */
export const buildWaveform = (levels, bars = WAVEFORM_BARS) => {
  if (!levels?.length) return [];
  const count = Math.min(bars, levels.length);
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * levels.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * levels.length) / count));
    const slice = levels.slice(start, end);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
  const peak = Math.max(...buckets);
  if (peak <= 0) return buckets.map(() => 0);
  return buckets.map((value) => Math.round((value / peak) * MAX_VALUE));
};

/** Сохранённая «волна» (0…31) → нужное число столбиков 0…1 для показа */
export const resampleWaveform = (waveform, count) => {
  if (!waveform?.length) return [];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * waveform.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * waveform.length) / count));
    const slice = waveform.slice(start, end);
    const average = slice.reduce((sum, value) => sum + Number(value || 0), 0) / slice.length;
    return Math.min(1, Math.max(0, average / MAX_VALUE));
  });
};

/** Старые голосовые без сохранённой «волны»: условный рисунок, стабильный для сообщения */
export const pseudoWaveform = (seed, count) => {
  let value = Number(seed) || 7;
  return Array.from({ length: count }, () => {
    value = (value * 9301 + 49297) % 233280;
    return 0.25 + (value / 233280) * 0.75;
  });
};
