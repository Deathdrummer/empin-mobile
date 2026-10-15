/**
 * Идёт ли звонок (исходящий, входящий или разговор).
 * Пока он идёт, остальные звуки приложения не должны трогать аудиосессию: на iOS pause() в expo-audio
 * выключает общую сессию приложения, и вместе с ней пропадает звук разговора.
 */
let callAudioActive = false;

export const setCallAudioActive = (active) => {
  callAudioActive = active;
};

export const isCallAudioActive = () => callAudioActive;
