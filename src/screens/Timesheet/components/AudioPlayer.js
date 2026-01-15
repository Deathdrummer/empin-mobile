import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { useAudioPlayerContext } from '../../../contexts/AudioPlayerContext';

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
  const player = useAudioPlayer({ uri: audioUri });
  const status = useAudioPlayerStatus(player);
  const { registerPlayer, unregisterPlayer } = useAudioPlayerContext();
  const [playbackRate, setPlaybackRate] = React.useState(1.0);

  // useAudioPlayer автоматически освобождает ресурсы при размонтировании
  // Ручная очистка НЕ требуется и вызывает ошибку "shared object already released"

  // КРИТИЧНО: expo-audio выгружает файл сразу после загрузки
  // Поэтому запускаем воспроизведение сразу, чтобы файл не выгрузился
  React.useEffect(() => {
    // Устанавливаем playbackRate сразу после создания плеера
    player.playbackRate = playbackRate;
    player.play();
    // Через 100ms ставим на паузу (файл останется загруженным)
    const timer = setTimeout(() => {
      player.pause();
    }, 100);
    return () => clearTimeout(timer);
  }, [player]);

  // Синхронизируем playbackRate при изменении
  React.useEffect(() => {
    player.playbackRate = playbackRate;
  }, [player, playbackRate]);

  // Отписываемся при размонтировании
  React.useEffect(() => {
    return () => {
      unregisterPlayer(player);
    };
  }, [player, unregisterPlayer]);

  const handlePlayPause = () => {
    if (status.playing) {
      player.pause();
    } else {
      // Перед началом воспроизведения регистрируем плеер (остановит остальные)
      registerPlayer(player);
      player.play();
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
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];

    setPlaybackRate(nextSpeed);
    // playbackRate будет синхронизирован через useEffect
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
          color="#4A90E2"
        />
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <View style={styles.fileInfo}>
          <MaterialCommunityIcons name="file-music" size={16} color="#666" />
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
            minimumTrackTintColor="#4A90E2"
            maximumTrackTintColor="#E0E0E0"
            thumbTintColor="#4A90E2"
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
        <Text style={styles.speedButtonText}>{playbackRate}x</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 12,
	width: '100%',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
	zIndex: 10
  },
  contentContainer: {
    flex: 1,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
	
  },
  fileName: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  progressContainer: {
    flex: 1,
  },
  slider: {
    width: '106%',
    height: 20,
	marginLeft: -8,
	zIndex: 9
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: {
    fontSize: 10,
	marginLeft: 4,
	marginRight: 4,
    color: '#999',
  },
  speedButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  speedButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A90E2',
  },
});
