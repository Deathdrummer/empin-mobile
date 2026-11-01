import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncomingCallEvents, selectIncomingCall } from './incomingCallEvents.js';

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
