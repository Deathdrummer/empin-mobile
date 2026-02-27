import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Room, RoomEvent } from 'livekit-client';
import { AudioSession } from '@livekit/react-native';
import { messengerAPI } from '../api';
import { CallStatus, CallData, CallState } from './types';

interface UseCallReturn extends CallState {
  initiateCall: (calleeId: number, calleeName: string, calleeAvatar?: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => void;
  room: Room | null;
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
  const roomRef = useRef<Room | null>(null);

  /**
   * Таймер для подсчета длительности звонка
   */
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.status]);

  /**
   * Cleanup при unmount
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      AudioSession.stopAudioSession();
    };
  }, []);

  /**
   * Запрос разрешения на микрофон
   */
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
      } catch (err) {
        console.warn('Ошибка запроса разрешения на микрофон:', err);
        return false;
      }
    }
    return true;
  };

  /**
   * Сброс в idle через 3с чтобы polling возобновился после завершения/ошибки звонка
   */
  const scheduleIdleReset = (fromStatus: CallStatus) => {
    setTimeout(() => {
      setState((prev) =>
        prev.status === fromStatus
          ? { status: 'idle', callData: null, duration: 0, isMuted: false, isSpeakerOn: false, error: null }
          : prev
      );
    }, 3000);
  };

  /**
   * Подключение к LiveKit комнате
   */
  const connectToRoom = async (livekitUrl: string, token: string): Promise<Room> => {
    console.log('[connectToRoom] connecting to:', livekitUrl, '| token length:', token?.length);

    if (roomRef.current) {
      await roomRef.current.disconnect();
    }

    await AudioSession.startAudioSession();

    // Ограничиваем автоматические попытки переподключения (max 3)
    const room = new Room({
      reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
          if (context.retryCount >= 3) return null; // Остановить реконнект
          return (context.retryCount + 1) * 2000;
        },
      },
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      // Callee ответил — отменяем таймаут
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
      setState((prev) => ({ ...prev, status: 'active' }));
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      // Если другой участник отключился - звонок завершен
      setState((prev) => {
        if (prev.status === 'active') {
          scheduleIdleReset('ended');
          return { ...prev, status: 'ended' };
        }
        return prev;
      });
      // Отключаем комнату явно, чтобы остановить бесконечный реконнект LiveKit
      room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      AudioSession.stopAudioSession();
    });

    room.on(RoomEvent.Disconnected, () => {
      AudioSession.stopAudioSession();
      setState((prev) => {
        if (prev.status !== 'ended') {
          scheduleIdleReset('ended');
          return { ...prev, status: 'ended' };
        }
        return prev;
      });
    });

    try {
      await room.connect(livekitUrl, token);
      console.log('[connectToRoom] connected successfully');
      // Публикуем микрофон — без этого аудио не передаётся
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[connectToRoom] microphone enabled');
    } catch (err) {
      console.error('[connectToRoom] connection failed:', err);
      throw err;
    }

    roomRef.current = room;
    return room;
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

        console.log('[initiateCall] API response:', JSON.stringify(response));

        // Валидация ответа API (бэкенд может вернуть ошибку в теле HTTP 200)
        if (!response.call_id || !response.token || !response.livekit_url) {
          throw new Error(response.message || 'Некорректный ответ сервера');
        }

        const { call_id, room_name, token, livekit_url } = response;

        const callData: CallData = {
          callId: String(call_id),
          roomName: room_name,
          token,
          livekitUrl: livekit_url,
          participant: {
            id: calleeId,
            name: calleeName,
            avatar: calleeAvatar,
          },
          isIncoming: false,
        };

        setState((prev) => ({
          ...prev,
          status: 'ringing',
          callData,
          error: null,
        }));

        await connectToRoom(livekit_url, token);

        // Таймаут: если callee не ответил за 45 сек — завершаем звонок
        ringingTimeoutRef.current = setTimeout(() => {
          setState((prev) => {
            if (prev.status === 'ringing') {
              console.log('[initiateCall] ringing timeout — no answer');
              return { ...prev, status: 'ended' };
            }
            return prev;
          });
          if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
          }
          AudioSession.stopAudioSession();
          scheduleIdleReset('ended');
        }, 45000);
      } catch (error: any) {
        console.error('Ошибка инициации звонка:', error);
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

      const { room_name, token, livekit_url } = response;

      setState((prev) => ({
        ...prev,
        status: 'active',
        callData: prev.callData
          ? { ...prev.callData, roomName: room_name, token, livekitUrl: livekit_url }
          : null,
      }));

      await connectToRoom(livekit_url, token);
    } catch (error: any) {
      console.error('Ошибка принятия звонка:', error);
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

      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      AudioSession.stopAudioSession();

      setState({
        status: 'idle',
        callData: null,
        duration: 0,
        isMuted: false,
        isSpeakerOn: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Ошибка отклонения звонка:', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.response?.data?.message ?? 'Не удалось отклонить звонок',
      }));
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

      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      AudioSession.stopAudioSession();

      setState({
        status: 'ended',
        callData: null,
        duration: 0,
        isMuted: false,
        isSpeakerOn: false,
        error: null,
      });

      // Сброс статуса в idle через 2 секунды
      setTimeout(() => {
        setState((prev) => (prev.status === 'ended' ? { ...prev, status: 'idle' } : prev));
      }, 2000);
    } catch (error: any) {
      console.error('Ошибка завершения звонка:', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.response?.data?.message ?? 'Не удалось завершить звонок',
      }));
    }
  }, [state.callData]);

  /**
   * Включение/выключение микрофона
   */
  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return;

    const newMuted = !state.isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setState((prev) => ({ ...prev, isMuted: newMuted }));
  }, [state.isMuted]);

  /**
   * Переключение динамик/наушники
   */
  const toggleSpeaker = useCallback(() => {
    const newSpeakerOn = !state.isSpeakerOn;

    AudioSession.configureAudio({
      android: {
        preferredOutputList: newSpeakerOn ? ['speaker'] : ['earpiece'],
      },
      ios: {
        defaultOutput: newSpeakerOn ? 'speaker' : 'earpiece',
      },
    });

    setState((prev) => ({ ...prev, isSpeakerOn: newSpeakerOn }));
  }, [state.isSpeakerOn]);

  return {
    ...state,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    room: roomRef.current,
  };
};
