import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SHARED_FILES, isHeic, sharedContent } from './incomingShare.js';

test('пусто или нет ни текста, ни файлов — отправлять нечего', () => {
  assert.equal(sharedContent(null), null);
  assert.equal(sharedContent({ files: null, text: null, webUrl: null, type: null }), null);
  assert.equal(sharedContent({ text: '   ', files: [] }), null);
  assert.equal(sharedContent({ files: [{ path: null, fileName: 'a.jpg' }] }), null);
});

test('текст и ссылка попадают в текст сообщения', () => {
  assert.deepEqual(sharedContent({ text: ' Привет ' }), { text: 'Привет', files: [], dropped: 0 });
  assert.equal(sharedContent({ webUrl: 'https://empin-pro.ru' }).text, 'https://empin-pro.ru');
});

test('файл превращается во вложение поля ввода', () => {
  const { files } = sharedContent({
    files: [
      { path: 'file:///a/1.jpg', mimeType: 'image/jpeg', fileName: '1.jpg', width: 100, height: 50, size: 10, duration: null },
      { path: 'file:///a/2.mp4', mimeType: 'video/mp4', fileName: '2.mp4', size: 20, duration: 3000 },
      { path: 'file:///a/3.pdf', mimeType: 'application/pdf', fileName: '3.pdf', size: 30 },
      { path: 'file:///a/4', mimeType: null, fileName: null },
    ],
  });
  assert.deepEqual(files[0], {
    uri: 'file:///a/1.jpg', name: '1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg', type: 'image', width: 100, height: 50, fileSize: 10, duration: undefined,
  });
  assert.equal(files[1].type, 'video');
  assert.equal(files[1].duration, 3000);
  // Документ: без type, иначе подготовка отправила бы его как фото
  assert.equal(files[2].type, undefined);
  assert.equal(files[3].mimeType, undefined);
  assert.equal(files[3].uri, 'file:///a/4');
});

test('Android: путь с кириллицей, пробелами и служебными символами кодируется один раз', () => {
  const file = { path: 'file:///data/cache/Смета №1 #2 100%.pdf', mimeType: 'application/pdf' };
  const { files } = sharedContent({ files: [file] }, { rawPaths: true });
  assert.equal(files[0].uri, `file:///data/cache/${encodeURIComponent('Смета №1 #2 100%.pdf')}`);
  assert.equal(decodeURIComponent(files[0].uri), file.path);
});

test('адрес content:// и готовый адрес iOS не меняются', () => {
  const content = 'content://media/external/images/1';
  assert.equal(sharedContent({ files: [{ path: content }] }, { rawPaths: true }).files[0].uri, content);
  const ios = 'file:///private/var/%D0%A1.pdf';
  assert.equal(sharedContent({ files: [{ path: ios }] }).files[0].uri, ios);
});

test('больше предела — лишние отбрасываются, и об этом известно', () => {
  const files = Array.from({ length: MAX_SHARED_FILES + 3 }, (_, index) => ({ path: `file:///a/${index}.jpg` }));
  const result = sharedContent({ files });
  assert.equal(result.files.length, MAX_SHARED_FILES);
  assert.equal(result.dropped, 3);
});

test('HEIC определяется по типу и имени', () => {
  assert.equal(isHeic({ mimeType: 'image/heic' }), true);
  assert.equal(isHeic({ mimeType: 'image/heif' }), true);
  assert.equal(isHeic({ fileName: 'IMG_1.HEIC' }), true);
  assert.equal(isHeic({ mimeType: 'image/jpeg', fileName: 'x.heic' }), false);
  assert.equal(isHeic({ name: 'heic.jpg' }), false);
  assert.equal(isHeic(null), false);
});
