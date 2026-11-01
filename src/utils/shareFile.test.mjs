import test from 'node:test';
import assert from 'node:assert/strict';
import { shareFileName } from './shareFile.js';

test('исходное имя с расширением остаётся как есть', () => {
  assert.equal(shareFileName({ name: 'Договор №5 от мая.pdf', uri: 'https://x/storage/abc.pdf' }), 'Договор №5 от мая.pdf');
});

test('имя без расширения получает его из адреса или типа', () => {
  assert.equal(shareFileName({ name: 'Смета', uri: 'https://x/storage/abc.xlsx?v=2' }), 'Смета.xlsx');
  assert.equal(shareFileName({ name: 'Смета', uri: 'https://x/storage/abc', mime_type: 'application/pdf' }), 'Смета.pdf');
  assert.equal(shareFileName({ name: 'Смета', uri: 'https://x/storage/abc' }), 'Смета');
});

test('без имени берётся имя из адреса, затем запасное', () => {
  assert.equal(shareFileName({ uri: 'https://x/storage/%D1%84%D0%BE%D1%82%D0%BE.jpg?t=1#a' }), 'фото.jpg');
  assert.equal(shareFileName({ uri: '' }, 2), 'file-3');
});

test('символы, ломающие путь и адрес file://, заменяются', () => {
  assert.equal(shareFileName({ name: 'a/b:c?d#e%f.png' }), 'a_b_c_d_e_f.png');
  assert.equal(shareFileName({ name: '../../etc/passwd.txt' }), '.._.._etc_passwd.txt');
});
