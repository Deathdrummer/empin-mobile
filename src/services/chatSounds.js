import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { isCallAudioActive } from './callAudioState';

/**
 * Звуки в чате (как в Telegram): короткий звук, когда сообщение ушло на сервер.
 * На iPhone его глушит переключатель звука на корпусе, во время звонка он не играет.
 * На Android беззвучный режим из Expo не прочитать — звук выключается в профиле («Звуки в чате»).
 */
const STORAGE_KEY = '@chatSounds';

let enabled = true;
let sentPlayer = null;

const ensurePlayer = () => {
  if (!sentPlayer) sentPlayer = createAudioPlayer(require('../../assets/sounds/message-sent.wav'));
  return sentPlayer;
};

/** При запуске: настройка и заранее загруженный звук — первый раз он играет без задержки */
export const restoreChatSounds = async () => {
  try {
    enabled = (await AsyncStorage.getItem(STORAGE_KEY)) !== 'off';
    if (enabled) ensurePlayer();
  } catch {
    // Настройка по умолчанию — звук включён
  }
};

export const getChatSounds = () => enabled;

export const setChatSounds = (value) => {
  enabled = Boolean(value);
  AsyncStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off').catch(() => {});
};

/**
 * Голосовые и видео играют и при выключенном звуке iPhone, как в Telegram: человек сам нажал «играть».
 * Вызывать перед воспроизведением — звук отправки мог переключить сессию в «тихий» режим.
 */
export const prepareMediaPlayback = () =>
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});

export const playMessageSent = async () => {
  if (!enabled || isCallAudioActive()) return;
  try {
    // iOS: «тихий» режим (ambient) — переключатель звука на корпусе глушит звук отправки,
    // а музыка из других приложений не останавливается
    if (Platform.OS === 'ios') {
      await setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false, interruptionMode: 'mixWithOthers' });
    }
    const player = ensurePlayer();
    player.volume = 0.8;
    player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('[Sounds] Не удалось проиграть звук отправки:', error?.message ?? error);
  }
};
