/**
 * Кнопки уведомления о сообщении («Ответить», «Прочитано») — чистые помощники без React Native.
 */

export const MESSAGE_CATEGORY = 'message';
export const REPLY_ACTION = 'reply';
export const READ_ACTION = 'read';

// Сколько последних обработанных нажатий помнить: одно и то же нажатие может прийти несколько раз
const HANDLED_LIMIT = 50;
// Ключ попытки на сервере — не длиннее 64 символов
const CLIENT_KEY_LENGTH = 64;

export const isMessageAction = (response) => [REPLY_ACTION, READ_ACTION].includes(response?.actionIdentifier);

/**
 * Наши данные из уведомления. В фоновую задачу Android они могут прийти строкой dataString
 * (обработчики в приложении получают уже разобранные)
 */
export const responseData = (response) => {
  const content = response?.notification?.request?.content || {};
  if (content.data && typeof content.data === 'object') return content.data;
  try {
    return typeof content.dataString === 'string' ? JSON.parse(content.dataString) : {};
  } catch {
    return {};
  }
};

/** Одно нажатие — один ключ: по нему не отправляем ответ дважды (задача Android, обработчик, запуск приложения) */
export const actionKey = (response) => {
  const identifier = response?.notification?.request?.identifier;
  return identifier && response?.actionIdentifier ? `${identifier}:${response.actionIdentifier}` : null;
};

export const clientKeyFor = (key) => String(key).slice(-CLIENT_KEY_LENGTH);

/** Список обработанных нажатий с новым ключом: последние HANDLED_LIMIT */
export const withHandled = (list, key) => [...(Array.isArray(list) ? list : []).filter((item) => item !== key), key]
  .slice(-HANDLED_LIMIT);
