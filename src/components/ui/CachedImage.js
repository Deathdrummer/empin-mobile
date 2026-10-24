import React from 'react';
import { Image } from 'expo-image';

/**
 * Файл картинки из кэша телефона (если она уже показывалась), иначе — исходный адрес.
 * Полноэкранный просмотр и «Поделиться» берут фото отсюда — без повторной загрузки.
 */
export const cachedFileUri = async (uri) => {
  // Локальные файлы (только что снятые, из галереи) — как есть
  if (!uri || !/^https?:/i.test(uri)) return uri;
  try {
    const path = await Image.getCachePathAsync(uri);
    if (path) return path.startsWith('file:') ? path : `file://${path}`;
  } catch {
    // Нет в кэше или кэш недоступен — грузим по сети
  }
  return uri;
};

/**
 * Картинка с сервера с кэшем в памяти и на диске телефона: аватарки и фото из чатов грузятся один раз,
 * при повторном показе — сразу и без мобильного трафика. Плавное появление при первой загрузке.
 * recyclingKey — для списков: при переиспользовании строки не мелькает чужая картинка.
 */
export const CachedImage = ({ uri, style, contentFit = 'cover', transition = 150, onError, accessibilityLabel }) => (
  <Image
    source={uri ? { uri } : null}
    style={style}
    contentFit={contentFit}
    cachePolicy="memory-disk"
    recyclingKey={uri}
    transition={transition}
    onError={onError}
    accessibilityLabel={accessibilityLabel}
  />
);
