import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

const Player = ({ uri }) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.play();
  });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
};

/** Полноэкранный просмотр видео из сообщения */
export const VideoViewer = ({ uri, onClose }) => (
  <Modal visible={Boolean(uri)} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
    <View style={styles.container}>
      {uri ? <Player uri={uri} /> : null}
      <Pressable style={styles.close} onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть видео">
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
