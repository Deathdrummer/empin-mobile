const EXTENSION_BY_MIME = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extensionOf = (name) => /\.([a-zA-Z0-9]{1,8})$/.exec(name || '')?.[1] ?? null;

/**
 * Имя файла для другого приложения: с расширением (без него получатель не поймёт тип),
 * без символов, недопустимых в файловых системах и в адресе file://
 */
export const shareFileName = (item, index = 0) => {
  const fromUrl = safeDecode(String(item.uri || '').split(/[?#]/)[0].split('/').pop() || '');
  const base = String(item.name || fromUrl || `file-${index + 1}`).replace(/[\\/:*?"<>|#%]/g, '_').trim() || `file-${index + 1}`;
  if (extensionOf(base)) return base;
  const extension = extensionOf(fromUrl) || EXTENSION_BY_MIME[item.mime_type || item.mimeType];
  return extension ? `${base}.${extension}` : base;
};
