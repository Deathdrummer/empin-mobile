import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableHighlight, Modal, Dimensions, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LogoutModal = ({ visible, onClose, onConfirm }) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" hidden={true} />
      <View style={styles.modalOverlay}>
        <View style={styles.modalBlurLayer} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Выход</Text>
          <Text style={styles.modalText}>Вы уверены, что хотите выйти?</Text>
          <View style={styles.modalButtons}>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.modalButtonTextCancel}>Отмена</Text>
            </TouchableHighlight>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={onConfirm}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.modalButtonTextConfirm}>Выйти</Text>
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
    padding: 25,
    width: SCREEN_WIDTH - 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 25,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#d0d0d0',
  },
  modalButtonConfirm: {
    backgroundColor: '#999999',
  },
  modalButtonTextCancel: {
    color: '#777',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
