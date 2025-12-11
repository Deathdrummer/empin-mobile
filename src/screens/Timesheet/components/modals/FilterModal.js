import React from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Modal } from 'react-native';

export const FilterModal = ({ visible, onClose, onApply }) => {
  const handleApply = () => {
    // TODO: Реализовать применение фильтров
    if (onApply) {
      onApply();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Фильтры</Text>

          <View style={styles.filterContainer}>
            {/* TODO: Добавить элементы фильтров */}
          </View>

          <View style={styles.modalButtons}>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.modalButtonTextCancel}>Отмена</Text>
            </TouchableHighlight>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonApply]}
              onPress={handleApply}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.modalButtonTextApply}>Применить</Text>
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    minHeight: 100,
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
  modalButtonApply: {
    backgroundColor: '#999999',
  },
  modalButtonTextCancel: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonTextApply: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
