// Разбор текста сообщения: ссылки, почта, телефоны, упоминания, форматирование. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstLink, linkHref, parseRichText, phoneHref, plainText, toggleFormat } from './richText.js';

const entities = (text) => parseRichText(text).filter((piece) => piece.entity).map((piece) => [piece.entity.type, piece.entity.value]);
const styled = (text, style) => parseRichText(text).filter((piece) => piece.style[style]).map((piece) => piece.text);

test('ссылки: со схемой, www, домен без схемы', () => {
  assert.deepEqual(entities('см. https://empin-pro.ru/a?b=1 и www.example.com'), [
    ['url', 'https://empin-pro.ru/a?b=1'], ['url', 'www.example.com'],
  ]);
  assert.deepEqual(entities('сайт empin-pro.ru/docs, проверь'), [['url', 'empin-pro.ru/docs']]);
  assert.deepEqual(entities('сайт эмпин.рф'), [['url', 'эмпин.рф']]);
});

test('знаки препинания в конце не входят в ссылку, скобки в адресе — входят', () => {
  assert.deepEqual(entities('Вот: https://site.ru/page.'), [['url', 'https://site.ru/page']]);
  assert.deepEqual(entities('(https://site.ru)'), [['url', 'https://site.ru']]);
  assert.deepEqual(entities('https://ru.wikipedia.org/wiki/Ток_(физика)'), [['url', 'https://ru.wikipedia.org/wiki/Ток_(физика)']]);
});

test('не ссылки: сокращения, числа, время', () => {
  assert.deepEqual(entities('т.к. 1.5 кВ, в 12.30, ТП-14'), []);
});

test('почта и упоминание не путаются', () => {
  assert.deepEqual(entities('пиши на ivanov@empin-pro.ru, @Петров А. в курсе'), [
    ['email', 'ivanov@empin-pro.ru'], ['mention', '@Петров А.'],
  ]);
});

test('телефоны: российские и международные; коды и даты — нет', () => {
  assert.deepEqual(entities('звони +7 (912) 345-67-89 или 8 912 345 67 89'), [
    ['phone', '+7 (912) 345-67-89'], ['phone', '8 912 345 67 89'],
  ]);
  assert.deepEqual(entities('+49 30 12345678'), [['phone', '+49 30 12345678']]);
  assert.deepEqual(entities('код 4512, 30.10.2026, акт 89123456'), []);
  assert.equal(phoneHref('+7 (912) 345-67-89'), 'tel:+79123456789');
});

test('форматирование, как в Telegram', () => {
  assert.deepEqual(styled('это **важно** и __так__', 'bold'), ['важно']);
  assert.deepEqual(styled('это **важно** и __так__', 'italic'), ['так']);
  assert.deepEqual(styled('~~было~~ ||пароль|| `ls -la`', 'strike'), ['было']);
  assert.deepEqual(styled('~~было~~ ||пароль|| `ls -la`', 'spoiler'), ['пароль']);
  assert.deepEqual(styled('~~было~~ ||пароль|| `ls -la`', 'code'), ['ls -la']);
  assert.equal(plainText('**жирный** __курсив__ `код`'), 'жирный курсив код');
});

test('вложенное форматирование', () => {
  const pieces = parseRichText('**жирный __и курсив__**');
  assert.deepEqual(pieces.map((piece) => [piece.text, piece.style.bold, piece.style.italic]), [
    ['жирный ', true, false], ['и курсив', true, true],
  ]);
});

test('непарные и пустые маркеры остаются текстом', () => {
  assert.equal(plainText('2 ** 3 и 4 ** 5'), '2 ** 3 и 4 ** 5');
  // Закрывающий маркер после пробела пропускается — пара находится дальше
  assert.equal(plainText('**а **б**'), 'а **б');
  assert.equal(plainText('a **** b'), 'a **** b');
  assert.equal(plainText('только **начало'), 'только **начало');
});

test('в адресе подчёркивания не становятся курсивом; внутри кода ссылки не разбираются', () => {
  assert.deepEqual(entities('https://site.ru/a__b__c'), [['url', 'https://site.ru/a__b__c']]);
  assert.deepEqual(styled('https://site.ru/a__b__c', 'italic'), []);
  assert.deepEqual(entities('`https://site.ru`'), []);
});

test('ссылка внутри жирного остаётся ссылкой и жирной', () => {
  const pieces = parseRichText('**см. site.ru**');
  const link = pieces.find((piece) => piece.entity);
  assert.equal(link.entity.value, 'site.ru');
  assert.equal(link.style.bold, true);
  assert.equal(linkHref('site.ru'), 'https://site.ru');
  assert.equal(linkHref('http://site.ru'), 'http://site.ru');
});

test('панель форматирования: обернуть выделенное, пробелы — снаружи, повтор снимает', () => {
  const text = 'Срочно проверь щит';
  const bold = toggleFormat(text, 7, 15, '**');
  assert.deepEqual(bold, { text: 'Срочно **проверь** щит', start: 7, end: 18 });
  assert.equal(plainText(bold.text), 'Срочно проверь щит');
  assert.ok(parseRichText(bold.text).some((piece) => piece.style.bold && piece.text === 'проверь'));

  // Выделено вместе с маркерами — снимается; маркеры снаружи выделения — тоже
  assert.deepEqual(toggleFormat(bold.text, bold.start, bold.end, '**'), { text: 'Срочно проверь щит', start: 7, end: 14 });
  assert.deepEqual(toggleFormat('a **bc** d', 4, 6, '**'), { text: 'a bc d', start: 2, end: 4 });

  // Вложенное: курсив поверх жирного
  const nested = toggleFormat(bold.text, bold.start, bold.end + 1, '__');
  assert.equal(nested.text, 'Срочно __**проверь**__ щит');
  const piece = parseRichText(nested.text).find((item) => item.text === 'проверь');
  assert.equal(piece.style.bold && piece.style.italic, true);
});

test('панель форматирования: несколько строк — построчно, пустое выделение — без изменений', () => {
  const lines = toggleFormat('раз\n\n  два ', 0, 10, '`');
  assert.equal(lines.text, '`раз`\n\n  `два` ');
  assert.deepEqual(parseRichText(lines.text).filter((item) => item.style.code).map((item) => item.text), ['раз', 'два']);
  assert.deepEqual(toggleFormat('abc', 1, 1, '**'), { text: 'abc', start: 1, end: 1 });
  assert.deepEqual(toggleFormat('a   b', 1, 4, '**'), { text: 'a   b', start: 1, end: 4 });
  assert.equal(toggleFormat('код 4512', 4, 8, '||').text, 'код ||4512||');
  assert.equal(plainText('код ||4512||'), 'код 4512');
});

test('превью: первая ссылка, без схемы — https; не из кода и не из скрытого текста', () => {
  assert.equal(firstLink('Схема: empin-pro.ru/docs и https://site.ru'), 'https://empin-pro.ru/docs');
  assert.equal(firstLink('Почта ivanov@empin-pro.ru, сайт http://site.ru.'), 'http://site.ru');
  assert.equal(firstLink('`https://code.ru` и ||https://secret.ru|| и **https://bold.ru**'), 'https://bold.ru');
  assert.equal(firstLink('Без ссылок, т.к. 1.5 кВ'), null);
  assert.equal(firstLink(''), null);
});

test('ссылка внутри оформления: маркеры не попадают в адрес, оформление работает', () => {
  const spoiler = parseRichText('код ||https://secret.ru|| конец');
  const hidden = spoiler.find((piece) => piece.entity?.type === 'url');
  assert.equal(hidden.entity.value, 'https://secret.ru');
  assert.equal(hidden.style.spoiler, true);
  assert.equal(plainText('код ||https://secret.ru|| конец'), 'код https://secret.ru конец');
  const bold = parseRichText('**https://bold.ru** и __site.ru__');
  assert.deepEqual(bold.filter((piece) => piece.entity).map((piece) => [piece.entity.value, Boolean(piece.style.bold), Boolean(piece.style.italic)]),
    [['https://bold.ru', true, false], ['site.ru', false, true]]);
  // Подчёркивание внутри адреса — часть адреса
  assert.equal(parseRichText('https://site.ru/a_b_c').find((piece) => piece.entity).entity.value, 'https://site.ru/a_b_c');
});
