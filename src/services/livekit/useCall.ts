import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { Room, RoomEvent } from 'livekit-client';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { messengerAPI } from '../api';
import { CallStatus, CallData, CallState } from './types';

interface UseCallReturn extends CallState {
  initiateCall: (calleeId: number, calleeName: string, calleeAvatar?: string) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
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

  // Счётчик поколений комнат. Каждый новый connectToRoom инкрементирует его.
  // Обработчики событий старой комнаты сравнивают свой generation с текущим
  // и игнорируют события от устаревших комнат — это предотвращает порчу
  // состояния нового звонка при асинхронном отключении старой комнаты.
  const roomGenerationRef = useRef(0);

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
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Инкрементируем generation — все обработчики событий этой комнаты
    // замыкают этот номер и сравнивают с roomGenerationRef.current.
    // Если к моменту события generation уже изменился (новый звонок),
    // обработчик игнорирует событие — zombie room не портит новый звонок.
    const generation = ++roomGenerationRef.current;

    // configureAudio должен вызываться ДО startAudioSession
    AudioSession.configureAudio({
      android: {
        preferredOutputList: ['earpiece', 'speaker'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: {
        defaultOutput: 'earpiece',
      },
    });

    await AudioSession.startAudioSession();

    const room = new Room({
      // Time-based reconnect policy: даём 90 секунд на восстановление.
      // Count-based (3 попытки) был исчерпан комбинацией NegotiationError +
      // ping timeout (оба вызывают handleDisconnect и расходуют общий бюджет).
      // Экспоненциальный backoff: 2, 4, 8, 15, 15, ... секунд до 90s total.
      reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
          if (context.elapsedMs > 90_000) return null;
          return Math.min(2000 * Math.pow(2, context.retryCount), 15_000);
        },
      },
    });

    // Fallback-таймер: если callee не переподключится после brief disconnect —
    // disconnect через 15с. При нормальном завершении бэкенд вызывает deleteRoom →
    // RoomEvent.Disconnected сработает раньше этого таймера.
    let participantDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Флаг: livekit выполняет внутренний реконнект (сигнал/ICE).
    // Пока true — ParticipantDisconnected не меняет статус звонка,
    // т.к. remote participant может исчезнуть на время переподключения.
    let isRoomReconnecting = false;

    room.on(RoomEvent.Reconnecting, () => {
      if (roomGenerationRef.current !== generation) return; // Stale room
      isRoomReconnecting = true;
    });

    room.on(RoomEvent.Reconnected, () => {
      if (roomGenerationRef.current !== generation) return; // Stale room
      isRoomReconnecting = false;
      // Восстанавливаем 'active' если статус был изменён во время реконнекта
      setState((prev) => {
        if (prev.status !== 'active' && prev.status !== 'idle' && prev.status !== 'ended') {
          return { ...prev, status: 'active' };
        }
        return prev;
      });
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      if (roomGenerationRef.current !== generation) return; // Stale room
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
      if (participantDisconnectTimer) {
        clearTimeout(participantDisconnectTimer);
        participantDisconnectTimer = null;
      }
      setState((prev) => ({ ...prev, status: 'active' }));
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (roomGenerationRef.current !== generation) return; // Stale room
      // Во время внутреннего реконнекта livekit remote participant может исчезнуть
      // временно — не завершаем звонок, ждём RoomEvent.Reconnected
      if (isRoomReconnecting) return;

      // НЕ меняем status — модал остаётся открытым.
      // Remote participant может быть в процессе reconnect (createOffer занимает 20+ сек).
      // Если вернётся — ParticipantConnected отменит таймер и восстановит 'active'.
      // Если бэкенд закроет комнату (endCall) — RoomEvent.Disconnected придёт раньше.
      // Fallback-таймер нужен только для crash/потери сети без явного endCall.
      if (participantDisconnectTimer) clearTimeout(participantDisconnectTimer);
      participantDisconnectTimer = setTimeout(() => {
        participantDisconnectTimer = null;
        if (roomGenerationRef.current !== generation) return; // Stale room
        // Disconnected-обработчик сделает полный cleanup
        room.disconnect();
      }, 60_000);
    });

    room.on(RoomEvent.Disconnected, () => {
      if (roomGenerationRef.current !== generation) return; // Stale room
      isRoomReconnecting = false;
      roomRef.current = null;
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
    } catch (err) {
      console.error('[connectToRoom] connect failed:', err);
      await room.disconnect();
      AudioSession.stopAudioSession();
      throw err;
    }

    // setMicrophoneEnabled вызываем ПОСЛЕ room.connect(), но НЕ прерываем звонок при ошибке.
    // В livekit-client 2.17.2 при наличии существующих subscriber-треков добавление
    // publisher-трека может вызвать brief NegotiationError (PC momentarily disconnected
    // во время SDP renegotiation). Если мы throwим → room.disconnect() убивает звонок.
    // Если НЕ throwим → livekit's internal reconnect (до 3 попыток, 2+4+6с) самостоятельно
    // переопубликует трек после восстановления соединения.
    room.localParticipant.setMicrophoneEnabled(true).catch((err) => {
      console.warn('[connectToRoom] mic enable failed, livekit will retry after reconnect:', err);
    });

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
   *
   * Используем selectAudioOutput — он переключает маршрут аудио без перезапуска
   * AudioSession, что не прерывает активное WebRTC-соединение.
   */
  const toggleSpeaker = useCallback(async () => {
    const newSpeakerOn = !state.isSpeakerOn;

    if (Platform.OS === 'android') {
      await AudioSession.selectAudioOutput(newSpeakerOn ? 'speaker' : 'earpiece');
    } else if (Platform.OS === 'ios') {
      await AudioSession.selectAudioOutput(newSpeakerOn ? 'force_speaker' : 'default');
    }

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
