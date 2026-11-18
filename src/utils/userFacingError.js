const isReadableRussianMessage = (value) => (
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 180 &&
  /[А-Яа-яЁё]/.test(value) &&
  !/[{}<>]/.test(value)
);

const getServerMessage = (error) => {
  const data = error?.response?.data;
  const candidates = [data?.message, data?.error];

  if (data?.errors && typeof data.errors === 'object') {
    Object.values(data.errors).forEach((messages) => {
      if (Array.isArray(messages)) candidates.push(messages[0]);
      else candidates.push(messages);
    });
  }

  return candidates.find(isReadableRussianMessage);
};

export const getUserFacingError = (error, fallback = 'Не удалось выполнить операцию') => {
  const status = error?.response?.status;
  const serverMessage = getServerMessage(error);

  if (serverMessage) return serverMessage;

  if (
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT' ||
    error?.message?.toLowerCase?.().includes('timeout')
  ) {
    return 'Сервер не ответил вовремя. Попробуйте ещё раз.';
  }

  if (!error?.response && (error?.request || error?.message === 'Network Error')) {
    return 'Нет связи с сервером';
  }

  switch (status) {
    case 401:
      return 'Сессия истекла';
    case 403:
      return 'Недостаточно прав';
    case 404:
      return 'Данные не найдены';
    case 422:
      return 'Неверные данные';
    case 429:
      return 'Слишком много запросов. Попробуйте немного позже.';
    default:
      return status >= 500 ? 'Сервер временно недоступен. Попробуйте позже.' : fallback;
  }
};
