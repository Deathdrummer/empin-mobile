// «Прочитали» и галочки в группе и чате объекта. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadByOthers, readersOf } from './readReceipts.js';

const message = { id: 50, from_id: 1, created_at: '2026-10-30T10:00:00+03:00' };
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

test('вступивший после отправки не «прочитал», хотя граница у него дальше', () => {
  // Мастера добавил табель позже: граница прочитанного — последний комментарий
  const membersRead = { 2: 60, 3: 60 };
  const membersSince = { 2: '2026-10-29T08:00:00+03:00', 3: '2026-10-30T10:05:00+03:00' };
  const { read, unread } = readersOf(message, members, membersRead, membersSince, 1);
  assert.deepEqual(read.map((member) => member.id), [2]);
  assert.deepEqual(unread.map((member) => member.id), [4]);
  assert.equal(isReadByOthers(message, { 3: 60 }, membersSince), false);
});

test('вступивший в ту же секунду, что отправлено сообщение, — тоже позже (так ставит граница табель)', () => {
  const membersSince = { 2: '2026-10-30T07:00:00Z' };
  assert.equal(isReadByOthers(message, { 2: 50 }, membersSince), false);
});

test('нет даты вступления или времени сообщения — участник считается бывшим в чате', () => {
  assert.equal(isReadByOthers(message, { 5: 50 }, { 2: '2026-10-29T08:00:00+03:00' }), true);
  assert.equal(isReadByOthers({ id: 50 }, { 2: 50 }, { 2: '2026-10-29T08:00:00+03:00' }), true);
  assert.deepEqual(readersOf(message, null, null, null, 1), { read: [], unread: [] });
});
