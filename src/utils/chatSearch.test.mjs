import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendSearchPage, firstSearchPage, searchCursor } from './chatSearch.js';

const hits = (...ids) => ids.map((id) => ({ message_id: id, text: `щит ${id}` }));

test('первая страница: совпадения, продолжение и общее число', () => {
  assert.deepEqual(firstSearchPage({ messages: hits(50, 40), has_more: true, total: 34 }), {
    results: hits(50, 40),
    hasMore: true,
    total: 34,
  });
});

test('старый сервер без страниц: показываем присланное, дальше не листаем, числа нет', () => {
  assert.deepEqual(firstSearchPage({ chats: [], messages: hits(9, 8) }), { results: hits(9, 8), hasMore: false, total: null });
  assert.deepEqual(firstSearchPage(undefined), { results: [], hasMore: false, total: null });
});

test('следующая страница дописывается в конец без повторов', () => {
  const next = appendSearchPage(hits(50, 40, 30), { messages: hits(30, 20, 10), has_more: true });
  assert.deepEqual(next.results.map((hit) => hit.message_id), [50, 40, 30, 20, 10]);
  assert.equal(next.hasMore, true);
});

test('страница без нового (сервер проигнорировал before_id) останавливает догрузку', () => {
  const shown = hits(50, 40);
  const next = appendSearchPage(shown, { messages: hits(50, 40), has_more: true });
  assert.equal(next.results, shown);
  assert.equal(next.hasMore, false);
});

test('последняя страница: продолжения нет', () => {
  assert.equal(appendSearchPage(hits(50), { messages: hits(5), has_more: false }).hasMore, false);
});

test('курсор — самое старое из показанных', () => {
  assert.equal(searchCursor(hits(50, 12, 40)), 12);
  assert.equal(searchCursor([]), null);
  assert.equal(searchCursor([{ message_id: null }]), null);
});
