import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../theme';

export const ActiveFilterTags = ({ tags, onRemoveTag, onClearAll }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);

  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.container}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {tags.map((tag) => (
        <TouchableOpacity
          key={tag.id}
          style={s.tag}
          onPress={() => onRemoveTag(tag.type, tag.itemId)}
          activeOpacity={0.7}
          accessibilityLabel={`Убрать фильтр: ${tag.label}`}
        >
          <Text style={s.tagText} numberOfLines={1}>
            {tag.label}
          </Text>
          <Ionicons name="close" size={15} color={theme.accentText} />
        </TouchableOpacity>
      ))}
      {onClearAll && tags.length > 1 ? (
        <TouchableOpacity style={s.clearAll} onPress={onClearAll} activeOpacity={0.7}>
          <Text style={s.clearAllText}>Сбросить</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accentSoft,
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    color: theme.accentText,
    fontWeight: '600',
    maxWidth: 170,
  },
  clearAll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});
