/**
 * Идёт ли звонок (исходящий, входящий или разговор).
 * Пока он идёт, остальные звуки приложения не должны трогать аудиосессию: на iOS pause() в expo-audio
 * выключает общую сессию приложения, и вместе с ней пропадает звук разговора.
 * Запись голосового подписывается на начало звонка, чтобы остановиться до того, как звонок займёт микрофон.
 */
let callAudioActive = false;
const listeners = new Set();

export const setCallAudioActive = (active) => {
  if (callAudioActive === active) return;
  callAudioActive = active;
  listeners.forEach((listener) => listener(active));
};

export const isCallAudioActive = () => callAudioActive;

/** Подписка на начало и конец звонка; возвращает отписку */
export const onCallAudioChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
