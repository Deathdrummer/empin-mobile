import RNShare from 'react-native-share';
import { Directory, File, Paths } from 'expo-file-system';
import Toast from 'react-native-toast-message';
import { normalizeMedia } from '../components/chat/MessageBubble';
import { shortName } from '../utils/chatFormat';
import { getUserFacingError } from '../utils/userFacingError';
import { restoreStatusBar } from '../utils/statusBar';

/**
 * «Поделиться» в другие приложения (WhatsApp, Telegram, почта, «Файлы»): текст, фото, видео, документы.
 * Файлы сначала скачиваются во временную папку — системное меню передаёт другим приложениям локальные файлы.
 */
const SHARE_DIR = 'share';

const safeName = (name, index) => {
  const base = String(name || `file-${index + 1}`).replace(/[\\/:*?"<>|]/g, '_');
  return `${index + 1}-${base}`;
};

/** Скачать вложения во временную папку; уже локальные (только что отправленные) берутся как есть */
const downloadMedia = async (media) => {
  const dir = new Directory(Paths.cache, SHARE_DIR);
  if (dir.exists) dir.delete();
  dir.create();

  return Promise.all(media.map(async (item, index) => {
    if (item.uri.startsWith('file://')) return { ...item, localUri: item.uri };
    const target = new File(dir, safeName(item.name || item.uri.split('/').pop(), index));
    const downloaded = await File.downloadFileAsync(item.uri, target);
    return { ...item, localUri: downloaded.uri };
  }));
};

/**
 * Текст сообщений для пересылки наружу. Одно сообщение — как есть; несколько — с авторами,
 * как при копировании в Telegram.
 */
export const messagesText = (messages, { withAuthors = messages.length > 1 } = {}) => messages
  .map((message) => {
    const text = message.type === 'poll' && message.poll
      ? [`Опрос: ${message.poll.question}`, ...(message.poll.options || []).map((option) => `— ${option.text ?? option}`)].join('\n')
      : (message.message || '').trim();
    if (!text) return null;
    return withAuthors && message.from ? `${shortName(message.from)}:\n${text}` : text;
  })
  .filter(Boolean)
  .join('\n\n');

/** Поделиться сообщениями: текст и все вложения одним системным меню */
export const shareMessages = async (messages) => {
  const media = messages.flatMap((message) => normalizeMedia(message.media));
  const message = messagesText(messages);
  if (!media.length && !message) return;

  try {
    if (!media.length) {
      await RNShare.open({ message, failOnCancel: false });
      return;
    }

    Toast.show({ type: 'info', text1: 'Готовим файлы…', position: 'top', visibilityTime: 1500 });
    const files = await downloadMedia(media);
    const types = [...new Set(files.map((file) => file.mime_type || file.mimeType).filter(Boolean))];

    await RNShare.open({
      urls: files.map((file) => file.localUri),
      filenames: files.map((file, index) => safeName(file.name, index)),
      type: types.length === 1 ? types[0] : undefined,
      message: message || undefined,
      failOnCancel: false,
    });
  } catch (error) {
    Toast.show({ type: 'error', text1: 'Не удалось поделиться', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
  } finally {
    // Системное меню на Android показывает строку состояния — приложение работает без неё
    restoreStatusBar();
  }
};

/** Поделиться одним файлом (из просмотра фото или видео) */
export const shareMediaItem = (item) => shareMessages([{ media: [item] }]);
