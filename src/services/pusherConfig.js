export const PUSHER_APP_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY ?? '88f644943a85b36b115e';
export const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? 'eu';

const channelPrefix = process.env.EXPO_PUBLIC_PUSHER_CHANNEL_PREFIX ?? '';

export const userChannel = (staffId) => `private-${channelPrefix}user.${staffId}`;
