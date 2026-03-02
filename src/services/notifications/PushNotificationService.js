import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy import для expo-notifications (может быть недоступен в Expo Go)
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (_error) {
}

class PushNotificationService {
  constructor() {
    this.messageListeners = [];
    this.notificationListener = null;
    this.responseListener = null;
    this.isAvailable = !!Notifications;
  }

  /**
   * Инициализация Expo Notifications
   */
  async init() {
    // Проверка доступности expo-notifications
    if (!this.isAvailable) {
      return;
    }

    try {
      // Настройка поведения уведомлений в foreground
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // Запрос разрешения на уведомления
      const hasPermission = await this.requestPermission();

      if (!hasPermission) {
        return;
      }

      // Получение Expo Push Token
      const token = await this.getToken();
      if (token) {
        await AsyncStorage.setItem('expo_push_token', token);
      }

      // Обработка foreground уведомлений
      this.setupForegroundListener();

      // Обработка кликов по уведомлениям
      this.setupResponseListener();

      // Обработка начального уведомления (если приложение было закрыто)
      this.setupInitialNotification();

    } catch (error) {
      console.error('Failed to initialize PushNotificationService:', error);
    }
  }

  /**
   * Запрос разрешения на уведомления
   */
  async requestPermission() {
    if (!this.isAvailable) return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // Android требует канал уведомлений
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  }

  /**
   * Получение Expo Push Token
   */
  async getToken() {
    if (!this.isAvailable) return null;

    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'f6eb001a-e226-4bfc-acd6-8b5e10107463', // из app.json extra.eas.projectId
      });
      return token.data;
    } catch (error) {
      console.error('Failed to get Expo Push Token:', error);
      return null;
    }
  }

  /**
   * Обработка foreground уведомлений
   */
  setupForegroundListener() {
    if (!this.isAvailable) return;

    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      // Преобразуем в формат, совместимый с Firebase
      const message = {
        data: notification.request.content.data,
        notification: notification.request.content,
      };

      // Уведомляем всех слушателей
      this.messageListeners.forEach((listener) => {
        listener(message);
      });
    });
  }

  /**
   * Обработка кликов по уведомлениям
   */
  setupResponseListener() {
    if (!this.isAvailable) return;

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      // Преобразуем в формат, совместимый с Firebase
      const message = {
        data: response.notification.request.content.data,
        notification: response.notification.request.content,
      };

      // Уведомляем слушателей о клике по уведомлению
      this.messageListeners.forEach((listener) => {
        listener(message, true); // true = opened from notification
      });
    });
  }

  /**
   * Обработка начального уведомления (приложение было закрыто)
   */
  async setupInitialNotification() {
    if (!this.isAvailable) return;

    const response = await Notifications.getLastNotificationResponseAsync();

    if (response) {
      // Преобразуем в формат, совместимый с Firebase
      const message = {
        data: response.notification.request.content.data,
        notification: response.notification.request.content,
      };

      // Уведомляем слушателей
      this.messageListeners.forEach((listener) => {
        listener(message, true);
      });
    }
  }

  /**
   * Подписка на уведомления
   * @param {Function} callback - Функция обработчик (notification, openedFromNotification)
   * @returns {Function} Unsubscribe функция
   */
  onMessage(callback) {
    this.messageListeners.push(callback);

    // Возвращаем функцию отписки
    return () => {
      const index = this.messageListeners.indexOf(callback);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  /**
   * Очистка listeners (вызывать при unmount)
   */
  cleanup() {
    if (!this.isAvailable) return;

    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    this.messageListeners = [];
  }

  /**
   * Обработка входящего звонка
   * @param {Object} data - Данные звонка из push notification
   * @returns {Object} Parsed call data
   */
  parseIncomingCallData(data) {
    return {
      callId: data.call_id,
      callerId: data.caller_id,
      callerName: data.caller_name,
      callerAvatar: data.caller_avatar,
      sessionId: data.session_id,
      token: data.token,
    };
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
