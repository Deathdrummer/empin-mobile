import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const ActiveFilterTags = ({ tags, onRemoveTag }) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tags.map((tag) => (
          <View key={tag.id} style={styles.tag}>
            <Text style={styles.tagText} numberOfLines={1}>
              {tag.label}
            </Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemoveTag(tag.type, tag.itemId)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#555555" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E9ECF1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 2,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2dde7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tagText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    maxWidth: 150,
  },
  removeButton: {
    padding: 1,
    marginLeft: 1,
  },
});
