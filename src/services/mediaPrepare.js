import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Video, createVideoThumbnail } from 'react-native-compressor';

// Как в Telegram: фото — до 2560 по длинной стороне, видео — 720p (1280 по длинной стороне)
const PHOTO_MAX_SIDE = 2560;
const PHOTO_QUALITY = 0.85;
const VIDEO_MAX_SIDE = 1280;
// Короткие лёгкие ролики не пережимаются — выигрыша нет, а качество теряется
const VIDEO_MIN_BYTES_TO_COMPRESS = 2 * 1024 * 1024;

const toFileUri = (path) => (!path || /^(file|content):/.test(path) ? path : `file://${path}`);
const withExtension = (name, extension) => `${(name || 'file').replace(/\.[^.]+$/, '')}.${extension}`;

// Только снятое и выбранное в галерее (expo-image-picker помечает type); «Файл» уходит как есть
const isPickedPhoto = (file) => file.type === 'image' && !/gif$/i.test(file.mimeType || file.name || '');
const isPickedVideo = (file) => file.type === 'video';

const preparePhoto = async (file) => {
  const longest = Math.max(file.width || 0, file.height || 0);
  if (!longest || longest <= PHOTO_MAX_SIDE) return file;
  const resize = file.width >= file.height ? { width: PHOTO_MAX_SIDE } : { height: PHOTO_MAX_SIDE };
  const result = await ImageManipulator.manipulateAsync(file.uri, [{ resize }], {
    compress: PHOTO_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return {
    ...file,
    uri: result.uri,
    width: result.width,
    height: result.height,
    name: withExtension(file.name || file.fileName, 'jpg'),
    fileName: withExtension(file.fileName || file.name, 'jpg'),
    mimeType: 'image/jpeg',
  };
};

const prepareVideo = async (file, onProgress) => {
  let uri = file.uri;
  let compressed = false;
  const bytes = file.fileSize || file.size || 0;
  if (!bytes || bytes >= VIDEO_MIN_BYTES_TO_COMPRESS) {
    try {
      uri = toFileUri(await Video.compress(file.uri, {
        compressionMethod: 'auto',
        maxSize: VIDEO_MAX_SIDE,
        minimumFileSizeForCompress: VIDEO_MIN_BYTES_TO_COMPRESS / (1024 * 1024),
      }, (progress) => onProgress?.(progress)));
      compressed = uri !== file.uri;
    } catch (error) {
      // Не сжалось (редкий формат) — отправляем как есть, но отправляем
      console.warn('[Media] Не удалось сжать видео:', error?.message ?? error);
      uri = file.uri;
    }
  }

  let thumbnail = null;
  try {
    thumbnail = await createVideoThumbnail(uri);
  } catch (error) {
    console.warn('[Media] Не удалось снять кадр видео:', error?.message ?? error);
  }

  return {
    ...file,
    uri,
    name: compressed ? withExtension(file.name || file.fileName, 'mp4') : file.name,
    fileName: compressed ? withExtension(file.fileName || file.name, 'mp4') : file.fileName,
    mimeType: compressed ? 'video/mp4' : file.mimeType,
    thumbnailUri: thumbnail?.path ? toFileUri(thumbnail.path) : undefined,
    width: thumbnail?.width || file.width,
    height: thumbnail?.height || file.height,
    // expo-image-picker даёт длительность в миллисекундах
    durationSeconds: file.durationSeconds ?? (file.duration ? file.duration / 1000 : undefined),
  };
};

/**
 * Вложения перед отправкой: видео сжимается и получает кадр-превью, большие фото уменьшаются.
 * onProgress({ stage: 'compress', value 0…1 }) — для плитки «Сжатие 45%».
 * Ошибка одного файла не мешает остальным — он уходит как есть.
 */
export const prepareMediaForUpload = async (files, onProgress) => {
  const result = [];
  const videos = files.filter(isPickedVideo).length;
  let videoIndex = 0;
  for (const file of files) {
    try {
      if (isPickedVideo(file)) {
        const index = videoIndex;
        videoIndex += 1;
        result.push(await prepareVideo(file, (value) => onProgress?.({ stage: 'compress', value: (index + value) / videos })));
      } else if (isPickedPhoto(file)) {
        result.push(await preparePhoto(file));
      } else {
        result.push(file);
      }
    } catch (error) {
      console.warn('[Media] Не удалось подготовить вложение:', error?.message ?? error);
      result.push(file);
    }
  }
  return result;
};

/** Нужна ли подготовка (есть видео или фото из галереи/камеры) */
export const needsPreparation = (files) => (files || []).some((file) => isPickedVideo(file) || isPickedPhoto(file));

export const __test = { isPickedPhoto, isPickedVideo, toFileUri, withExtension, platform: Platform.OS };
