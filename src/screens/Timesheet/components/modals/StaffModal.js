import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableHighlight, ScrollView, Modal, Dimensions, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const StaffModal = ({ visible, staffList, onClose, onSelectStaff }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" hidden={true} />
      <View style={styles.modalOverlay}>
        <View style={styles.modalBlurLayer} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Выберите сотрудника</Text>
          <ScrollView style={styles.modalList} keyboardShouldPersistTaps='handled'>
            {staffList.map((staff) => (
              <TouchableOpacity
                key={staff.id}
                style={styles.modalItem}
                onPress={() => onSelectStaff(staff.id, `${staff.sname} ${staff.fname} ${staff.mname}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalItemText}>
                  {staff.sname} {staff.fname} {staff.mname}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableHighlight style={styles.modalCloseButton} onPress={onClose} underlayColor="#b8b8b8">
            <Text style={styles.modalCloseText}>Закрыть</Text>
          </TouchableHighlight>
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
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 25,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#777',
    fontSize: 16,
    fontWeight: '700',
  },
});
