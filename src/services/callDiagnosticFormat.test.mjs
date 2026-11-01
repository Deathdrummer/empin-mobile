import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCallDiagnostic, readCallDiagnostics, CALL_CAUSES } from './callDiagnosticFormat.js';

test('трасса сохраняет ID и причину, отбрасывает секреты, текст и нечисловые значения', () => {
  assert.deepEqual(safeCallDiagnostic('rtc-leave-command', {
    callId: '283', cause: CALL_CAUSES.remoteWs, engine: 2, attempt: 3, code: -4,
    token: 'secret', password: 'secret', name: 'Иван', channel: 'private',
    status: Infinity, elapsed: NaN, uid: '55x', reason: 'secret',
  }), { event: 'rtc-leave-command', callId: 283, cause: 9, attempt: 3, code: -4, engine: 2 });
  assert.equal(safeCallDiagnostic('Bearer secret'), null);
});

test('повреждение хранилища не ломает экспорт, история ограничена и повторно очищается', () => {
  assert.deepEqual(readCallDiagnostics('{broken'), []);
  assert.deepEqual(readCallDiagnostics('{"events":[]}'), []);
  const entries = [1, 2, 3].map((id) => ({ time: '2026-11-02T00:00:00Z', event: 'http-end-request', callId: id, token: 'secret' }));
  assert.deepEqual(readCallDiagnostics(JSON.stringify(entries), 2).map((e) => e.callId), [2, 3]);
  assert.equal(JSON.stringify(readCallDiagnostics(JSON.stringify(entries))).includes('secret'), false);
  assert.deepEqual(readCallDiagnostics(JSON.stringify([null, { time: 'invalid', event: 'test' }])), []);
});
