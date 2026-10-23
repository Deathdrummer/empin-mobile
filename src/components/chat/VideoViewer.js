import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ViewerHeader } from './ViewerHeader';

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
      <View style={styles.header} pointerEvents="box-none">
        <ViewerHeader onClose={onClose} />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
});
