import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const EMOJIS = [
  { id: 'like', icon: 'thumb-up', color: '#757575', emoji: '👍' },
  { id: 'dislike', icon: 'thumb-down', color: '#757575', emoji: '👎' },
  { id: 'heart', icon: 'heart', color: '#757575', emoji: '❤️' },
  { id: 'fire', icon: 'fire', color: '#757575', emoji: '🔥' },
  { id: 'eyes', icon: 'eye', color: '#757575', emoji: '👀' },
];

export const EmojiPicker = ({ position, onEmojiSelect }) => {
  return (
    <View style={[styles.container, { top: position.top - 60 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate={0.92}
        snapToInterval={52}
        snapToAlignment="start"
      >
        {EMOJIS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.emojiButton}
            onPress={() => onEmojiSelect(item.emoji)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name={item.icon} size={28} color={item.color} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
    overflow: 'hidden',
    maxWidth: 240,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
  },
  emoji: {
    fontSize: 26,
  },
});
