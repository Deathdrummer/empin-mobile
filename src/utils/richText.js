/**
 * Разбор текста сообщения, как в Telegram: ссылки, почта, телефоны, упоминания и форматирование
 * **жирный**, __курсив__, ~~зачёркнутый~~, `моноширинный`, ||скрытый||.
 *
 * Порядок: сначала `код` (внутри него ничего не разбирается), затем ссылки/почта/телефоны/упоминания
 * (их символы не считаются маркерами — «a__b» внутри адреса остаётся адресом), затем остальные маркеры.
 * Результат — список кусков { text, style: { bold, italic, strike, code, spoiler }, entity: { type, value } | null }.
 */

const MARKERS = [
  { token: '**', style: 'bold' },
  { token: '__', style: 'italic' },
  { token: '~~', style: 'strike' },
  { token: '||', style: 'spoiler' },
];

// Домены без «http» — только с привычными окончаниями, чтобы «т.к.» или «1.5» не стали ссылками
const TLD = '(?:ru|рф|su|com|net|org|info|biz|io|me|pro|online|site|store|app|dev|by|kz|ua|uz|de|eu|us|uk)';
// Границы адреса без схемы — буквы и цифры (не «_»): __site.ru__ — курсивная ссылка
const URL_SOURCE = `(?:https?:\\/\\/[^\\s<>"«»]+|(?:www\\.)[^\\s<>"«»]+|(?<![@\\p{L}\\p{N}.-])(?:[a-zа-яё0-9-]+\\.)+${TLD}(?![\\p{L}\\p{N}-])(?:\\/[^\\s<>"«»]*)?)`;
const EMAIL_SOURCE = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';
// Российские номера (+7 / 8 и 10 цифр) и международные (+ и 10–14 цифр) с пробелами, скобками, дефисами
const PHONE_SOURCE = '(?<![\\d+])(?:\\+7|8)[\\s(-]*\\d{3}[\\s)-]*\\d{3}[\\s-]*\\d{2}[\\s-]*\\d{2}(?!\\d)|(?<![\\d+])\\+[1-9](?:[\\s()-]*\\d){9,13}(?!\\d)';
// «@Фамилия И.» — как вставляет поле ввода
const MENTION_SOURCE = '(?<![\\w.])@[A-Za-zА-Яа-яЁё-]+(?:\\s[A-ZА-ЯЁ]\\.)?';

const ENTITY_PATTERN = new RegExp(`(${EMAIL_SOURCE})|(${URL_SOURCE})|(${PHONE_SOURCE})|(${MENTION_SOURCE})`, 'giu');

// Знаки препинания в конце ссылки обычно принадлежат предложению: «см. site.ru.» / «(site.ru)»,
// а маркеры форматирования — оформлению: **site.ru**, ||site.ru||, __site.ru__
const trimUrl = (raw) => {
  let url = raw;
  for (;;) {
    if (url.endsWith('__')) {
      url = url.slice(0, -2);
      continue;
    }
    if (!/[.,;:!?…»"')\]|*~`]$/.test(url)) break;
    // Закрывающая скобка — часть адреса, если внутри есть открывающая (Википедия)
    if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) break;
    url = url.slice(0, -1);
  }
  return url;
};

/** Адрес для открытия: без схемы — https:// */
export const linkHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** Номер для набора: только цифры и «+» */
export const phoneHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

const findCode = (text) => {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('`', index);
    if (open < 0) break;
    const close = text.indexOf('`', open + 1);
    if (close < 0) break;
    if (close > open + 1) {
      ranges.push({ start: open, end: close + 1, contentStart: open + 1, contentEnd: close });
      index = close + 1;
    } else {
      index = open + 1;
    }
  }
  return ranges;
};

const insideAny = (position, ranges) => ranges.some((range) => position >= range.start && position < range.end);

const findEntities = (text, code) => {
  const entities = [];
  ENTITY_PATTERN.lastIndex = 0;
  let match;
  while ((match = ENTITY_PATTERN.exec(text))) {
    const [whole, email, url, phone, mention] = match;
    let value = whole;
    let type;
    if (email) type = 'email';
    else if (url) {
      type = 'url';
      value = trimUrl(whole);
    } else if (phone) type = 'phone';
    else if (mention) type = 'mention';
    const start = match.index;
    const end = start + value.length;
    if (!value || insideAny(start, code) || insideAny(end - 1, code)) continue;
    entities.push({ start, end, type, value });
    // После обрезки знаков препинания поиск продолжается сразу за ссылкой
    ENTITY_PATTERN.lastIndex = end;
  }
  return entities;
};

const findFormatting = (text, protectedRanges) => {
  const ranges = [];
  const markerPositions = new Set();
  const isFree = (position, length) => {
    for (let i = position; i < position + length; i += 1) {
      if (insideAny(i, protectedRanges) || markerPositions.has(i)) return false;
    }
    return true;
  };

  let index = 0;
  while (index < text.length) {
    const marker = MARKERS.find(({ token }) => text.startsWith(token, index));
    if (!marker || !isFree(index, marker.token.length)) {
      index += 1;
      continue;
    }
    // Ближайший парный маркер с непустым содержимым. Как в Telegram: после открывающего и перед закрывающим —
    // не пробел, иначе «2 ** 3 и 4 ** 5» стало бы жирным
    const opensWord = /\S/.test(text[index + marker.token.length] || '');
    let close = text.indexOf(marker.token, index + marker.token.length);
    while (close >= 0 && (!isFree(close, marker.token.length) || /\s/.test(text[close - 1]))) {
      close = text.indexOf(marker.token, close + 1);
    }
    if (!opensWord || close < 0 || close === index + marker.token.length) {
      index += marker.token.length;
      continue;
    }
    for (let i = 0; i < marker.token.length; i += 1) {
      markerPositions.add(index + i);
      markerPositions.add(close + i);
    }
    ranges.push({ start: index + marker.token.length, end: close, style: marker.style });
    // Содержимое разбирается дальше: внутри **жирного** может быть __курсив__
    index += marker.token.length;
  }
  return { ranges, markerPositions };
};

const sameStyle = (a, b) => a.bold === b.bold && a.italic === b.italic && a.strike === b.strike
  && a.code === b.code && a.spoiler === b.spoiler;

/** Куски текста для вывода */
export const parseRichText = (text) => {
  if (!text) return [];
  const code = findCode(text);
  const entities = findEntities(text, code);
  const { ranges, markerPositions } = findFormatting(text, [...code, ...entities]);
  const codeMarkers = new Set(code.flatMap((range) => [range.start, range.end - 1]));

  const pieces = [];
  for (let i = 0; i < text.length; i += 1) {
    if (markerPositions.has(i) || codeMarkers.has(i)) continue;
    const style = {
      bold: false, italic: false, strike: false, code: insideAny(i, code), spoiler: false,
    };
    ranges.forEach((range) => {
      if (i >= range.start && i < range.end) style[range.style] = true;
    });
    const entity = entities.find((item) => i >= item.start && i < item.end) || null;
    const last = pieces[pieces.length - 1];
    if (last && sameStyle(last.style, style) && last.entityRef === entity) {
      last.text += text[i];
    } else {
      pieces.push({ text: text[i], style, entityRef: entity });
    }
  }

  return pieces.map(({ text: pieceText, style, entityRef }) => ({
    text: pieceText,
    style,
    entity: entityRef ? { type: entityRef.type, value: entityRef.value } : null,
  }));
};

/** Текст без маркеров форматирования — для цитат, копирования и превью */
export const plainText = (text) => parseRichText(text).map((piece) => piece.text).join('');

/**
 * Оформить выделенное в поле ввода маркером (**, __, ~~, `, ||) или снять оформление, если выделенное уже
 * им обёрнуто (маркеры снаружи выделения или его края). Пробелы по краям остаются снаружи маркеров — иначе
 * маркер не сработает; несколько строк оформляются построчно (код и сервер разбирают маркеры в пределах строки).
 * @returns {{ text: string, start: number, end: number }} новый текст и выделение
 */
export const toggleFormat = (text, start, end, token) => {
  const value = text || '';
  let from = Math.max(0, Math.min(start, end));
  let to = Math.min(value.length, Math.max(start, end));
  const size = token.length;
  if (!value.slice(from, to).trim()) return { text: value, start: from, end: to };
  // Пробелы по краям выделения в оформление не входят
  while (/\s/.test(value[from])) from += 1;
  while (/\s/.test(value[to - 1])) to -= 1;

  if (from >= size && value.slice(from - size, from) === token && value.slice(to, to + size) === token) {
    return {
      text: value.slice(0, from - size) + value.slice(from, to) + value.slice(to + size),
      start: from - size,
      end: to - size,
    };
  }
  const selected = value.slice(from, to);
  if (selected.length > size * 2 && selected.startsWith(token) && selected.endsWith(token)) {
    const inner = selected.slice(size, -size);
    return { text: value.slice(0, from) + inner + value.slice(to), start: from, end: from + inner.length };
  }

  const wrapped = selected.split('\n').map((line) => {
    const [, before, body, after] = line.match(/^(\s*)(.*?)(\s*)$/);
    return body ? `${before}${token}${body}${token}${after}` : line;
  }).join('\n');
  return { text: value.slice(0, from) + wrapped + value.slice(to), start: from, end: from + wrapped.length };
};

/** Первая ссылка сообщения — для превью, как в Telegram. Ссылка в скрытом тексте превью не получает */
export const firstLink = (text) => {
  const piece = parseRichText(text).find((item) => item.entity?.type === 'url' && !item.style?.spoiler);
  return piece ? linkHref(piece.entity.value) : null;
};

/** Есть ли в тексте что разбирать (быстрая проверка перед разбором) */
export const hasRichContent = (text) => /[*_~|`@.+\d]/.test(text || '');
