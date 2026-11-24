import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../../../theme';
import { resolveMediaUri } from '../../../../utils/mediaUri';
import { canSaveEdit, keptMediaPaths, separateMediaAndDocuments } from '../../../../utils/chatMedia';
import { MediaCollage } from '../MediaCollage';
import { DocumentList } from '../DocumentList';
import { AudioPlayer } from '../AudioPlayer';

const toItems = (media) => (media || []).map((m) => ({
  uri: resolveMediaUri(m.path),
  path: m.path,
  name: m.name,
  mimeType: m.mime_type,
  size: m.size,
}));

// Правка сообщения чата объекта: текст и вложения (убранные уходят в keep_media)
export const EditCommentModal = ({ visible, comment, onClose, onSave, loading = false }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [editedText, setEditedText] = useState('');
  const [kept, setKept] = useState([]);

  useEffect(() => {
    if (comment) {
      setEditedText(comment.message || '');
      setKept(toItems(comment.media));
    }
  }, [comment]);

  const canSave = canSaveEdit(editedText, kept);
  const remove = (item) => setKept((prev) => prev.filter((m) => m !== item));
  const { media, audio, documents } = separateMediaAndDocuments(kept);

  const handleSave = () => {
    if (canSave) onSave(editedText.trim(), keptMediaPaths(comment?.media, kept));
  };

  const handleClose = () => {
    setEditedText('');
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="Изменить комментарий"
      keyboard
      buttons={(
        <>
          <DialogButton title="Отмена" onPress={handleClose} disabled={loading} />
          <DialogButton
            title="Сохранить"
            variant="primary"
            onPress={handleSave}
            disabled={!canSave || loading}
          />
        </>
      )}
    >
      <View>
        <TextInput
          style={styles.textInput}
          value={editedText}
          onChangeText={setEditedText}
          multiline
          autoFocus
          placeholder="Текст комментария"
          placeholderTextColor={theme.textMuted}
          editable={!loading}
        />
        {kept.length > 0 && (
          <ScrollView style={styles.attachments} keyboardShouldPersistTaps="handled">
            {media.length > 0 && (
              <MediaCollage mediaArray={media} onRemove={(index) => remove(media[index])} showControls />
            )}
            {audio.map((file) => (
              <View key={file.path} style={styles.audioItem}>
                <AudioPlayer audioUri={file.uri} fileName={file.name} />
                <TouchableOpacity style={styles.audioRemoveButton} onPress={() => remove(file)} disabled={loading}>
                  <MaterialCommunityIcons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {documents.length > 0 && (
              <DocumentList documents={documents} onRemove={(index) => remove(documents[index])} showControls />
            )}
          </ScrollView>
        )}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}
      </View>
    </Dialog>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  textInput: {
    marginTop: 8,
    backgroundColor: theme.inputBackground,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: theme.text,
    minHeight: 110,
    maxHeight: 220,
    textAlignVertical: 'top',
  },
  attachments: {
    marginTop: 8,
    maxHeight: 260,
  },
  audioItem: {
    position: 'relative',
    marginBottom: 8,
  },
  audioRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.veil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
});
