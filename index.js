import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import RNNotificationCall from 'react-native-full-screen-notification-incoming-call';
import AsyncStorage from '@react-native-async-storage/async-storage';

import App from './App';

// Обработчик FCM в background/killed — единственный надёжный способ на Android
// Expo Push API оборачивает наш data-объект в строку remoteMessage.data.body
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  const raw = remoteMessage.data ?? {};
  let data = raw;
  try {
    if (raw.body) data = JSON.parse(raw.body);
  } catch {}

  if (data.type === 'incoming_call') {
    const callId = String(data.call_id);

    // Сохраняем данные звонка — React state недоступен в headless контексте,
    // CallContext прочитает их при открытии приложения
    await AsyncStorage.setItem('@pendingCall', JSON.stringify({
      callId,
      caller: {
        id: data.caller_id,
        sname: data.caller_name ?? 'Неизвестный',
        fname: '',
        mname: '',
      },
      callType: 'audio',
    }));

    RNNotificationCall.displayNotification(
      callId,
      data.caller_avatar ?? null,
      30000,
      {
        channelId: 'calls_v2',
        channelName: 'Звонки',
        notificationIcon: 'ic_launcher',
        notificationTitle: data.caller_name ?? 'Входящий звонок',
        notificationBody: 'Входящий голосовой звонок',
        answerText: 'Ответить',
        declineText: 'Отклонить',
        notificationColor: 'colorPrimary',
        isVideo: false,
        notificationSound: 'default',
      }
    );
  }

  if (data.type === 'call_cancelled') {
    // FCM fallback: скрываем нативное окно звонка если app в killed/background
    // (WebSocket не работает в killed state — foreground обрабатывает через CallContext)
    await AsyncStorage.removeItem('@pendingCall');
    RNNotificationCall.hideNotification();
  }
});

registerRootComponent(App);
