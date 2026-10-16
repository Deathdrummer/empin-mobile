import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../../../theme';

export const EditCommentModal = ({ visible, comment, onClose, onSave, loading = false }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (comment) {
      setEditedText(comment.message);
    }
  }, [comment]);

  const handleSave = () => {
    if (editedText.trim()) {
      onSave(editedText.trim());
      setEditedText('');
    }
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
            disabled={!editedText.trim() || loading}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.veil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
});
