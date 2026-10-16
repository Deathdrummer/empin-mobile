import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../theme';

export const CommentContextMenu = ({ position, onEdit, onDelete, onReply, onCopy, isSelf = true }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.container, { top: position.top + 10 }]}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onReply}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="reply-outline" size={20} color={theme.textSecondary} />
        <Text style={styles.menuItemText}>Ответить</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onCopy}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="content-copy" size={20} color={theme.textSecondary} />
        <Text style={styles.menuItemText}>Скопировать</Text>
      </TouchableOpacity>

      {isSelf && (
        <>
          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onEdit}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.menuItemText}>Редактировать</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color={theme.danger} />
            <Text style={[styles.menuItemText, styles.dangerText]}>Удалить</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    minWidth: 240,
    backgroundColor: theme.sheet,
    borderRadius: 14,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.dark ? 0.5 : 0.18,
    shadowRadius: 16,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'left',
    fontWeight: '400',
    marginLeft: 12,
  },
  dangerText: {
    color: theme.danger,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
    marginLeft: 48,
  },
});
