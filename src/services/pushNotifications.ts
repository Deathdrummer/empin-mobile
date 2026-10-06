import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messengerAPI } from './api';

const EXPO_PUSH_TOKEN_STORAGE_KEY = '@expoPushToken';

// Настройка поведения уведомлений в foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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
      vibrationPattern: [0, 500, 500, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      enableLights: true,
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

    // На iOS device token нужен также для тихого push, закрывающего CallKit.
    // Его можно получить даже без разрешения на alert-уведомления.
    if (finalStatus !== 'granted' && Platform.OS !== 'ios') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? (Constants as any).easConfig?.projectId
      ?? 'f6eb001a-e226-4bfc-acd6-8b5e10107463';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // Отправляем токен на бэкенд (ошибку не пробрасываем — не критично)
    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_STORAGE_KEY, token);
    await messengerAPI.registerPushToken(token, Platform.OS).catch(() => {});

    return token;
  } catch (error: any) {
    console.error('[Push] Registration failed:', error?.message);
    return null;
  }
};

export const unregisterPushNotifications = async (): Promise<void> => {
  const token = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  await messengerAPI.unregisterPushToken(token).catch(() => {});
  await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_STORAGE_KEY);
};
