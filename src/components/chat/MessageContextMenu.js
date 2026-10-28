import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { PinIcon } from './PinIcon';
import { ACTION_HEIGHT, REACTIONS_HEIGHT, layoutMessageMenu } from './messageMenuLayout';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];

const REACTIONS_APPEAR = ZoomIn.springify().damping(15).stiffness(260);
const MENU_APPEAR = ZoomIn.springify().damping(17).stiffness(240);

/**
 * Меню сообщения по долгому нажатию, как в Telegram и WhatsApp: сообщение остаётся на своём месте
 * поверх затемнённой (на iPhone — размытой) переписки, над ним — быстрые реакции, под ним — действия.
 * Если у края экрана не хватает места, вся группа сдвигается; длинное сообщение показывается обрезанным,
 * а на маленьком экране (или телефоне боком) действия прокручиваются — см. messageMenuLayout.
 *
 * anchor — положение строки сообщения на экране { y, height } (measureInWindow),
 * renderPreview — копия сообщения для показа поверх затемнения,
 * actions — [{ key, label, icon, destructive?, onPress }]; icon 'pin' / 'pin-off' — значок закрепления.
 */
export const MessageContextMenu = ({
  visible,
  message,
  anchor,
  isMine,
  sideOffset = 0,
  theme,
  myUserId,
  actions,
  renderPreview,
  onReact,
  onClose,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!message || !anchor) return null;

  const mine = new Set(
    (message.reactions || [])
      .filter((reaction) => Number(reaction.user_id) === Number(myUserId))
      .map((reaction) => reaction.emoji),
  );

  const layout = layoutMessageMenu({
    windowWidth, windowHeight, insets, anchor, actionsCount: actions.length, isMine, sideOffset,
  });
  const { previewTop, previewHeight, align } = layout;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть меню">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={28} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? 'rgba(0,0,0,0.55)' : 'rgba(10,10,12,0.4)' }]} />
        </Pressable>
      </Animated.View>

      {/* Копия сообщения на своём месте (длинное — обрезано) */}
      <View pointerEvents="none" style={[styles.preview, { top: previewTop, height: previewHeight }]}>
        {renderPreview()}
      </View>

      <Animated.View
        entering={REACTIONS_APPEAR}
        style={[styles.reactions, align, { top: layout.reactionsTop, maxWidth: layout.reactionsMaxWidth, backgroundColor: theme.sheet }]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionsContent}>
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji, mine.has(emoji))}
              style={({ pressed }) => [
                styles.reaction,
                mine.has(emoji) && { backgroundColor: theme.reactionMine },
                pressed && { transform: [{ scale: 1.25 }] },
              ]}
              accessibilityLabel={`Реакция ${emoji}`}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View
        entering={MENU_APPEAR}
        style={[styles.menu, align, {
          top: layout.menuTop, width: layout.menuWidth, height: layout.menuHeight, backgroundColor: theme.sheet,
        }]}
      >
        <ScrollView scrollEnabled={layout.menuScrolls} showsVerticalScrollIndicator={layout.menuScrolls} bounces={false}>
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
              {action.icon === 'pin' || action.icon === 'pin-off' ? (
                <PinIcon variant={action.icon === 'pin-off' ? 'off' : 'pin'} size={20} color={theme.textSecondary} />
              ) : (
                <Ionicons name={action.icon} size={20} color={action.destructive ? theme.danger : theme.textSecondary} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  preview: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  reactions: {
    position: 'absolute',
    height: REACTIONS_HEIGHT,
    borderRadius: REACTIONS_HEIGHT / 2,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  reactionsContent: { paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  reaction: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 26 },
  menu: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  action: { height: ACTION_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  actionLabel: { fontSize: 16 },
});
