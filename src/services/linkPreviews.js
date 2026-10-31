import { useEffect, useState } from 'react';
import { messengerAPI } from './api';

/**
 * Превью ссылок на время работы приложения (сервер их тоже кэширует — сайт не дёргается снова).
 * Одна ссылка в нескольких сообщениях — один запрос. Без связи — повтор не чаще раза в минуту.
 */

const RETRY_MS = 60 * 1000;
const MAX_ENTRIES = 300;

// url → { preview } | { failedAt } | Promise
const cache = new Map();

const remember = (url, entry) => {
  cache.delete(url);
  cache.set(url, entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
};

const load = (url) => {
  const known = cache.get(url);
  if (known instanceof Promise) return known;
  if (known && 'preview' in known) return Promise.resolve(known.preview);
  if (known?.failedAt && Date.now() - known.failedAt < RETRY_MS) return Promise.resolve(null);

  const request = messengerAPI.getLinkPreview(url)
    .then((preview) => {
      remember(url, { preview });
      return preview;
    })
    .catch((error) => {
      // Старый сервер (нет метода) или адрес отвергнут — показать нечего; иначе (нет связи) — попробуем позже
      const status = error?.response?.status;
      remember(url, status === 404 || status === 422 ? { preview: null } : { failedAt: Date.now() });
      return null;
    });
  cache.set(url, request);
  return request;
};

const cachedPreview = (url) => {
  const known = url ? cache.get(url) : null;
  return known && !(known instanceof Promise) && 'preview' in known ? known.preview : null;
};

/** Превью первой ссылки сообщения; null — пока грузится или показать нечего */
export const useLinkPreview = (url) => {
  const [preview, setPreview] = useState(() => cachedPreview(url));

  useEffect(() => {
    if (!url) {
      setPreview(null);
      return undefined;
    }
    let alive = true;
    setPreview(cachedPreview(url));
    load(url).then((value) => {
      if (alive) setPreview(value);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return preview;
};
