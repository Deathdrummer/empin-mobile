// Кнопки уведомления о сообщении. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionKey, clientKeyFor, createActionRunner, isMessageAction, responseData, withHandled } from './notificationActions.js';

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

test('повтор нажатия ждёт первую обработку; «готово» — один раз и только после неё', async () => {
  const done = [];
  const run = createActionRunner((key) => done.push(key));
  let release;
  let calls = 0;
  const task = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };

  const first = run('message-42:reply', task);
  let secondSettled = false;
  const second = run('message-42:reply', task).then(() => { secondSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 1);
  assert.equal(secondSettled, false);
  assert.deepEqual(done, []);

  release();
  await Promise.all([first, second]);
  assert.equal(secondSettled, true);
  assert.deepEqual(done, ['message-42:reply']);

  // Закончилась — то же нажатие снова обрабатывается (повтор отсекает список обработанных на телефоне)
  await run('message-42:reply', async () => { calls += 1; });
  assert.equal(calls, 2);
});

test('ошибка обработки: «готово» всё равно отмечается, ошибка не теряется', async () => {
  const done = [];
  const run = createActionRunner((key) => done.push(key));
  await assert.rejects(run('message-7:read', async () => { throw new Error('нет сети'); }), /нет сети/);
  assert.deepEqual(done, ['message-7:read']);
});
