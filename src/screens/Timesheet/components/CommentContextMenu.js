import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const CommentContextMenu = ({ position, onEdit, onDelete, onReply, onCopy }) => {
  return (
    <View style={[styles.container, { top: position.top + 10 }]}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onReply}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="reply-outline" size={20} color="#666666" />
        <Text style={styles.menuItemText}>Ответить</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onCopy}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="content-copy" size={20} color="#666666" />
        <Text style={styles.menuItemText}>Скопировать</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onEdit}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color="#666666" />
        <Text style={styles.menuItemText}>Редактировать</Text>
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
