import React from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Modal, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DeleteConfirmModal = ({ visible, title, message, onCancel, onConfirm }) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBlurLayer} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.buttonsContainer}>
            <TouchableHighlight
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableHighlight>

            <TouchableHighlight
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.confirmButtonText}>Удалить</Text>
            </TouchableHighlight>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
  },
  modalBlurLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: SCREEN_WIDTH - 30,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#d0d0d0',
  },
  confirmButton: {
    backgroundColor: '#999999',
  },
  cancelButtonText: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
