// Как в поле ввода (Composer): больше за раз не отправить
export const MAX_SHARED_FILES = 10;

// Android отдаёт путь как есть (кириллица, пробелы, #, %), iOS — уже готовый адрес
const encodeRawPath = (path) => {
  if (!path?.startsWith('file://')) return path;
  return `file://${path.slice('file://'.length).split('/').map(encodeURIComponent).join('/')}`;
};

const toAsset = (file, rawPaths) => {
  const mimeType = file.mimeType || undefined;
  const kind = /^(image|video)\//.exec(mimeType || '')?.[1];
  return {
    uri: rawPaths ? encodeRawPath(file.path) : file.path,
    name: file.fileName || undefined,
    fileName: file.fileName || undefined,
    mimeType,
    type: kind,
    width: file.width || undefined,
    height: file.height || undefined,
    fileSize: file.size || undefined,
    duration: file.duration || undefined,
  };
};

/**
 * То, чем поделились из другого приложения, — в виде текста и вложений поля ввода
 * (тот же формат, что у галереи и выбора файла). null — отправлять нечего.
 */
export const sharedContent = (intent, { rawPaths = false } = {}) => {
  const text = String(intent?.text || intent?.webUrl || '').trim();
  const files = (intent?.files || []).filter((file) => file?.path).map((file) => toAsset(file, rawPaths));
  if (!text && !files.length) return null;
  return {
    text,
    files: files.slice(0, MAX_SHARED_FILES),
    dropped: Math.max(0, files.length - MAX_SHARED_FILES),
  };
};

/** HEIC с iPhone: на других телефонах и в вебе не откроется */
export const isHeic = (file) => /(hei[cf])$/i.test(file?.mimeType || file?.fileName || file?.name || '');
