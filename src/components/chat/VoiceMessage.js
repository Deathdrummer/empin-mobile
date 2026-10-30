import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Toast from 'react-native-toast-message';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { isCallAudioActive } from '../../services/callAudioState';
import { prepareMediaPlayback } from '../../services/chatSounds';
import { formatDuration } from '../../utils/chatFormat';
import { pseudoWaveform, resampleWaveform } from '../../utils/waveform';

const BAR_COUNT = 28;
// Скорости как в Telegram; выбранная запоминается и общая с голосовыми в табеле
const SPEEDS = [1, 1.5, 2];

const speedLabel = (rate) => `${String(rate).replace('.', ',')}×`;

/** Столбики: «волна» записи (новые голосовые) или условный рисунок (старые, без сохранённой «волны») */
const useBars = (waveform, messageId) => useMemo(
  () => (waveform?.length ? resampleWaveform(waveform, BAR_COUNT) : pseudoWaveform(messageId, BAR_COUNT)),
  [waveform, messageId],
);

export const VoiceMessage = ({
  uri, messageId, waveform, durationSeconds, tint, trackColor, metaColor, onLongPress, disabled = false,
}) => {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const { registerPlayer, unregisterPlayer, audioPlaybackRate, setAudioPlaybackRate } = useAudioPlayerContext();
  const bars = useBars(waveform, messageId);

  useEffect(() => () => unregisterPlayer(uri), [uri, unregisterPlayer]);

  useEffect(() => {
    player.shouldCorrectPitch = true;
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) {
      try {
        player.pause();
        player.seekTo(0);
      } catch {}
    }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      // Во время звонка аудиосессией владеет разговор
      if (isCallAudioActive()) {
        Toast.show({ type: 'info', text1: 'Идёт звонок', text2: 'Послушайте после звонка', position: 'top', visibilityTime: 2500 });
        return;
      }
      registerPlayer(player, uri);
      // Голосовое слышно и при выключенном звуке iPhone (как в Telegram)
      await prepareMediaPlayback();
      player.setPlaybackRate(audioPlaybackRate, 'high');
      player.play();
    } catch (error) {
      console.warn('[Voice] Не удалось воспроизвести:', error?.message ?? error);
    }
  };

  const changeSpeed = () => {
    const next = SPEEDS.find((speed) => speed > audioPlaybackRate) ?? SPEEDS[0];
    Haptics.selectionAsync().catch(() => {});
    setAudioPlaybackRate(next);
    // setPlaybackRate может сам запустить воспроизведение (expo-audio) — на паузе возвращаем паузу
    const wasPlaying = status.playing;
    player.setPlaybackRate(next, 'high');
    if (!wasPlaying) {
      try {
        player.pause();
      } catch {}
    }
  };

  // Длительность известна сразу (сохранена при записи), до загрузки файла
  const duration = status.duration || durationSeconds || 0;
  const progress = status.duration ? Math.min(1, (status.currentTime || 0) / status.duration) : 0;
  const active = status.playing || progress > 0;
  const shown = active ? status.currentTime : duration;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
        delayLongPress={280}
        disabled={disabled}
        style={[styles.button, { backgroundColor: tint }]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Пауза' : 'Воспроизвести голосовое сообщение'}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color="#FFFFFF" style={!status.playing && styles.playIcon} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.wave}>
          {bars.map((height, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                { height: 3 + height * 19, backgroundColor: index / BAR_COUNT <= progress && active ? tint : trackColor },
              ]}
            />
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.time, { color: metaColor }]}>{duration ? formatDuration(shown) : 'Голосовое'}</Text>
          {/* Скорость — пока голосовое слушают, как в Telegram */}
          {active && !disabled ? (
            <Pressable onPress={changeSpeed} hitSlop={8} style={[styles.speed, { borderColor: metaColor }]} accessibilityLabel={`Скорость ${speedLabel(audioPlaybackRate)}`}>
              <Text style={[styles.speedText, { color: metaColor }]}>{speedLabel(audioPlaybackRate)}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
};

/** Голосовое в меню сообщения: тот же вид, без плеера (второй плеер того же файла не нужен) */
export const VoiceMessagePreview = ({ messageId, waveform, durationSeconds, tint, trackColor, metaColor }) => {
  const bars = useBars(waveform, messageId);
  return (
    <View style={styles.container}>
      <View style={[styles.button, { backgroundColor: tint }]}>
        <Ionicons name="play" size={20} color="#FFFFFF" style={styles.playIcon} />
      </View>
      <View style={styles.body}>
        <View style={styles.wave}>
          {bars.map((height, index) => (
            <View key={index} style={[styles.bar, { height: 3 + height * 19, backgroundColor: trackColor }]} />
          ))}
        </View>
        {durationSeconds ? <Text style={[styles.time, { color: metaColor }]}>{formatDuration(durationSeconds)}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210, paddingVertical: 2 },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playIcon: { marginLeft: 3 },
  body: { flex: 1 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 3, borderRadius: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  time: { fontSize: 11 },
  speed: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 4, paddingVertical: 0 },
  speedText: { fontSize: 10, fontWeight: '700' },
});
