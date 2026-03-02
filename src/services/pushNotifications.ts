import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { messengerAPI } from './api';

// Настройка поведения уведомлений в foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Настройка Android-канала для звонков
 */
const setupAndroidChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Звонки',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }
};

/**
 * Запросить разрешения и зарегистрировать Expo Push Token.
 * Отправляет токен на бэкенд при первом получении или смене.
 * Возвращает null если разрешения не выданы.
 */
export const registerPushNotifications = async (): Promise<string | null> => {
  try {
    await setupAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? (Constants as any).easConfig?.projectId
      ?? 'f6eb001a-e226-4bfc-acd6-8b5e10107463';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // Отправляем токен на бэкенд (ошибку не пробрасываем — не критично)
    await messengerAPI.registerPushToken(token).catch(() => {});

    return token;
  } catch (error: any) {
    console.error('[Push] Registration failed:', error?.message);
    return null;
  }
};
