export const PUSHER_APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '88f644943a85b36b115e';
export const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? 'eu';

const channelPrefix = process.env.EXPO_PUBLIC_PUSHER_CHANNEL_PREFIX ?? '';

export const userChannel = (staffId) => `private-${channelPrefix}user.${staffId}`;

// Подпись канала не получена из-за сбоя сервера или связи — повтор с растущей паузой, дальше раз в 30 с
const AUTH_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];

export const authRetryDelay = (attempt) => AUTH_RETRY_DELAYS_MS[Math.min(attempt, AUTH_RETRY_DELAYS_MS.length - 1)];

// Повторять при временных ответах (сервер перезапускается, перегружен); отказ в доступе не повторять
export const isRetryableAuthStatus = (status) => status === 408 || status === 429 || status >= 500;
