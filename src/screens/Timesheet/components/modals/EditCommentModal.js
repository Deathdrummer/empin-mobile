import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, TouchableHighlight, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

export const EditCommentModal = ({ visible, comment, onClose, onSave, loading = false }) => {
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
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Редактировать комментарий</Text>

          <TextInput
            style={styles.textInput}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            autoFocus
            placeholder="Введите текст комментария..."
            placeholderTextColor="#999"
            editable={!loading}
          />

          <View style={styles.modalButtons}>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={handleClose}
              disabled={loading}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.modalButtonTextCancel}>Отмена</Text>
            </TouchableHighlight>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonSave, !editedText.trim() && styles.modalButtonDisabled]}
              onPress={handleSave}
              disabled={!editedText.trim() || loading}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.modalButtonTextSave}>Сохранить</Text>
            </TouchableHighlight>
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.23,
    shadowRadius: 11.78,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  textInput: {
    marginHorizontal: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#000',
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#d0d0d0',
  },
  modalButtonSave: {
    backgroundColor: '#999999',
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
  modalButtonTextCancel: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonTextSave: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
});
