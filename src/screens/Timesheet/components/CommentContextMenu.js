import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const CommentContextMenu = ({ position, onEdit, onDelete, onReply }) => {
  return (
    <View style={[styles.container, { top: position.top + 10 }]}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onReply}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemText}>Ответить</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onEdit}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemText}>Редактировать</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onDelete}
        activeOpacity={0.7}
      >
        <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Удалить</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '60%',
    alignSelf: 'center',
    left: '20%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '400',
  },
  menuItemTextDanger: {
    color: '#999999',
  },
  separator: {
    height: 1,
    backgroundColor: '#DCDCDC',
    marginHorizontal: 0,
  },
});
