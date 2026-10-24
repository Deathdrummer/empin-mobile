import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, PermissionsAndroid, Platform, Alert } from 'react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Asset } from 'expo-asset';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  IRtcEngineEventHandler,
  ChannelProfileType,
  ClientRoleType,
  AudioScenarioType,
  AudioProfileType,
  ConnectionStateType,
  UserOfflineReasonType,
} from 'react-native-agora';
import { messengerAPI } from '../api';
import { CallStatus, CallData, CallState } from './types';
import { getUserFacingError } from '../../utils/userFacingError';

interface UseCallReturn extends CallState {
  initiateCall: (calleeId: number, calleeName: string, calleeAvatar?: string) => Promise<void>;
  /** true — звонок принят и подключение к каналу запущено */
  acceptCall: (callId: string, participant?: CallData['participant']) => Promise<boolean>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  resetToIdle: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  clearRingingTimeout: () => void;
}

/**
 * Сервер должен узнать о завершении звонка, иначе у собеседника продолжит звонить, а звонок останется
 * незавершённым. Экран сети не ждёт: при сбое (нет связи, 5xx, 429) запрос повторяется в фоне.
 */
const notifyServer = (label: string, request: () => Promise<unknown>, attempt = 1): void => {
  request().catch((error: any) => {
    const status = error?.response?.status;
    const retryable = !status || status >= 500 || status === 429;
    if (retryable && attempt < 3) {
      setTimeout(() => notifyServer(label, request, attempt + 1), attempt * 2000);
      return;
    }
    console.warn(`[Agora] ${label}: сервер не получил запрос`, status ?? error?.message);
  });
};

/**
 * Гудок вызова (425 Гц, 1 с звук / 4 с тишина): файл из сборки → путь на диске для Agora.
 * Готовится один раз; при ошибке звонок идёт без гудков.
 */
let ringbackPathPromise: Promise<string | null> | null = null;
const getRingbackPath = (): Promise<string | null> => {
  if (!ringbackPathPromise) {
    ringbackPathPromise = Asset.fromModule(require('../../../assets/sounds/ringback.wav'))
      .downloadAsync()
      .then((asset) => (asset.localUri ? decodeURI(asset.localUri.replace(/^file:\/\//, '')) : null))
      .catch(() => null);
  }
  return ringbackPathPromise;
};

export const useCall = (): UseCallReturn => {
  const [state, setState] = useState<CallState>({
    status: 'idle',
    callData: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineRef = useRef<IRtcEngine | null>(null);
  const eventHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  // Звонок, к каналу которого подключён движок: о его внезапном обрыве нужно сообщить серверу
  const callIdRef = useRef<string | null>(null);
  // Номер попытки звонка. Отмена, отказ или сброс увеличивают его: ответ сервера на устаревшую
  // попытку (нажали «Отменить», пока шёл запрос) не должен «воскрешать» звонок
  const attemptRef = useRef(0);
  // Исходящий ждёт ответа: звучат гудки
  const ringbackRef = useRef(false);

  const stopRingingTimeout = () => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  };

  const finishCallOnServer = () => {
    const callId = callIdRef.current;
    callIdRef.current = null;
    if (callId) {
      notifyServer('Завершение звонка', () => messengerAPI.endCall(callId));
    }
  };

  // Таймер длительности звонка
  useEffect(() => {
    if (state.status === 'active') {
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status]);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      destroyEngine();
    };
  }, []);

  const scheduleIdleReset = (fromStatus: CallStatus) => {
    setTimeout(() => {
      setState((prev) =>
        prev.status === fromStatus
          ? { status: 'idle', callData: null, duration: 0, isMuted: false, isSpeakerOn: false, error: null }
          : prev
      );
    }, 3000);
  };

  // Гудки — только у звонящего (loopback): собеседник их не слышит
  const startRingback = async () => {
    const filePath = await getRingbackPath();
    const engine = engineRef.current;
    if (!filePath || !engine || !ringbackRef.current) return;
    try {
      engine.startAudioMixing(filePath, true, -1);
      engine.adjustAudioMixingPlayoutVolume(70);
    } catch (error: any) {
      console.warn('[Agora] Гудки не включились:', error?.message ?? error);
    }
  };

  const stopRingback = () => {
    if (!ringbackRef.current) return;
    ringbackRef.current = false;
    try {
      engineRef.current?.stopAudioMixing();
    } catch {}
  };

  const destroyEngine = () => {
    stopRingback();
    if (engineRef.current) {
      if (eventHandlerRef.current) {
        engineRef.current.unregisterEventHandler(eventHandlerRef.current);
        eventHandlerRef.current = null;
      }
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Разрешение на использование микрофона',
            message: 'Приложению необходим доступ к микрофону для аудиозвонков',
            buttonPositive: 'Разрешить',
            buttonNegative: 'Отказать',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }

    if (Platform.OS === 'ios') {
      try {
        const current = await getRecordingPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        // Из фона (ответ через CallKit на заблокированном экране) системный запрос не покажется.
        // Разрешение запрашивается заранее после входа, здесь не блокируем звонок.
        if (AppState.currentState !== 'active') return true;
        return (await requestRecordingPermissionsAsync()).granted;
      } catch {
        return true;
      }
    }

    return true;
  };

  /**
   * Инициализация Agora engine и подключение к каналу.
   * appId — возвращается бэкендом вместе с токеном.
   */
  const joinChannel = async (
    appId: string,
    token: string,
    channelName: string,
    uid: number
  ): Promise<void> => {
    destroyEngine();

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    engine.initialize({
      appId,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    // Включаем аудио, настраиваем профиль для голосового звонка
    engine.enableAudio();
    engine.setAudioProfile(
      AudioProfileType.AudioProfileDefault,
      AudioScenarioType.AudioScenarioChatroom
    );
    engine.adjustPlaybackSignalVolume(150);

    // По умолчанию — наушник (не громкая связь)
    engine.setEnableSpeakerphone(false);

    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: (_connection, _elapsed) => {
        // Исходящий: в канале, собеседник ещё не ответил — гудки
        if (ringbackRef.current) startRingback();
      },

      onUserJoined: (_connection, _remoteUid, _elapsed) => {
        // Второй участник зашёл — звонок активен
        stopRingback();
        if (ringingTimeoutRef.current) {
          clearTimeout(ringingTimeoutRef.current);
          ringingTimeoutRef.current = null;
        }
        setState((prev) => ({ ...prev, status: 'active' }));
      },

      onUserOffline: (_connection, _remoteUid, _reason) => {
        // Второй участник покинул канал — завершаем звонок
        setState((prev) => {
          if (prev.status === 'active' || prev.status === 'ringing') {
            scheduleIdleReset('ended');
            return { ...prev, status: 'ended' };
          }
          return prev;
        });
        // Если собеседник пропал без запроса end (обрыв сети), звонок на сервере остался бы активным.
        // Если он завершил штатно, повторный end сервер игнорирует.
        stopRingingTimeout();
        finishCallOnServer();
        destroyEngine();
      },

      onConnectionStateChanged: (_connection, newState, _reason) => {
        if (newState === ConnectionStateType.ConnectionStateFailed) {
          console.error('[Agora] Connection failed');
          setState((prev) => {
            if (prev.status !== 'idle' && prev.status !== 'ended') {
              scheduleIdleReset('error');
              return { ...prev, status: 'error', error: 'Ошибка соединения' };
            }
            return prev;
          });
          stopRingingTimeout();
          finishCallOnServer();
          destroyEngine();
        }
      },

      onError: (err, msg) => {
        console.error('[Agora] Error:', err, msg);
      },
    };

    eventHandlerRef.current = handler;
    engine.registerEventHandler(handler);

    engine.joinChannel(token, channelName, uid, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
    });
  };

  /**
   * Инициация исходящего звонка
   */
  const initiateCall = useCallback(
    async (calleeId: number, calleeName: string, calleeAvatar?: string) => {
      const attempt = ++attemptRef.current;
      try {
        const hasPermission = await requestMicrophonePermission();
        if (attempt !== attemptRef.current) return;
        if (!hasPermission) {
          Alert.alert(
            'Нет доступа к микрофону',
            'Разрешите доступ к микрофону в настройках устройства'
          );
          return;
        }

        callIdRef.current = null;
        setState((prev) => ({ ...prev, status: 'initiating' }));

        const response = await messengerAPI.initiateCall(calleeId);

        if (attempt !== attemptRef.current) {
          // Пока создавался звонок, его уже отменили: у собеседника он не должен звонить
          if (response?.call_id) {
            notifyServer('Отмена звонка', () => messengerAPI.endCall(String(response.call_id)));
          }
          return;
        }

        if (!response.call_id || !response.token || !response.channel_name || !response.agora_app_id) {
          throw new Error(response.message || 'Некорректный ответ сервера');
        }

        const { call_id, channel_name, token, uid, agora_app_id } = response;
        callIdRef.current = String(call_id);

        const callData: CallData = {
          callId: String(call_id),
          channelName: channel_name,
          token,
          uid,
          participant: {
            id: calleeId,
            name: calleeName,
            avatar: calleeAvatar,
          },
          isIncoming: false,
        };

        setState((prev) => ({ ...prev, status: 'ringing', callData, error: null }));

        await joinChannel(agora_app_id, token, channel_name, uid);
        // Флаг после joinChannel: тот пересоздаёт движок и сбрасывает гудки прежнего
        ringbackRef.current = true;

        // Таймаут: страховка если call_cancelled FCM не пришёл.
        // Сбрасывается при любом завершении звонка, поэтому срабатывает только для этого звонка.
        ringingTimeoutRef.current = setTimeout(() => {
          ringingTimeoutRef.current = null;
          setState((prev) => {
            if (prev.status === 'ringing') {
              scheduleIdleReset('no_answer');
              return { ...prev, status: 'no_answer' };
            }
            return prev;
          });
          // Никто не ответил: сервер отменит звонок, и у собеседника он перестанет звонить
          finishCallOnServer();
          destroyEngine();
        }, 90000); // Увеличен с 45s до 90s — WebSocket обычно уведомит раньше
      } catch (error: any) {
        console.error('[Agora] Ошибка инициации звонка:', error);
        if (attempt !== attemptRef.current) return;
        stopRingingTimeout();
        // Звонок мог успеть создаться на сервере — отменяем, чтобы у собеседника не звонило
        finishCallOnServer();
        destroyEngine();
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: getUserFacingError(error, 'Не удалось инициировать звонок.'),
        }));
        scheduleIdleReset('error');
      }
    },
    []
  );

  /**
   * Принятие входящего звонка
   */
  const acceptCall = useCallback(async (callId: string, participant?: CallData['participant']) => {
    const attempt = ++attemptRef.current;
    try {
      const hasPermission = await requestMicrophonePermission();
      if (attempt !== attemptRef.current) return false;
      if (!hasPermission) {
        Alert.alert(
          'Нет доступа к микрофону',
          'Разрешите доступ к микрофону в настройках устройства'
        );
        return false;
      }

      callIdRef.current = null;
      const response = await messengerAPI.acceptCall(callId);
      if (attempt !== attemptRef.current) {
        // Пока принимали, звонок отклонили или он завершился — сервер уже считает его принятым
        notifyServer('Завершение звонка', () => messengerAPI.endCall(String(callId)));
        return false;
      }
      const { channel_name, token, uid, agora_app_id } = response;
      callIdRef.current = String(callId);

      setState((prev) => ({
        ...prev,
        status: 'active',
        callData: prev.callData
          ? { ...prev.callData, channelName: channel_name, token, uid }
          : {
              callId: String(callId),
              channelName: channel_name,
              token,
              uid,
              participant: participant ?? {
                id: 0,
                name: 'Неизвестный',
              },
              isIncoming: true,
            },
      }));

      await joinChannel(agora_app_id, token, channel_name, uid);
      return true;
    } catch (error: any) {
      console.error('[Agora] Ошибка принятия звонка:', error, '| response data:', (error as any).response?.data, '| callId was:', callId);
      if (attempt !== attemptRef.current) return false;
      // Сервер уже отметил звонок принятым, а подключиться не удалось — завершаем его на сервере
      finishCallOnServer();
      destroyEngine();
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: getUserFacingError(error, 'Не удалось принять звонок.'),
      }));
      scheduleIdleReset('error');
      return false;
    }
  }, []);

  /**
   * Отклонение звонка
   */
  const rejectCall = useCallback(async (callId: string) => {
    // Раньше при ошибке запроса (например, 429) состояние не сбрасывалось, а сервер не узнавал об отказе
    notifyServer('Отклонение звонка', () => messengerAPI.rejectCall(callId));
    attemptRef.current += 1;
    callIdRef.current = null;
    stopRingingTimeout();
    destroyEngine();
    setState({
      status: 'idle',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
    });
  }, []);

  /**
   * Завершение звонка
   */
  const endCall = useCallback(async () => {
    // Раньше при ошибке запроса (например, 429) звонок у собеседника продолжал звонить, а движок
    // оставался в канале: звонящий нажимал вызов снова, и собеседнику приходил второй входящий
    const callId = state.callData?.callId ?? callIdRef.current;
    attemptRef.current += 1;
    callIdRef.current = null;
    if (callId) {
      notifyServer('Завершение звонка', () => messengerAPI.endCall(callId));
    }
    stopRingingTimeout();
    destroyEngine();
    setState({
      status: 'ended',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
    });
    setTimeout(() => {
      setState((prev) => (prev.status === 'ended' ? { ...prev, status: 'idle' } : prev));
    }, 2000);
  }, [state.callData]);

  /**
   * Вкл/выкл микрофон
   */
  const toggleMute = useCallback(() => {
    if (!engineRef.current) return;
    const newMuted = !state.isMuted;
    engineRef.current.muteLocalAudioStream(newMuted);
    setState((prev) => ({ ...prev, isMuted: newMuted }));
  }, [state.isMuted]);

  /**
   * Переключение динамик/наушники
   */
  const toggleSpeaker = useCallback(() => {
    if (!engineRef.current) return;
    const newSpeakerOn = !state.isSpeakerOn;
    engineRef.current.setEnableSpeakerphone(newSpeakerOn);
    setState((prev) => ({ ...prev, isSpeakerOn: newSpeakerOn }));
  }, [state.isSpeakerOn]);

  /**
   * Локальный сброс состояния без API вызова.
   * Используется когда внешнее событие (WebSocket) уже обработано бэкендом.
   */
  const resetToIdle = useCallback(() => {
    // Вызывается, когда звонок завершён другой стороной — сервер уже знает
    attemptRef.current += 1;
    callIdRef.current = null;
    stopRingingTimeout();
    destroyEngine();
    setState({
      status: 'idle',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
    });
  }, []);

  /**
   * Сбрасывает таймаут ожидания ответа (вызывается при получении call.accepted через WebSocket).
   * Agora onUserJoined сам переключит статус на 'active'.
   */
  const clearRingingTimeout = useCallback(() => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  }, []);

  return {
    ...state,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    resetToIdle,
    toggleMute,
    toggleSpeaker,
    clearRingingTimeout,
  };
};
