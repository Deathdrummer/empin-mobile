import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncomingCallEvents, selectIncomingCall, resolveNativeAnswer, participantFromCaller } from './incomingCallEvents.js';

test('отмена раньше incoming не воскрешает звонок и не блокирует следующий', () => {
  const calls = createIncomingCallEvents();
  calls.finish('277');
  assert.equal(calls.canPresent(277), false);
  assert.equal(calls.canPresent(278), true);
  calls.finish(276);
  assert.equal(calls.canPresent(278), true);
});

test('просроченный push не звонит, свежий и старый сервер без expiry совместимы', () => {
  const calls = createIncomingCallEvents({ now: () => 1000000 });
  assert.equal(calls.canPresent(277, 999), false);
  assert.equal(calls.canPresent(277, 1000), false);
  assert.equal(calls.canPresent(278, '1090'), true);
  assert.equal(calls.canPresent(279), true);
  assert.equal(calls.canPresent(undefined), false);
  assert.equal(calls.canPresent('not-a-call'), false);
});

test('история окончаний ограничена по времени и количеству', () => {
  let time = 0;
  const calls = createIncomingCallEvents({ now: () => time, retentionMs: 100, limit: 2 });
  calls.finish(1); calls.finish(2); calls.finish(3);
  assert.equal(calls.canPresent(1), true);
  assert.equal(calls.canPresent(2), false);
  time = 101;
  assert.equal(calls.canPresent(2), true);
});

test('ответ из старого нативного окна не принимает другой звонок из хранилища', () => {
  const stored = { callId: '277' };
  const current = { callId: '278' };
  assert.equal(selectIncomingCall(278, stored, current), current);
  assert.equal(selectIncomingCall(276, stored, current), null);
  assert.equal(selectIncomingCall(277, null, current), null);
  assert.equal(selectIncomingCall(null, stored, current), stored);
});

test('холодный запуск без локальных данных восстанавливает ответ по ID системной кнопки', () => {
  const calls = createIncomingCallEvents();
  assert.deepEqual(resolveNativeAnswer('283', null, null, calls.canPresent), { callId: '283', callType: 'audio' });
  assert.equal(resolveNativeAnswer(undefined, null, null, calls.canPresent), null);
  assert.equal(resolveNativeAnswer('undefined', null, null, calls.canPresent), null);
  assert.equal(resolveNativeAnswer('0', null, null, calls.canPresent), null);
  calls.finish(283);
  assert.equal(resolveNativeAnswer('283', null, null, calls.canPresent), null);
});

test('восстановление не подменяет системный ID другим push и не обходит срок действия', () => {
  const calls = createIncomingCallEvents({ now: () => 1000000 });
  assert.deepEqual(resolveNativeAnswer(283, { callId: '279' }, null, calls.canPresent), { callId: '283', callType: 'audio' });
  assert.equal(resolveNativeAnswer(283, { callId: '283', expiresAt: 999 }, null, calls.canPresent), null);
});

test('данные собеседника после accept берутся из подтверждённого сервером звонка', () => {
  assert.deepEqual(participantFromCaller({ id: 55, sname: 'Тест', fname: 'Два' }), { id: 55, name: 'Тест Два', avatar: undefined });
  assert.equal(participantFromCaller(null), null);
  assert.equal(participantFromCaller({ id: 'wrong' }), null);
});
