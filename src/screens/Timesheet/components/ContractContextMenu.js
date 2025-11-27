import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const ContractContextMenu = ({ position, isExpanded, onDelete, onCopyNumber, onCopyTitle, onCopyTitul, onCopyAllData }) => {
  return (
    <View style={[styles.container, { top: position.top }]}>
      {!isExpanded ? (
        // Меню для свернутого договора
        <>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onCopyAllData}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="content-copy" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Скопировать данные договора</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Удалить</Text>
          </TouchableOpacity>
        </>
      ) : (
        // Меню для развернутого договора
        <>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onCopyNumber}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="content-copy" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Скопировать номер объекта</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onCopyTitle}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="content-copy" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Скопировать название объекта</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onCopyTitul}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="content-copy" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Скопировать титул</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color="#666666" />
            <Text style={styles.menuItemText}>Удалить</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'left',
    fontWeight: '400',
    marginLeft: 12,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DCDCDC',
    marginHorizontal: 12,
  },
});
