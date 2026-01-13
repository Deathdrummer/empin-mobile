import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { useAudioPlayerContext } from '../../../contexts/AudioPlayerContext';
import { useSwipeControl } from '../../../contexts/SwipeControlContext';

// Форматирование времени в формат mm:ss
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer = ({ audioUri, fileName }) => {
  const player = useAudioPlayer({ uri: audioUri });
  const status = useAudioPlayerStatus(player);
  const { registerPlayer, unregisterPlayer } = useAudioPlayerContext();
  const { disableSwipe, enableSwipe } = useSwipeControl();
  const isSliding = React.useRef(false);

  // useAudioPlayer автоматически освобождает ресурсы при размонтировании
  // Ручная очистка НЕ требуется и вызывает ошибку "shared object already released"

  // Отписываемся при размонтировании
  React.useEffect(() => {
    return () => {
      unregisterPlayer(player);
      // Убеждаемся, что свайп разблокирован при размонтировании
      if (isSliding.current) {
        enableSwipe();
      }
    };
  }, [player, unregisterPlayer, enableSwipe]);

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
    isSliding.current = true;
    disableSwipe();
  };

  const handleSliderChange = (value) => {
    if (status.duration) {
      player.seekTo(value);
    }
    if (isSliding.current) {
      isSliding.current = false;
      enableSwipe();
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
          color="#4A90E2"
        />
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <View style={styles.fileInfo}>
          <MaterialCommunityIcons name="file-music" size={16} color="#666" />
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName || 'Áудиофайл'}
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
    width: '107%',
    height: 20,
	marginLeft: -14,
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
});
