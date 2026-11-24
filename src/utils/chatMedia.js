const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.wma', '.webm', '.amr', '.3gp'];
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.mov', '.avi', '.mkv'];

const isAudioMime = (mimeType) => mimeType.startsWith('audio/') || mimeType === 'application/ogg';

// Изображение или видео (аудио сюда не относится, даже если mimeType неправильный)
export const isMediaFile = (media) => {
  if (!media) return false;
  if (media.mimeType) {
    if (isAudioMime(media.mimeType)) return false;
    return media.mimeType.startsWith('image/') || media.mimeType.startsWith('video/');
  }
  if (media.uri || media.name) {
    const fileName = (media.uri || media.name).toLowerCase();
    if (AUDIO_EXTENSIONS.some((ext) => fileName.endsWith(ext))) return false;
    return MEDIA_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  }
  return false;
};

export const isAudioFile = (media) => {
  if (!media) return false;
  if (media.mimeType && isAudioMime(media.mimeType)) return true;
  if (media.name || media.uri) {
    const fileName = (media.name || media.uri).toLowerCase();
    return AUDIO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  }
  return false;
};

// Медиа (изображения/видео), аудио и документы; аудио проверяется первым
export const separateMediaAndDocuments = (array) => {
  if (!array || array.length === 0) {
    return { media: [], audio: [], documents: [] };
  }
  const audio = array.filter((item) => isAudioFile(item));
  const media = array.filter((item) => !isAudioFile(item) && isMediaFile(item));
  const documents = array.filter((item) => !isAudioFile(item) && !isMediaFile(item));
  return { media, audio, documents };
};

/**
 * `keep_media` для правки сообщения (API план-графика): пути оставленных вложений, если какое-то
 * убрали; иначе `undefined` — сервер вложения не трогает (так же работает и старый сервер).
 */
export const keptMediaPaths = (original, kept) => {
  const before = (original || []).map((m) => m.path);
  const after = (kept || []).map((m) => m.path);
  if (after.length === before.length && after.every((path, i) => path === before[i])) return undefined;
  return after;
};

/** Сохранить правку можно с текстом или хотя бы с одним оставленным вложением. */
export const canSaveEdit = (text, kept) => !!(text && text.trim()) || (kept || []).length > 0;
