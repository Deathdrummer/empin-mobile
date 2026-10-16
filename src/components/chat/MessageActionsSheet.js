import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaLabel } from '../../utils/chatFormat';
import { normalizeMedia } from './MessageBubble';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];

/**
 * Меню сообщения по долгому нажатию: быстрые реакции, превью и действия.
 * actions: [{ key, label, icon, destructive?, onPress }]
 */
export const MessageActionsSheet = ({ visible, message, theme, myUserId, actions, onReact, onClose }) => {
  if (!message) return null;

  const mine = new Set(
    (message.reactions || [])
      .filter((reaction) => Number(reaction.user_id) === Number(myUserId))
      .map((reaction) => reaction.emoji),
  );
  const media = normalizeMedia(message.media);
  const preview = (message.message || '').trim() || mediaLabel(media[0]?.type) || 'Сообщение';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
        <View style={styles.column} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.reactions, { backgroundColor: theme.sheet }]}
            contentContainerStyle={styles.reactionsContent}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji, mine.has(emoji))}
                style={[styles.reaction, mine.has(emoji) && { backgroundColor: theme.reactionMine }]}
                accessibilityLabel={`Реакция ${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.preview, { backgroundColor: message.isMine ? theme.bubbleOut : theme.bubbleIn }]}>
            <Text style={[styles.previewText, { color: message.isMine ? theme.bubbleOutText : theme.bubbleInText }]} numberOfLines={6}>
              {preview}
            </Text>
          </View>

          <View style={[styles.actions, { backgroundColor: theme.sheet }]}>
            {actions.map((action, index) => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.action,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  pressed && { backgroundColor: theme.surfacePressed },
                ]}
              >
                <Text style={[styles.actionLabel, { color: action.destructive ? theme.danger : theme.text }]}>{action.label}</Text>
                <Ionicons name={action.icon} size={20} color={action.destructive ? theme.danger : theme.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  column: { gap: 10 },
  reactions: { flexGrow: 0, borderRadius: 26, alignSelf: 'center', maxWidth: '100%' },
  reactionsContent: { paddingHorizontal: 6, paddingVertical: 4, gap: 2 },
  reaction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 26 },
  preview: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'stretch' },
  previewText: { fontSize: 16, lineHeight: 21 },
  actions: { borderRadius: 14, overflow: 'hidden' },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 },
  actionLabel: { fontSize: 16 },
});
