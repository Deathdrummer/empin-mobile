import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, PermissionsAndroid, Platform, Alert } from 'react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Asset } from 'expo-asset';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  AudioScenarioType,
  AudioProfileType,
  ConnectionStateType,
  LocalAudioStreamState,
  LocalAudioStreamReason,
} from 'react-native-agora';
import { messengerAPI } from '../api';
import { CallStatus, CallData, CallState, ParkedCall, ResumeParams } from './types';
import {
  HOLD,
  holdAudioPlan,
  isAudioInterrupted,
  isAudioRecovered,
  nextHoldReasons,
  peerOnHoldFromDetails,
} from '../callHold';
import { getUserFacingError } from '../../utils/userFacingError';
import { connectAudio } from './audioConnection';
import { recordCallDiagnostic } from '../callDiagnostics';
import { CALL_CAUSES as C } from '../callDiagnosticFormat';
import { participantFromCaller } from '../incomingCallEvents';

interface UseCallReturn extends CallState {
  initiateCall: (calleeId: number, calleeName: string, calleeAvatar?: string) => Promise<void>;
  /** true — звонок принят и подключение к каналу запущено */
  acceptCall: (callId: string, participant?: CallData['participant']) => Promise<boolean>;
  rejectCall: (callId: string, cause?: number) => Promise<void>;
  endCall: (cause?: number) => Promise<void>;
  resetToIdle: (cause?: number) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  clearRingingTimeout: () => void;
  markAccepted: () => void;
  /** Удержание разговора по причине из callHold.HOLD (CallKit, прерывание звонком по сотовой связи) */
  setHold: (reason: string, on: boolean) => void;
  setPeerOnHold: (onHold: boolean) => void;
  /** iPhone: CallKit снова отдал звук после удержания — перезапустить звук разговора */
  restartAudioAfterHold: () => void;
  /** Выйти из канала, не завершая звонок (сервер уже знает об удержании): ответить на второй */
  park: () => ParkedCall | null;
  /** Вернуться в канал удержанного звонка */
  resume: (parked: ParkedCall, params: ResumeParams) => Promise<boolean>;
}

interface UseCallOptions {
  /** Разговор встал на удержание или продолжился: собеседнику — «на удержании» */
  onHoldChange?: (callId: string, onHold: boolean) => void;
}

const HOLD_CLEAR = { holdReasons: [] as string[], peerOnHold: false };

/** Удержал ли собеседник звонок, выйдя из канала (ответил на второй). Нет связи или старый сервер — нет */
const checkPeerOnHold = async (callId: string | null): Promise<boolean> => {
  if (!callId) return false;
  try {
    return peerOnHoldFromDetails(await messengerAPI.getCallDetails(callId));
  } catch {
    return false;
  }
};

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

export const useCall = ({ onHoldChange }: UseCallOptions = {}): UseCallReturn => {
  const [state, setState] = useState<CallState>({
    status: 'idle',
    callData: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    error: null,
    ...HOLD_CLEAR,
  });
  // Актуальное состояние для обработчиков удержания (они вызываются из событий CallKit и Agora)
  const stateRef = useRef(state);
  stateRef.current = state;
  const onHoldChangeRef = useRef(onHoldChange);
  onHoldChangeRef.current = onHoldChange;
  // Почему разговор на удержании; пусто — идёт
  const holdReasonsRef = useRef<string[]>([]);
  // iPhone: звук включён после удержания CallKit — перезапустить, когда iOS вернёт аудиосессию
  const pendingAudioRestartRef = useRef(false);
  // Вернулись в канал удержанного звонка: восстановить микрофон и динамик, когда вошли
  const restoreAudioRef = useRef<{ isMuted: boolean; isSpeakerOn: boolean } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineRef = useRef<IRtcEngine | null>(null);
  const engineTraceRef = useRef({ callId: 0, engine: 0, attempt: 0 });
  const connectionRef = useRef<ReturnType<typeof connectAudio> | null>(null);
  const acceptPromiseRef = useRef<{ id: string; promise: Promise<boolean> } | null>(null);
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

  const finishCallOnServer = (cause: number = C.unknown) => {
    const callId = callIdRef.current;
    callIdRef.current = null;
    if (callId) {
      recordCallDiagnostic('finish-requested', { callId, cause, attempt: attemptRef.current });
      notifyServer('Завершение звонка', () => messengerAPI.endCall(callId, cause));
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
      destroyEngine(C.unmount);
    };
  }, []);

  const scheduleIdleReset = (fromStatus: CallStatus) => {
    setTimeout(() => {
      setState((prev) =>
        prev.status === fromStatus
          ? { status: 'idle', callData: null, duration: 0, isMuted: false, isSpeakerOn: false, error: null, ...HOLD_CLEAR }
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

  const destroyEngine = (cause: number = C.unknown) => {
    stopRingback();
    holdReasonsRef.current = [];
    pendingAudioRestartRef.current = false;
    const engine = engineRef.current;
    const connection = connectionRef.current;
    engineRef.current = null;
    connectionRef.current = null;
    if (!engine) return;
    recordCallDiagnostic('rtc-leave-command', { ...engineTraceRef.current, cause });
    // Ошибка движка не должна мешать завершить звонок и закрыть экран
    try {
      connection?.dispose();
      const code = engine.leaveChannel();
      recordCallDiagnostic('rtc-leave-result', { ...engineTraceRef.current, cause, code });
    } catch (error: any) {
      recordCallDiagnostic('rtc-leave-failed', { ...engineTraceRef.current, cause, code: error?.code });
      console.warn('[Agora] Выход из канала:', error?.message ?? error);
    }
    try {
      recordCallDiagnostic('rtc-release-command', { ...engineTraceRef.current, cause });
      engine.release();
    } catch (error: any) {
      recordCallDiagnostic('rtc-release-failed', { ...engineTraceRef.current, cause, code: error?.code });
      console.warn('[Agora] Освобождение движка:', error?.message ?? error);
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
        if (AppState.currentState !== 'active') return false;
        return (await requestRecordingPermissionsAsync()).granted;
      } catch {
        return false;
      }
    }

    return true;
  };

  /**
   * Удержание: причина из callHold.HOLD включена или снята. Звук глушится, пока есть хоть одна причина;
   * собеседнику сообщаем, только когда разговор встал на удержание или продолжился.
   */
  const applyHold = (reason: string, on: boolean) => {
    const before = holdReasonsRef.current;
    const after = nextHoldReasons(before, reason, on);
    if (after.length === before.length && after.every((item) => before.includes(item))) return;
    holdReasonsRef.current = after;
    const { isMuted, isSpeakerOn } = stateRef.current;
    const plan = holdAudioPlan(before, after, isMuted);
    const steps = plan.steps as Array<[string, boolean?]>;
    const engine = engineRef.current as any;
    if (engine) {
      for (const [method, arg] of steps) {
        try {
          if (arg === undefined) engine[method]();
          else engine[method](arg);
        } catch (error: any) {
          recordCallDiagnostic('hold-audio-failed', { code: error?.code, callId: Number(callIdRef.current) });
        }
      }
      if (steps.some(([method]) => method === 'enableAudio')) {
        try { engine.setEnableSpeakerphone(isSpeakerOn); } catch {}
        // iOS включает звук разговора, только когда вернёт аудиосессию (событие audioActivated)
        pendingAudioRestartRef.current = Platform.OS === 'ios';
      }
    }
    recordCallDiagnostic(`hold-${reason}-${on ? 'on' : 'off'}`, { callId: Number(callIdRef.current) });
    setState((prev) => ({ ...prev, holdReasons: after }));
    if (plan.changed && callIdRef.current) onHoldChangeRef.current?.(callIdRef.current, plan.held);
  };

  /**
   * iPhone: CallKit вернул аудиосессию после удержания. Об окончании прерывания iOS сообщает не всегда —
   * звук разговора перезапускаем сами, иначе после звонка по сотовой связи разговор шёл бы без звука
   */
  const restartAudioAfterHold = () => {
    const engine = engineRef.current;
    if (!pendingAudioRestartRef.current || !engine || holdReasonsRef.current.includes(HOLD.system)) return;
    pendingAudioRestartRef.current = false;
    const held = holdReasonsRef.current.length > 0;
    const { isMuted, isSpeakerOn } = stateRef.current;
    try {
      engine.disableAudio();
      engine.enableAudio();
      engine.muteLocalAudioStream(held || isMuted);
      engine.muteAllRemoteAudioStreams(held);
      engine.setEnableSpeakerphone(isSpeakerOn);
      recordCallDiagnostic('hold-audio-restarted', { callId: Number(callIdRef.current) });
    } catch (error: any) {
      recordCallDiagnostic('hold-audio-failed', { code: error?.code, callId: Number(callIdRef.current) });
    }
  };

  /**
   * Инициализация Agora engine и подключение к каналу.
   * appId — возвращается бэкендом вместе с токеном.
   * expectPeer — ждать собеседника в канале (нет — он удержал звонок и вернётся сам).
   */
  const joinChannel = async (
    appId: string,
    token: string,
    channelName: string,
    uid: number,
    outgoing = false,
    expectPeer = true
  ): Promise<void> => {
    destroyEngine(C.replaceChannel);

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;
    const trace = { callId: Number(callIdRef.current), engine: engineTraceRef.current.engine + 1, attempt: attemptRef.current };
    engineTraceRef.current = trace;
    recordCallDiagnostic('rtc-created', trace);

    ringbackRef.current = outgoing;
    connectionRef.current = connectAudio({
      engine, appId, token, channelName, uid,
      sdk: {
        communication: ChannelProfileType.ChannelProfileCommunication,
        broadcaster: ClientRoleType.ClientRoleBroadcaster,
        audioProfile: AudioProfileType.AudioProfileDefault,
        audioScenario: AudioScenarioType.AudioScenarioDefault,
        failedState: ConnectionStateType.ConnectionStateFailed,
        connectedState: ConnectionStateType.ConnectionStateConnected,
        reconnectingState: ConnectionStateType.ConnectionStateReconnecting,
        audioFailedState: LocalAudioStreamState.LocalAudioStreamStateFailed,
        noAudioPermission: LocalAudioStreamReason.LocalAudioStreamReasonDeviceNoPermission,
      },
      onDiagnostic: (event, details) => {
        recordCallDiagnostic(event, { ...details, ...trace });
        console.log('[Agora RTC]', event, details ?? '');
      },
      onLocalJoined: () => {
        if (ringbackRef.current) startRingback();
        // Вернулись к удержанному звонку: микрофон и динамик — как были до удержания
        const restore = restoreAudioRef.current;
        if (restore) {
          restoreAudioRef.current = null;
          try {
            engine.muteLocalAudioStream(restore.isMuted);
            engine.setEnableSpeakerphone(restore.isSpeakerOn);
          } catch {}
        }
      },
      onConnected: () => {
        recordCallDiagnostic('rtc-connected', trace);
        stopRingback();
        stopRingingTimeout();
        setState((prev) => ({ ...prev, status: 'active' }));
      },
      // Микрофон забрал звонок по сотовой связи (Android; на iPhone удержание приходит из CallKit) — разговор
      // на удержании, пока Agora не сообщит, что захват снова идёт
      onLocalAudioState: (audioState, reason) => {
        if (isAudioInterrupted(audioState, reason)) applyHold(HOLD.interruption, true);
        else if (isAudioRecovered(audioState, reason) && holdReasonsRef.current.includes(HOLD.interruption)) {
          applyHold(HOLD.interruption, false);
        }
      },
      onPeerRejoined: () => {
        setState((prev) => (prev.peerOnHold ? { ...prev, peerOnHold: false } : prev));
      },
      onOffline: () => {
        recordCallDiagnostic('rtc-peer-offline', { ...trace, cause: C.peerOffline });
        const callId = callIdRef.current;
        const attempt = attemptRef.current;
        // Собеседник мог выйти из канала, удержав звонок (ответил на второй): тогда разговор не завершаем,
        // он вернётся. Сервер узнаёт об удержании раньше, чем собеседник выходит из канала
        checkPeerOnHold(callId).then((peerOnHold) => {
          if (attempt !== attemptRef.current || callIdRef.current !== callId) return;
          if (peerOnHold) {
            recordCallDiagnostic('rtc-peer-parked', { ...trace });
            setState((prev) => ({ ...prev, peerOnHold: true }));
            return;
          }
          setState((prev) => ({ ...prev, status: 'ended' }));
          scheduleIdleReset('ended');
          stopRingingTimeout();
          finishCallOnServer(C.peerOffline);
          destroyEngine(C.peerOffline);
        });
      },
      onFailure: (message, code) => {
        recordCallDiagnostic('rtc-failure', { ...trace, code, cause: C.rtcFailure });
        console.warn('[Agora RTC] failure', code);
        attemptRef.current += 1;
        stopRingingTimeout();
        finishCallOnServer(C.rtcFailure);
        destroyEngine(C.rtcFailure);
        setState((prev) => ({ ...prev, status: 'error', error: message }));
        scheduleIdleReset('error');
      },
    });
    if (!outgoing && expectPeer) connectionRef.current.peerAccepted();
  };

  /**
   * Инициация исходящего звонка
   */
  const initiateCall = useCallback(
    async (calleeId: number, calleeName: string, calleeAvatar?: string) => {
      const attempt = ++attemptRef.current;
      recordCallDiagnostic('initiate-requested', { attempt });
      try {
        const hasPermission = await requestMicrophonePermission();
        if (attempt !== attemptRef.current) return;
        if (!hasPermission) {
          recordCallDiagnostic('permission-denied', { attempt, cause: C.permissionDenied });
          Alert.alert(
            'Нет доступа к микрофону',
            'Разрешите доступ к микрофону в настройках устройства'
          );
          // Экран звонка уже открыт: без этого он остался бы на экране без звонка
          setState((prev) => ({ ...prev, status: 'error', error: 'Нет доступа к микрофону' }));
          scheduleIdleReset('error');
          return;
        }

        callIdRef.current = null;
        setState((prev) => ({ ...prev, status: 'initiating' }));

        const response = await messengerAPI.initiateCall(calleeId);

        if (attempt !== attemptRef.current) {
          // Пока создавался звонок, его уже отменили: у собеседника он не должен звонить
          if (response?.call_id) {
            notifyServer('Отмена звонка', () => messengerAPI.endCall(String(response.call_id), C.lateInitiate));
          }
          return;
        }

        if (!response.call_id || !response.token || !response.channel_name || !response.agora_app_id) {
          throw new Error(response.message || 'Некорректный ответ сервера');
        }

        const { call_id, channel_name, token, uid, agora_app_id } = response;
        callIdRef.current = String(call_id);
        recordCallDiagnostic('initiate-succeeded', { callId: Number(call_id), uid, attempt });

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

        await joinChannel(agora_app_id, token, channel_name, uid, true);
        if (attempt !== attemptRef.current) return;

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
          finishCallOnServer(C.ringingTimeout);
          destroyEngine(C.ringingTimeout);
        }, 90000); // Увеличен с 45s до 90s — WebSocket обычно уведомит раньше
      } catch (error: any) {
        recordCallDiagnostic('initiate-failed', { status: error?.response?.status, code: error?.rtcCode });
        console.error('[Agora] Ошибка инициации звонка:', error?.response?.status ?? error?.message);
        if (attempt !== attemptRef.current) return;
        stopRingingTimeout();
        // Звонок мог успеть создаться на сервере — отменяем, чтобы у собеседника не звонило
        finishCallOnServer(C.initiateFailed);
        destroyEngine(C.initiateFailed);
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
  const acceptCallOnce = useCallback(async (callId: string, participant?: CallData['participant']) => {
    if (callIdRef.current === String(callId) && engineRef.current) return true;
    const attempt = ++attemptRef.current;
    recordCallDiagnostic('accept-requested', { callId: Number(callId), attempt });
    try {
      const hasPermission = await requestMicrophonePermission();
      if (attempt !== attemptRef.current) return false;
      if (!hasPermission) {
        Alert.alert(
          'Нет доступа к микрофону',
          'Разрешите доступ к микрофону в настройках устройства'
        );
        notifyServer('Отклонение звонка', () => messengerAPI.rejectCall(callId, C.permissionDenied));
        setState((prev) => ({ ...prev, status: 'error', error: 'Нет доступа к микрофону' }));
        scheduleIdleReset('error');
        return false;
      }

      callIdRef.current = String(callId);
      setState({ status: 'connecting', duration: 0, isMuted: false, isSpeakerOn: false, error: null, ...HOLD_CLEAR,
        callData: { callId: String(callId), channelName: '', token: '', uid: 0,
          participant: participant ?? { id: 0, name: 'Неизвестный' }, isIncoming: true } });
      const response = await messengerAPI.acceptCall(callId);
      if (attempt !== attemptRef.current) {
        // Пока принимали, звонок отклонили или он завершился — сервер уже считает его принятым
        notifyServer('Завершение звонка', () => messengerAPI.endCall(String(callId), C.lateAccept));
        return false;
      }
      const { channel_name, token, uid, agora_app_id } = response;
      recordCallDiagnostic('accept-succeeded', { callId: Number(callId), uid, attempt });
      callIdRef.current = String(callId);

      setState((prev) => ({
        ...prev,
        status: 'connecting',
        callData: {
              callId: String(callId),
              channelName: channel_name,
              token,
              uid,
              participant: participantFromCaller(response?.call?.caller) ?? participant ?? {
                id: 0,
                name: 'Неизвестный',
              },
              isIncoming: true,
            },
      }));

      await joinChannel(agora_app_id, token, channel_name, uid);
      return true;
    } catch (error: any) {
      console.error('[Agora] Ошибка принятия звонка:', error?.response?.status ?? error?.message);
      recordCallDiagnostic('accept-failed', { status: error?.response?.status, code: error?.rtcCode, callId: Number(callId) });
      if (attempt !== attemptRef.current) return false;
      // Сервер уже отметил звонок принятым, а подключиться не удалось — завершаем его на сервере
      finishCallOnServer(C.acceptFailed);
      destroyEngine(C.acceptFailed);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: getUserFacingError(error, 'Не удалось принять звонок.'),
      }));
      scheduleIdleReset('error');
      return false;
    }
  }, []);

  const acceptCall = useCallback((callId: string, participant?: CallData['participant']): Promise<boolean> => {
    const id = String(callId);
    if (acceptPromiseRef.current?.id === id) return acceptPromiseRef.current.promise;
    const promise = acceptCallOnce(id, participant);
    acceptPromiseRef.current = { id, promise };
    promise.finally(() => {
      if (acceptPromiseRef.current?.promise === promise) acceptPromiseRef.current = null;
    });
    return promise;
  }, [acceptCallOnce]);

  /**
   * Отклонение звонка
   */
  const rejectCall = useCallback(async (callId: string, cause: number = C.userReject) => {
    // Раньше при ошибке запроса (например, 429) состояние не сбрасывалось, а сервер не узнавал об отказе
    recordCallDiagnostic('reject-command', { callId, cause, attempt: attemptRef.current });
    notifyServer('Отклонение звонка', () => messengerAPI.rejectCall(callId, cause));
    attemptRef.current += 1;
    callIdRef.current = null;
    stopRingingTimeout();
    destroyEngine(cause);
    setState({
      status: 'idle',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
      ...HOLD_CLEAR,
    });
  }, []);

  /**
   * Завершение звонка
   */
  const endCall = useCallback(async (cause: number = C.userHangup) => {
    // Раньше при ошибке запроса (например, 429) звонок у собеседника продолжал звонить, а движок
    // оставался в канале: звонящий нажимал вызов снова, и собеседнику приходил второй входящий
    const callId = state.callData?.callId ?? callIdRef.current;
    recordCallDiagnostic('end-command', { callId, cause, attempt: attemptRef.current });
    attemptRef.current += 1;
    callIdRef.current = null;
    if (callId) {
      notifyServer('Завершение звонка', () => messengerAPI.endCall(callId, cause));
    }
    stopRingingTimeout();
    destroyEngine(cause);
    setState({
      status: 'ended',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
      ...HOLD_CLEAR,
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
    // На удержании микрофон и так заглушён: выбор применится, когда разговор продолжится
    if (holdReasonsRef.current.length === 0) engineRef.current.muteLocalAudioStream(newMuted);
    setState((prev) => ({ ...prev, isMuted: newMuted }));
  }, [state.isMuted]);

  /**
   * Переключение динамик/наушники
   */
  const toggleSpeaker = useCallback(() => {
    if (!engineRef.current) return;
    const newSpeakerOn = !state.isSpeakerOn;
    // Звук выключен удержанием CallKit — динамик включится вместе со звуком
    if (!holdReasonsRef.current.includes(HOLD.system)) engineRef.current.setEnableSpeakerphone(newSpeakerOn);
    setState((prev) => ({ ...prev, isSpeakerOn: newSpeakerOn }));
  }, [state.isSpeakerOn]);

  /**
   * Локальный сброс состояния без API вызова.
   * Используется когда внешнее событие (WebSocket) уже обработано бэкендом.
   */
  const resetToIdle = useCallback((cause: number = C.reset) => {
    recordCallDiagnostic('reset-command', { callId: callIdRef.current ?? engineTraceRef.current.callId, cause, attempt: attemptRef.current });
    // Вызывается, когда звонок завершён другой стороной — сервер уже знает
    attemptRef.current += 1;
    callIdRef.current = null;
    stopRingingTimeout();
    destroyEngine(cause);
    setState({
      status: 'idle',
      callData: null,
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      error: null,
      ...HOLD_CLEAR,
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

  const markAccepted = useCallback(() => {
    if (!callIdRef.current || !connectionRef.current) return;
    stopRingingTimeout();
    stopRingback();
    connectionRef.current.peerAccepted();
    setState((prev) => prev.status === 'ringing' ? { ...prev, status: 'connecting' } : prev);
  }, []);

  const setPeerOnHold = useCallback((onHold: boolean) => {
    setState((prev) => (Boolean(prev.peerOnHold) === onHold ? prev : { ...prev, peerOnHold: onHold }));
  }, []);

  /**
   * Ответ на второй звонок с удержанием первого: выходим из его канала, не завершая звонок (сервер уже
   * отметил удержание — собеседник не сочтёт это концом разговора). Возвращает, что нужно для возврата
   */
  const park = useCallback((): ParkedCall | null => {
    const current = stateRef.current;
    if (!current.callData || !['active', 'connecting'].includes(current.status)) return null;
    const parked: ParkedCall = {
      callData: current.callData,
      duration: current.duration,
      isMuted: current.isMuted,
      isSpeakerOn: current.isSpeakerOn,
    };
    recordCallDiagnostic('park-command', { callId: Number(current.callData.callId), attempt: attemptRef.current, cause: C.holdSecondCall });
    attemptRef.current += 1;
    // Без callId выход из канала не завершает звонок на сервере (см. finishCallOnServer)
    callIdRef.current = null;
    stopRingingTimeout();
    destroyEngine(C.holdSecondCall);
    setState({ status: 'idle', callData: null, duration: 0, isMuted: false, isSpeakerOn: false, error: null, ...HOLD_CLEAR });
    return parked;
  }, []);

  /** Возврат к удержанному звонку: тот же канал, новый токен; длительность продолжается */
  const resume = useCallback(async (parked: ParkedCall, params: ResumeParams): Promise<boolean> => {
    const attempt = ++attemptRef.current;
    const callId = parked.callData.callId;
    recordCallDiagnostic('resume-command', { callId: Number(callId), attempt, cause: C.resumeHeld });
    callIdRef.current = callId;
    restoreAudioRef.current = { isMuted: parked.isMuted, isSpeakerOn: parked.isSpeakerOn };
    setState({
      status: 'active',
      callData: { ...parked.callData, channelName: params.channelName, token: params.token, uid: params.uid },
      duration: parked.duration,
      isMuted: parked.isMuted,
      isSpeakerOn: parked.isSpeakerOn,
      error: null,
      holdReasons: [],
      peerOnHold: params.peerOnHold,
    });
    try {
      // Собеседник сам держит звонок — его не ждём: вернётся в канал, когда продолжит
      await joinChannel(params.appId, params.token, params.channelName, params.uid, false, !params.peerOnHold);
      // iPhone: CallKit мог вернуть аудиосессию уже после входа в канал — тогда перезапустить звук (audioActivated)
      if (attempt === attemptRef.current) pendingAudioRestartRef.current = Platform.OS === 'ios';
      return attempt === attemptRef.current;
    } catch (error: any) {
      recordCallDiagnostic('resume-failed', { callId: Number(callId), code: error?.rtcCode, cause: C.resumeHeld });
      if (attempt !== attemptRef.current) return false;
      finishCallOnServer(C.resumeHeld);
      destroyEngine(C.resumeHeld);
      setState((prev) => ({ ...prev, status: 'error', error: getUserFacingError(error, 'Не удалось вернуться к звонку.') }));
      scheduleIdleReset('error');
      return false;
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
    markAccepted,
    setHold: applyHold,
    setPeerOnHold,
    restartAudioAfterHold,
    park,
    resume,
  };
};
