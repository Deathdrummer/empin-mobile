/**
 * Удержание звонка — чистая логика без React и нативных модулей (проверяется тестами).
 *
 * Разговор удерживается по одной или нескольким причинам сразу:
 * - system — CallKit на iPhone: «Удержать и ответить» на звонок по сотовой связи, из другого мессенджера
 *   или на наш второй, кнопка удержания на системном экране. iOS забирает звук — звук разговора выключаем целиком;
 * - interruption — Agora сообщила, что микрофон забрал системный звонок (Android: сотовая связь).
 *   Захват не останавливаем, только глушим: иначе Agora не сообщит, что звонок закончился и микрофон свободен.
 * Разговор продолжается, когда причин не осталось.
 */
export const HOLD = Object.freeze({ system: 'system', interruption: 'interruption' });

/** Причины удержания после включения или снятия одной из них */
export const nextHoldReasons = (reasons, reason, on) => {
  const current = Array.isArray(reasons) ? reasons : [];
  const without = current.filter((item) => item !== reason);
  return on ? [...without, reason] : without;
};

/**
 * Что сделать со звуком Agora при смене причин удержания. isMuted — микрофон, выключенный самим человеком:
 * после удержания он остаётся выключенным.
 */
export const holdAudioPlan = (before, after, isMuted = false) => {
  const wasHeld = before.length > 0;
  const isHeld = after.length > 0;
  const audioWasOff = before.includes(HOLD.system);
  const audioIsOff = after.includes(HOLD.system);
  const steps = [];
  if (!wasHeld && isHeld) steps.push(['muteLocalAudioStream', true], ['muteAllRemoteAudioStreams', true]);
  if (!audioWasOff && audioIsOff) steps.push(['disableAudio']);
  if (audioWasOff && !audioIsOff) steps.push(['enableAudio']);
  if (wasHeld && !isHeld) steps.push(['muteAllRemoteAudioStreams', false], ['muteLocalAudioStream', isMuted]);
  return { steps, changed: wasHeld !== isHeld, held: isHeld };
};

// Состояния и причина из react-native-agora (LocalAudioStreamState, LocalAudioStreamReason)
const AUDIO_STOPPED = 0;
const AUDIO_RECORDING = 1;
const AUDIO_ENCODING = 2;
const AUDIO_FAILED = 3;
const REASON_OK = 0;
const REASON_INTERRUPTED = 8;

/** Микрофон забрал системный звонок (Agora: «interrupted by a system call») */
export const isAudioInterrupted = (state, reason) => reason === REASON_INTERRUPTED
  && (state === AUDIO_STOPPED || state === AUDIO_FAILED);

/** Захват с микрофона снова идёт: системный звонок закончился */
export const isAudioRecovered = (state, reason) => (state === AUDIO_RECORDING || state === AUDIO_ENCODING)
  && (reason === REASON_OK || reason === undefined);

// Разговор, во время которого второй входящий может ждать ответа
const TALKING = ['connecting', 'active'];
const IN_CALL = ['initiating', 'ringing', 'connecting', 'active'];

/**
 * Входящий звонок, когда приложение уже занято звонком:
 * - present — звонков нет, показываем как обычно;
 * - waiting — идёт разговор: второй ждёт ответа («Удержать и ответить», «Завершить и ответить», «Отклонить»);
 * - busy — мы сами набираем номер, уже ждёт другой входящий или есть удержанный звонок: «занято».
 */
export const incomingDuringCall = ({ status, waitingCallId = null, parkedCallId = null, callId }) => {
  const id = String(callId);
  if (waitingCallId != null && String(waitingCallId) === id) return 'duplicate';
  if (!IN_CALL.includes(status)) return parkedCallId != null ? 'busy' : 'present';
  if (!TALKING.includes(status) || waitingCallId != null || parkedCallId != null) return 'busy';
  return 'waiting';
};

/** Собеседник удержал звонок — по сведениям сервера (GET /messenger/calls/{id}); старый сервер — нет */
export const peerOnHoldFromDetails = (response) => response?.call?.status === 'active' && response?.hold?.peer === true;
