import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import ImageViewing from 'react-native-image-viewing';

const GAP = 2; // Промежуток между картинками
const ITEMS_PER_ROW = 3;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Функция определения типа медиа
const isVideo = (media) => {
  if (media.mimeType) {
    return media.mimeType.startsWith('video/');
  }
  const uri = media.uri || '';
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm'];
  return videoExtensions.some(ext => uri.toLowerCase().endsWith(ext));
};

// Компонент превью видео
const VideoPreview = ({ uri, style, showPlayIcon }) => {
  const [showSpinner, setShowSpinner] = React.useState(true);

  const player = useVideoPlayer(uri, (player) => {
    player.pause();
  });

  React.useEffect(() => {
    // Скрываем спиннер через 1.5 секунды, даже если onFirstFrame не сработал
    const timeout = setTimeout(() => {
      setShowSpinner(false);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [uri]);

  const handleFirstFrame = () => {
    console.log('[VideoPreview] First frame loaded for URI:', uri);
    setShowSpinner(false);
  };

  return (
    <View style={style}>
      <VideoView
        player={player}
        style={styles.mediaImage}
        nativeControls={false}
        contentFit="cover"
        onFirstFrame={handleFirstFrame}
      />
      {showSpinner && (
        <View style={styles.videoPreviewLoading}>
          <ActivityIndicator size="large" color="#999999" animating={true} />
        </View>
      )}
      {showPlayIcon && (
        <View style={styles.videoPlayIcon}>
          <MaterialCommunityIcons name="play-circle" size={32} color="rgba(255, 255, 255, 0.9)" />
        </View>
      )}
    </View>
  );
};

// Компонент отдельной картинки/видео
const MediaItem = ({ uri, mimeType, onRemove, index, showControls = true, isLast = false, onPress }) => {
  const mediaIsVideo = isVideo({ uri, mimeType });
  return (
    <>
      <TouchableOpacity
        activeOpacity={showControls ? 1 : 0.7}
        onPress={() => !showControls && onPress && onPress(index)}
        disabled={showControls}
        style={styles.mediaItemTouchable}
      >
        {mediaIsVideo ? (
          <VideoPreview uri={uri} style={styles.mediaImage} showPlayIcon={!showControls} />
        ) : (
          <Image
            source={{ uri }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>
      {showControls && onRemove && (
        <TouchableOpacity
          style={styles.mediaControlButton}
          onPress={() => onRemove(index)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </>
  );
};

// Компонент полноэкранного видео
const FullscreenVideo = ({ uri }) => {
  const [playbackRate, setPlaybackRate] = React.useState(1.0);
  const player = useVideoPlayer(uri, (player) => {
    player.play();
    // Включаем сохранение pitch при изменении скорости
    player.preservesPitch = true;
    player.playbackRate = playbackRate;
  });

  // Синхронизируем playbackRate при изменении
  React.useEffect(() => {
    player.playbackRate = playbackRate;
  }, [player, playbackRate]);

  const handleSpeedChange = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];

    setPlaybackRate(nextSpeed);
    // playbackRate будет синхронизирован через useEffect
  };

  return (
    <View style={styles.videoPlayerContainer}>
      <VideoView
        player={player}
        style={styles.fullscreenVideo}
        nativeControls={true}
        contentFit="contain"
      />
      <TouchableOpacity
        style={styles.videoSpeedButton}
        onPress={handleSpeedChange}
        activeOpacity={0.7}
      >
        <Text style={styles.videoSpeedButtonText}>{playbackRate}x</Text>
      </TouchableOpacity>
    </View>
  );
};

// Основной компонент сетки 3x3
export const MediaCollage = ({ mediaArray, onRemove, showControls = true }) => {
  const [imageViewerVisible, setImageViewerVisible] = React.useState(false);
  const [videoViewerVisible, setVideoViewerVisible] = React.useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = React.useState(0);

  if (!mediaArray || mediaArray.length === 0) {
    return null;
  }

  // Разделяем медиа на изображения и видео
  const images = mediaArray.filter(media => !isVideo(media));

  // Преобразуем изображения в формат для ImageViewing
  const imageViewingData = images.map(img => ({ uri: img.uri }));

  const handleImagePress = (index) => {
    const media = mediaArray[index];
    if (isVideo(media)) {
      // Для видео используем старый модальный просмотр
      setSelectedMediaIndex(index);
      setVideoViewerVisible(true);
    } else {
      // Для фото используем ImageViewing
      // Находим индекс в массиве только изображений
      const imageIndex = images.findIndex(img => img.uri === media.uri);
      setSelectedMediaIndex(imageIndex);
      setImageViewerVisible(true);
    }
  };

  const handleCloseImageViewer = () => {
    setImageViewerVisible(false);
  };

  const handleCloseVideoViewer = () => {
    setVideoViewerVisible(false);
  };

  // Динамическое определение количества элементов в ряду
  const totalItems = mediaArray.length;
  let itemsPerRow;

  if (totalItems === 1) {
    itemsPerRow = 1; // одна картинка на всю ширину
  } else if (totalItems === 2) {
    itemsPerRow = 2; // две картинки в ряд
  } else {
    itemsPerRow = 3; // три и более - по 3 в ряд
  }

  // Разбиваем массив медиа на ряды
  const rows = [];
  for (let i = 0; i < mediaArray.length; i += itemsPerRow) {
    rows.push(mediaArray.slice(i, i + itemsPerRow));
  }

  return (
    <>
      <View style={styles.collageContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((media, colIndex) => {
              const globalIndex = rowIndex * itemsPerRow + colIndex;
              const isLast = colIndex === row.length - 1 || colIndex === itemsPerRow - 1;

              // Вычисляем ширину элемента в зависимости от количества в ряду
              const itemWidth = `${(100 / itemsPerRow).toFixed(2)}%`;

              return (
                <View
                  key={globalIndex}
                  style={[
                    styles.mediaItem,
                    { width: itemWidth },
                    !isLast && styles.mediaItemWithMargin
                  ]}
                >
                  <MediaItem
                    uri={media.uri}
                    mimeType={media.mimeType}
                    onRemove={onRemove}
                    onPress={handleImagePress}
                    index={globalIndex}
                    showControls={showControls}
                    isLast={isLast}
                  />
                </View>
              );
            })}
            {/* Добавляем пустые элементы для выравнивания последнего ряда */}
            {row.length < itemsPerRow && [...Array(itemsPerRow - row.length)].map((_, i) => (
              <View
                key={`empty-${i}`}
                style={[
                  styles.emptyItem,
                  { width: `${(100 / itemsPerRow).toFixed(2)}%` },
                  i < itemsPerRow - row.length - 1 && styles.mediaItemWithMargin
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      {/* ImageViewing для просмотра фото с зумом и свайпом */}
      <ImageViewing
        images={imageViewingData}
        imageIndex={selectedMediaIndex}
        visible={imageViewerVisible}
        onRequestClose={handleCloseImageViewer}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />

      {/* Modal для полноэкранного просмотра видео */}
      <Modal
        visible={videoViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseVideoViewer}
      >
        <View style={styles.viewerContainer}>
          <Pressable
            style={styles.viewerBackdrop}
            onPress={handleCloseVideoViewer}
          />

          <FullscreenVideo uri={mediaArray[selectedMediaIndex]?.uri} />

          {/* Кнопка закрытия */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseVideoViewer}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  collageContainer: {
    marginTop: 8,
	 width: '99%'
  },
  row: {
    flexDirection: 'row',
    marginBottom: GAP,
  },
  mediaItem: {
    position: 'relative',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E5E9F0',
  },
  mediaItemWithMargin: {
    marginRight: GAP,
  },
  mediaItemTouchable: {
    width: '100%',
    height: '100%',
  },
  emptyItem: {
    // width задается динамически
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaControlButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoPlayerContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  videoSpeedButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  videoSpeedButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  videoPreviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#C5C4C5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  videoPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    zIndex: 2,
  },
});
