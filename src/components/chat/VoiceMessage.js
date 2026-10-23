import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Toast from 'react-native-toast-message';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { isCallAudioActive } from '../../services/callAudioState';
import { prepareMediaPlayback } from '../../services/chatSounds';
import { formatDuration } from '../../utils/chatFormat';

const BAR_COUNT = 28;

// «Волна» стабильна для сообщения: высоты столбиков выводятся из его id
const waveform = (seed) => {
  let value = Number(seed) || 7;
  return Array.from({ length: BAR_COUNT }, () => {
    value = (value * 9301 + 49297) % 233280;
    return 0.25 + (value / 233280) * 0.75;
  });
};

export const VoiceMessage = ({ uri, messageId, tint, trackColor, metaColor }) => {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const { registerPlayer, unregisterPlayer } = useAudioPlayerContext();
  const bars = useMemo(() => waveform(messageId), [messageId]);

  useEffect(() => () => unregisterPlayer(uri), [uri, unregisterPlayer]);

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
      player.play();
    } catch (error) {
      console.warn('[Voice] Не удалось воспроизвести:', error?.message ?? error);
    }
  };

  const duration = status.duration || 0;
  const progress = duration ? Math.min(1, (status.currentTime || 0) / duration) : 0;
  const shown = status.playing || progress > 0 ? status.currentTime : duration;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggle}
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
                { height: 4 + height * 18, backgroundColor: index / BAR_COUNT <= progress ? tint : trackColor },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.time, { color: metaColor }]}>{duration ? formatDuration(shown) : 'Голосовое'}</Text>
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
  time: { fontSize: 11, marginTop: 2 },
});
