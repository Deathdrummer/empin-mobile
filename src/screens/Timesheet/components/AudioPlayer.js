import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import Toast from 'react-native-toast-message';
import { useAudioPlayerContext } from '../../../contexts/AudioPlayerContext';
import { isCallAudioActive } from '../../../services/callAudioState';
import { useTheme, useThemedStyles } from '../../../theme';

// Форматирование времени в формат mm:ss
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Удаление расширения из названия файла
const removeFileExtension = (fileName) => {
  if (!fileName) return '';
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
};

export const AudioPlayer = ({ audioUri, fileName }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const player = useAudioPlayer({ uri: audioUri });
  const status = useAudioPlayerStatus(player);
  const { registerPlayer, unregisterPlayer, audioPlaybackRate, setAudioPlaybackRate, isLoaded } = useAudioPlayerContext();

  // Включаем коррекцию pitch при изменении скорости
  React.useEffect(() => {
    player.shouldCorrectPitch = true;
  }, [player]);

  // Применяем глобальную скорость к плееру при загрузке и при изменении глобальной скорости
  React.useEffect(() => {
    if (isLoaded) {
      player.setPlaybackRate(audioPlaybackRate, 'high');
    }
  }, [player, isLoaded, audioPlaybackRate]);

  // useAudioPlayer автоматически освобождает ресурсы при размонтировании
  // Ручная очистка НЕ требуется и вызывает ошибку "shared object already released"

  // КРИТИЧНО: expo-audio выгружает файл сразу после загрузки
  // Поэтому запускаем воспроизведение сразу, чтобы файл не выгрузился
  // Во время звонка не трогаем: pause() на iOS выключает аудиосессию вместе со звуком разговора,
  // а play() при занятой CallKit сессии бросает исключение
  React.useEffect(() => {
    if (isCallAudioActive()) return undefined;
    try {
      player.play();
    } catch {
      return undefined;
    }
    // Через 100ms ставим на паузу (файл останется загруженным)
    const timer = setTimeout(() => {
      try {
        player.pause();
      } catch {}
    }, 100);
    return () => clearTimeout(timer);
  }, [player]);

  // Отписываемся при размонтировании
  React.useEffect(() => {
    return () => {
      unregisterPlayer(audioUri);
    };
  }, [audioUri, unregisterPlayer]);

  // Сброс позиции при окончании воспроизведения
  React.useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const handlePlayPause = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (isCallAudioActive()) {
        Toast.show({
          type: 'info',
          text1: 'Идёт звонок',
          text2: 'Голосовое сообщение можно прослушать после звонка',
          position: 'top',
          visibilityTime: 2500,
        });
        return;
      }
      // Перед началом воспроизведения регистрируем плеер (остановит остальные)
      registerPlayer(player, audioUri);
      try {
        player.play();
      } catch (error) {
        console.warn('[AudioPlayer] Не удалось воспроизвести:', error?.message ?? error);
      }
    }
  };

  const handleSliderStart = () => {
    // Ничего не делаем - блокировка свайпа убрана
  };

  const handleSliderChange = (value) => {
    if (status.duration) {
      player.seekTo(value);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(audioPlaybackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];

    setAudioPlaybackRate(nextSpeed);

    // setPlaybackRate может вызвать автоплей (issue #38220), поэтому сохраняем текущее состояние
    const wasPlaying = status.playing;
    // Второй параметр - качество pitch коррекции (iOS only, android игнорирует)
    player.setPlaybackRate(nextSpeed, 'high');

    // Восстанавливаем состояние воспроизведения
    if (!wasPlaying && status.playing) {
      player.pause();
    }
  };

  const currentTime = status.currentTime || 0;
  const duration = status.duration || 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={status.playing ? 'pause' : 'play'}
          size={24}
          color={theme.onAccent}
        />
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <View style={styles.fileInfo}>
          <MaterialCommunityIcons name="microphone" size={14} color={theme.textSecondary} />
          <Text style={styles.fileName} numberOfLines={1}>
            {removeFileExtension(fileName) || 'Аудиофайл'}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={currentTime}
            onSlidingStart={handleSliderStart}
            onSlidingComplete={handleSliderChange}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.separator}
            thumbTintColor={theme.accent}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.speedButton}
        onPress={handleSpeedChange}
        activeOpacity={0.7}
      >
        <Text style={styles.speedButtonText}>{audioPlaybackRate}x</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.fill,
    borderRadius: 14,
    padding: 8,
    marginTop: 6,
    gap: 10,
    width: '100%',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentContainer: {
    flex: 1,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  fileName: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
  },
  progressContainer: {
    flex: 1,
  },
  slider: {
    width: '106%',
    height: 20,
    marginLeft: -8,
    zIndex: 9,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
    marginRight: 4,
    color: theme.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  speedButton: {
    minWidth: 40,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: theme.dark ? theme.surfaceAlt : theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accentText,
  },
});
