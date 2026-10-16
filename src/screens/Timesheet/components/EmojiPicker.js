import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useThemedStyles } from '../../../theme';

const EMOJIS = [
  { id: 'like', emoji: '👍' },
  { id: 'dislike', emoji: '👎' },
  { id: 'heart', emoji: '❤️' },
  { id: 'fire', emoji: '🔥' },
  { id: 'eyes', emoji: '👀' },
];

export const EmojiPicker = ({ position, onEmojiSelect }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.container, { top: position.top - 60 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate={0.92}
        snapToInterval={48}
        snapToAlignment="start"
      >
        {EMOJIS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.emojiButton}
            onPress={() => onEmojiSelect(item.emoji)}
            activeOpacity={0.6}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: theme.sheet,
    borderRadius: 28,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.dark ? 0.5 : 0.18,
    shadowRadius: 16,
    zIndex: 1000,
    overflow: 'hidden',
    maxWidth: 260,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    marginHorizontal: 2,
  },
  emoji: {
    fontSize: 28,
  },
});
