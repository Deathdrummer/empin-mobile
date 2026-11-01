// Отдельно от React/нативного моста: жизненный цикл RTC можно проверить с SDK-заглушкой.
// 0 от joinChannel означает только принятую команду, а не установленное соединение.
export const requireRtcSuccess = (result, operation) => {
  if (typeof result !== 'number' || result !== 0) {
    const error = new Error(`Не удалось подключить звонок: ${operation} (${result ?? 'нет ответа SDK'})`);
    error.rtcCode = result;
    throw error;
  }
};

export const connectAudio = ({
  engine, appId, token, channelName, uid, sdk,
  onLocalJoined, onConnected, onOffline, onFailure,
  onDiagnostic = (_event, _details = {}) => {}, timeoutMs = 20000,
}) => {
  if (typeof appId !== 'string' || !/^[a-f0-9]{32}$/i.test(appId)
    || typeof token !== 'string' || !token || typeof channelName !== 'string' || !channelName
    || !Number.isInteger(uid) || uid <= 0 || uid > 0xffffffff) {
    throw new Error('Сервер вернул неверные параметры подключения звонка');
  }

  let disposed = false;
  let failed = false;
  let localJoined = false;
  let peerJoined = false;
  let connected = false;
  let joinTimer = null;
  let peerTimer = null;
  const clearTimers = () => {
    clearTimeout(joinTimer);
    clearTimeout(peerTimer);
    joinTimer = peerTimer = null;
  };
  const fail = (message, code, event = 'rtc-failed') => {
    if (disposed || failed) return;
    failed = true;
    clearTimers();
    onDiagnostic(event, { code });
    onFailure(message, code);
  };
  const finishConnecting = () => {
    if (!localJoined || !peerJoined || connected) return;
    connected = true;
    clearTimers();
    onConnected();
  };
  const live = (callback) => (...args) => {
    if (!disposed && !failed) callback(...args);
  };
  const handler = {
    onJoinChannelSuccess: live(() => {
      localJoined = true;
      clearTimeout(joinTimer);
      joinTimer = null;
      onDiagnostic('local-joined');
      onLocalJoined?.();
      finishConnecting();
    }),
    onUserJoined: live((_connection, uid, elapsed) => {
      peerJoined = true;
      onDiagnostic('peer-joined', { uid, elapsed });
      finishConnecting();
    }),
    onUserOffline: live((_connection, uid, reason) => {
      onDiagnostic('peer-offline', { uid, reason });
      onOffline();
    }),
    onConnectionStateChanged: live((_connection, state, reason) => {
      onDiagnostic('connection', { state, reason });
      if (state === sdk.failedState) fail(`Не удалось подключиться к серверу звонков (Agora ${reason})`, reason);
      if (state === sdk.reconnectingState && !joinTimer) {
        joinTimer = setTimeout(() => fail('Связь во время звонка потеряна. Повторите вызов.', undefined, 'rtc-reconnect-timeout'), timeoutMs);
      }
      if (state === sdk.connectedState && localJoined) {
        clearTimeout(joinTimer);
        joinTimer = null;
      }
    }),
    onError: live((code) => {
      // Не пишем текст SDK: он может содержать токен или параметры канала.
      onDiagnostic('error', { code });
      if ([101, 109, 110].includes(code)) fail(`Сервер звонков отклонил подключение (Agora ${code})`, code);
    }),
    onLocalAudioStateChanged: live((_connection, state, reason) => {
      onDiagnostic('local-audio', { state, reason });
      if (state === sdk.audioFailedState && reason === sdk.noAudioPermission) {
        fail('Нет доступа к микрофону. Разрешите его в настройках устройства.', reason);
      }
    }),
    onRemoteAudioStateChanged: live((_connection, uid, state, reason) => {
      onDiagnostic('remote-audio', { uid, state, reason });
    }),
    onFirstLocalAudioFramePublished: live((_connection, elapsed) => {
      onDiagnostic('first-local-audio', { elapsed });
    }),
    onAudioSubscribeStateChanged: live((_channel, uid, _oldState, state, elapsed) => {
      onDiagnostic('audio-subscription', { uid, state, elapsed });
    }),
  };
  const dispose = () => {
    disposed = true;
    clearTimers();
    engine.unregisterEventHandler(handler);
  };
  try {
    requireRtcSuccess(engine.initialize({ appId, channelProfile: sdk.communication }), 'initialize');
    engine.registerEventHandler(handler);
    requireRtcSuccess(engine.enableAudio(), 'enableAudio');
    requireRtcSuccess(engine.setAudioProfile(sdk.audioProfile, sdk.audioScenario), 'setAudioProfile');
    // Маршрут по умолчанию задаётся до входа. setEnableSpeakerphone предназначен для переключения
    // уже идущего звонка; до подключения он мог не примениться.
    const routeResult = engine.setDefaultAudioRouteToSpeakerphone(false);
    if (routeResult !== 0) onDiagnostic('audio-route', { code: routeResult });
    joinTimer = setTimeout(() => fail('Не удалось соединить звонок. Проверьте сеть и повторите вызов.', undefined, 'rtc-join-timeout'), timeoutMs);
    requireRtcSuccess(engine.joinChannel(token, channelName, uid, {
      clientRoleType: sdk.broadcaster,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
    }), 'joinChannel');
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    dispose,
    peerAccepted: () => {
      if (disposed || failed || connected || peerTimer) return;
      // Ответ через API/push ещё не доказывает, что собеседник вошёл в RTC-канал.
      peerTimer = setTimeout(() => fail('Собеседник ответил, но голосовое соединение не установлено. Повторите вызов.', undefined, 'rtc-peer-timeout'), timeoutMs);
    },
  };
};
