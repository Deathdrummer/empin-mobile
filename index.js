import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import App from './App';
import { endWithoutCallScreen, incomingCallEvents } from './src/services/incomingCallEvents';

if (Platform.OS === 'android') {
  // «Ответить» / «Прочитано» в уведомлении о сообщении, когда приложение свёрнуто или закрыто:
  // expo-notifications запускает эту задачу (на iOS такие задачи не запускаются — там обработчик в приложении)
  const TaskManager = require('expo-task-manager');
  const Notifications = require('expo-notifications');
  const MESSAGE_ACTIONS_TASK = 'message-notification-actions';
  TaskManager.defineTask(MESSAGE_ACTIONS_TASK, async ({ data }) => {
    if (!data || !('actionIdentifier' in data)) return;
    const { handleMessageAction } = require('./src/services/messageActions');
    await handleMessageAction(data).catch(() => {});
  });
  Notifications.registerTaskAsync(MESSAGE_ACTIONS_TASK).catch(() => {});

  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  const incomingCallModule = require('react-native-full-screen-notification-incoming-call');
  const RNNotificationCall = incomingCallModule.default ?? incomingCallModule;

  // «Отклонить» и тайм-аут окна звонка, когда приложение выгружено: экрана звонков нет, и без этого сервер
  // не узнаёт об отказе — у звонящего вызов продолжается. Подписка раньше, чем в CallContext, поэтому его
  // removeEventListener('endCall') снимает только свою
  RNNotificationCall.addEventListener('endCall', async (event) => {
    const ended = endWithoutCallScreen(event);
    if (!ended) return;
    incomingCallEvents.finish(ended.callId);
    RNNotificationCall.hideNotification();
    try {
      const stored = JSON.parse((await AsyncStorage.getItem('@pendingCall')) || 'null');
      if (String(stored?.callId) === ended.callId) await AsyncStorage.removeItem('@pendingCall');
    } catch {}
    if (!(await AsyncStorage.getItem('token'))) return;

    const { messengerAPI } = require('./src/services/api');
    const { CALL_CAUSES: C } = require('./src/services/callDiagnosticFormat');
    const { recordCallDiagnostic } = require('./src/services/callDiagnostics');
    const cause = ended.how === 'timeout' ? C.incomingTimeout : C.androidEnd;
    recordCallDiagnostic('android-end-without-app', { callId: ended.callId, cause });
    await (ended.how === 'timeout'
      ? messengerAPI.endCall(ended.callId, cause)
      : messengerAPI.rejectCall(ended.callId, cause)).catch(() => {});
  });

  // Обработчик FCM в background/killed — единственный надёжный способ на Android
  // Expo Push API оборачивает наш data-объект в строку remoteMessage.data.body
  setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
    const raw = remoteMessage.data ?? {};
    let data = raw;
    try {
      if (raw.body) data = JSON.parse(raw.body);
    } catch {}

    if (data.type === 'incoming_call') {
      // Не показываем звонок от устаревшей серверной привязки после выхода.
      const authToken = await AsyncStorage.getItem('token');
      if (!authToken) return;

      const callId = String(data.call_id);
      if (!incomingCallEvents.canPresent(callId, data.expires_at)) return;
      // Не открываем системный вызов из push, если сервер уже закончил этот звонок.
      try {
        const { messengerAPI } = require('./src/services/api');
        const response = await messengerAPI.getCallDetails(callId);
        if (!['initiated', 'ringing'].includes(response?.call?.status)) {
          incomingCallEvents.finish(callId);
          return;
        }
      } catch (error) {
        if ([401, 403, 404].includes(error?.response?.status)) return;
      }
      if (!incomingCallEvents.canPresent(callId, data.expires_at)) return;

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
        expiresAt: data.expires_at,
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

    if (data.type === 'message') {
      // Уведомление о сообщении показываем сами (см. messagePush); после выхода — не показываем
      const authToken = await AsyncStorage.getItem('token');
      if (!authToken) return;
      const { presentMessagePush } = require('./src/services/messagePush');
      await presentMessagePush(raw, data).catch(() => {});
    }

    if (['call_cancelled', 'call_ended', 'call_answered_elsewhere'].includes(data.type)) {
      incomingCallEvents.finish(data.call_id);
      // FCM fallback: скрываем нативное окно звонка если app в killed/background
      // (WebSocket не работает в killed state — foreground обрабатывает через CallContext)
      const pending = await AsyncStorage.getItem('@pendingCall');
      let pendingId;
      try { pendingId = pending ? JSON.parse(pending).callId : null; } catch {}
      if (!pendingId || String(pendingId) === String(data.call_id)) {
        await AsyncStorage.removeItem('@pendingCall');
        RNNotificationCall.hideNotification();
      }
    }
  });
}

registerRootComponent(App);
