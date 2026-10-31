// Кнопки уведомления о сообщении. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionKey, clientKeyFor, isMessageAction, responseData, withHandled } from './notificationActions.js';

const response = (content, actionIdentifier = 'reply', identifier = 'message-42') => ({
  actionIdentifier,
  userText: 'Еду',
  notification: { request: { identifier, content } },
});

test('данные уведомления: объект, строка из фоновой задачи Android, мусор', () => {
  assert.deepEqual(responseData(response({ data: { type: 'message', chat_id: 5 } })), { type: 'message', chat_id: 5 });
  assert.deepEqual(responseData(response({ dataString: '{"type":"message","chat_id":7}' })), { type: 'message', chat_id: 7 });
  assert.deepEqual(responseData(response({ dataString: '{oops' })), {});
  assert.deepEqual(responseData(null), {});
});

test('только «Ответить» и «Прочитано» — действия; обычное касание открывает чат', () => {
  assert.equal(isMessageAction(response({}, 'reply')), true);
  assert.equal(isMessageAction(response({}, 'read')), true);
  assert.equal(isMessageAction(response({}, 'expo.modules.notifications.actions.DEFAULT')), false);
  assert.equal(isMessageAction(null), false);
});

test('ключ нажатия: уведомление + кнопка; ключ попытки на сервере не длиннее 64', () => {
  assert.equal(actionKey(response({}, 'reply', 'message-42')), 'message-42:reply');
  assert.equal(actionKey(response({}, 'read', 'message-42')), 'message-42:read');
  assert.equal(actionKey({ actionIdentifier: 'reply' }), null);
  const long = `${'x'.repeat(80)}:reply`;
  assert.equal(clientKeyFor(long).length, 64);
  assert.ok(clientKeyFor(long).endsWith(':reply'));
});

test('обработанные нажатия: без повторов, только последние 50', () => {
  assert.deepEqual(withHandled(['a', 'b'], 'a'), ['b', 'a']);
  assert.deepEqual(withHandled(null, 'a'), ['a']);
  const many = Array.from({ length: 60 }, (_, index) => `k${index}`);
  const list = withHandled(many, 'new');
  assert.equal(list.length, 50);
  assert.equal(list[49], 'new');
});
