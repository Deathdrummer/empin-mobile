import test from 'node:test';
import assert from 'node:assert/strict';
import { callScreenActions } from './callScreen.js';

test('в любом незавершённом состоянии есть красная кнопка', () => {
  // idle: экран уже открыт, а звонок ещё не начался (ждём разрешение на микрофон)
  for (const status of ['idle', 'initiating', 'ringing', 'unknown-status', undefined]) {
    assert.equal(callScreenActions(status, false), 'outgoing', String(status));
  }
  assert.equal(callScreenActions('active', false), 'talk');
  assert.equal(callScreenActions('active', true), 'talk');
  assert.equal(callScreenActions('ringing', true), 'incoming');
});

test('завершённый звонок — без кнопок: экран закрывается сам', () => {
  for (const status of ['ended', 'no_answer', 'rejected', 'error']) {
    assert.equal(callScreenActions(status, false), 'none', status);
    assert.equal(callScreenActions(status, true), 'none', status);
  }
});
