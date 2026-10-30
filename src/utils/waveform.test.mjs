// «Волна» голосового. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaveform, levelFromDb, pseudoWaveform, resampleWaveform, WAVEFORM_BARS } from './waveform.js';

test('громкость: тишина — 0, громко — 1, мусор — 0', () => {
  assert.equal(levelFromDb(-160), 0);
  assert.equal(levelFromDb(-50), 0);
  assert.equal(levelFromDb(0), 1);
  assert.equal(levelFromDb(-25), 0.5);
  assert.equal(levelFromDb(undefined), 0);
  assert.equal(levelFromDb(NaN), 0);
});

test('волна для отправки: не длиннее 63, пик — 31, тишина — нули, пустая запись — пусто', () => {
  const levels = Array.from({ length: 500 }, (_, index) => (index > 200 && index < 300 ? 0.9 : 0.1));
  const waveform = buildWaveform(levels);
  assert.equal(waveform.length, WAVEFORM_BARS);
  assert.equal(Math.max(...waveform), 31);
  assert.ok(waveform.every((value) => Number.isInteger(value) && value >= 0 && value <= 31));
  // Громкий отрезок в середине записи — в середине волны
  assert.ok(waveform[31] > waveform[5]);
  assert.deepEqual(buildWaveform([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(buildWaveform([]), []);
  // Короткая запись — столько столбиков, сколько замеров
  assert.equal(buildWaveform([0.2, 0.5]).length, 2);
});

test('показ: сжатие до числа столбиков в пузырьке, значения 0…1', () => {
  const bars = resampleWaveform(Array.from({ length: 63 }, (_, i) => (i < 32 ? 31 : 0)), 28);
  assert.equal(bars.length, 28);
  assert.equal(bars[0], 1);
  assert.equal(bars[27], 0);
  assert.deepEqual(resampleWaveform([], 28), []);
  // Растяжение короткой волны
  assert.equal(resampleWaveform([31, 0], 4).length, 4);
});

test('старые голосовые: условная волна стабильна для сообщения', () => {
  assert.deepEqual(pseudoWaveform(42, 28), pseudoWaveform(42, 28));
  assert.notDeepEqual(pseudoWaveform(42, 28), pseudoWaveform(43, 28));
});
