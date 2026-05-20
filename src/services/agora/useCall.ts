import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
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

interface UseCallReturn extends CallState {
  initiateCall: (calleeId: number, calleeName: string, calleeAvatar?: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  resetToIdle: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  clearRingingTimeout: () => void;
}

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

  const destroyEngine = () => {
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
        // Мы успешно присоединились к каналу
      },

      onUserJoined: (_connection, _remoteUid, _elapsed) => {
        // Второй участник зашёл — звонок активен
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
      try {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          Alert.alert(
            'Нет доступа к микрофону',
            'Разрешите доступ к микрофону в настройках устройства'
          );
          return;
        }

        setState((prev) => ({ ...prev, status: 'initiating' }));

        const response = await messengerAPI.initiateCall(calleeId);

        if (!response.call_id || !response.token || !response.channel_name || !response.agora_app_id) {
          throw new Error(response.message || 'Некорректный ответ сервера');
        }

        const { call_id, channel_name, token, uid, agora_app_id } = response;

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

        // Таймаут: страховка если call_cancelled FCM не пришёл
        ringingTimeoutRef.current = setTimeout(() => {
          setState((prev) => {
            if (prev.status === 'ringing') {
              scheduleIdleReset('no_answer');
              return { ...prev, status: 'no_answer' };
            }
            return prev;
          });
          destroyEngine();
        }, 90000); // Увеличен с 45s до 90s — WebSocket обычно уведомит раньше
      } catch (error: any) {
        console.error('[Agora] Ошибка инициации звонка:', error);
        destroyEngine();
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error.response?.data?.message ?? 'Не удалось инициировать звонок',
        }));
        scheduleIdleReset('error');
      }
    },
    []
  );

  /**
   * Принятие входящего звонка
   */
  const acceptCall = useCallback(async (callId: string) => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          'Нет доступа к микрофону',
          'Разрешите доступ к микрофону в настройках устройства'
        );
        return;
      }

      const response = await messengerAPI.acceptCall(callId);
      const { channel_name, token, uid, agora_app_id } = response;

      setState((prev) => ({
        ...prev,
        status: 'active',
        callData: prev.callData
          ? { ...prev.callData, channelName: channel_name, token, uid }
          : null,
      }));

      await joinChannel(agora_app_id, token, channel_name, uid);
    } catch (error: any) {
      console.error('[Agora] Ошибка принятия звонка:', error, '| response data:', (error as any).response?.data, '| callId was:', callId);
      destroyEngine();
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.response?.data?.message ?? 'Не удалось принять звонок',
      }));
      scheduleIdleReset('error');
    }
  }, []);

  /**
   * Отклонение звонка
   */
  const rejectCall = useCallback(async (callId: string) => {
    try {
      await messengerAPI.rejectCall(callId);
      destroyEngine();
      setState({
        status: 'idle',
        callData: null,
        duration: 0,
        isMuted: false,
        isSpeakerOn: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[Agora] Ошибка отклонения звонка:', error);
    }
  }, []);

  /**
   * Завершение звонка
   */
  const endCall = useCallback(async () => {
    try {
      if (state.callData?.callId) {
        await messengerAPI.endCall(state.callData.callId);
      }
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
    } catch (error: any) {
      console.error('[Agora] Ошибка завершения звонка:', error);
    }
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
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
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
