// «Прочитали» и галочки в группе и чате объекта. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadByOthers, readersOf } from './readReceipts.js';

const message = { id: 50, from_id: 1 };
const members = [
  { id: 1, sname: 'Иванов' },
  { id: 2, sname: 'Петров' },
  { id: 3, sname: 'Самсонов' },
  { id: 4, sname: 'Кузнецов' },
];

test('прочитали — дочитавшие до сообщения; автор в список не входит', () => {
  const membersRead = { 2: 50, 3: 49, 4: null };
  const { read, unread } = readersOf(message, members, membersRead, {}, 1);
  assert.deepEqual(read.map((member) => member.id), [2]);
  assert.deepEqual(unread.map((member) => member.id), [3, 4]);
  assert.equal(isReadByOthers(message, membersRead, {}), true);
  assert.equal(isReadByOthers(message, { 3: 49 }, {}), false);
});

test('вступивший позже не «прочитал» то, что получил вместе с вступлением', () => {
  // Мастера добавил табель, когда последним был этот комментарий (или новее): граница — 50 и 60
  const membersRead = { 2: 60, 3: 60, 4: 60 };
  const membersJoined = { 2: null, 3: 50, 4: 60 };
  const { read, unread } = readersOf(message, members, membersRead, membersJoined, 1);
  assert.deepEqual(read.map((member) => member.id), [2]);
  assert.deepEqual(unread, []);
  assert.equal(isReadByOthers(message, { 3: 60 }, membersJoined), false);
  // Более новое сообщение тот же мастер прочитал по-настоящему
  assert.equal(isReadByOthers({ id: 55, from_id: 1 }, { 3: 60 }, membersJoined), true);
});

test('нет сведений о вступлении (старый сервер) — участник считается бывшим в чате', () => {
  assert.equal(isReadByOthers(message, { 5: 50 }, { 2: 40 }), true);
  assert.equal(isReadByOthers(message, { 2: 50 }, undefined), true);
  assert.deepEqual(readersOf(message, null, null, null, 1), { read: [], unread: [] });
});
