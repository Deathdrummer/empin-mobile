import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messengerAPI } from './api';
import { getActiveChatId } from './messengerStore';
import { ensureMessagesChannel } from './messagePush';
import { createDeviceRegistration } from './deviceRegistration';
import { recordCallDiagnostic } from './callDiagnostics';

const EXPO_PUSH_TOKEN_STORAGE_KEY = '@expoPushToken';

// Настройка поведения уведомлений в foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data: any = notification.request.content.data;
    // Сообщение из открытого сейчас чата пользователь и так видит на экране
    const fromOpenChat = data?.type === 'message' && Number(data.chat_id) === getActiveChatId();
    return {
      shouldShowBanner: !fromOpenChat,
      shouldShowList: !fromOpenChat,
      shouldPlaySound: !fromOpenChat,
      shouldSetBadge: false,
    };
  },
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
const obtainPushToken = async (askPermission = true): Promise<string | null> => {
  try {
    await setupAndroidChannel();
    await ensureMessagesChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted' && askPermission) {
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
    return token;
  } catch (error: any) {
    console.error('[Push] Registration failed:', error?.message);
    throw error;
  }
};

export const registerPushNotifications = async (): Promise<string | null> => {
  try {
    const token = await obtainPushToken();
    if (token) await messengerAPI.registerPushToken(token, Platform.OS);
    return token;
  } catch { return null; }
};

export const startPushRegistration = (): (() => void) => {
  let askPermission = true;
  const registration = createDeviceRegistration({
    getToken: async () => {
      const ask = askPermission;
      askPermission = false;
      return obtainPushToken(ask);
    },
    sendToken: (token: string, signal: AbortSignal) => messengerAPI.registerPushToken(token, Platform.OS, signal),
    onState: (state, details) => recordCallDiagnostic(`push-registration-${state}`, details),
  });
  registration.sync();
  const foreground = AppState.addEventListener('change', (state) => {
    if (state === 'active') registration.sync(true);
  });
  return () => { registration.dispose(); foreground.remove(); };
};

export const unregisterPushNotifications = async (): Promise<void> => {
  const token = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  await messengerAPI.unregisterPushToken(token).catch(() => {});
  await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_STORAGE_KEY);
};
