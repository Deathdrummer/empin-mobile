import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const EDGE = 16;

/**
 * Шапка полноэкранного просмотра фото и видео: счётчик и кнопки с отступом от безопасной зоны —
 * на iPhone с Dynamic Island кнопки не уходят в скруглённый угол экрана.
 * actions — дополнительные кнопки слева от «Закрыть»: [{ key, icon, label, onPress }].
 */
export const ViewerHeader = ({ title, onClose, actions = [] }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingLeft: insets.left + EDGE,
          paddingRight: insets.right + EDGE,
        },
      ]}
    >
      <Text style={styles.title} numberOfLines={1}>{title || ''}</Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable key={action.key} onPress={action.onPress} hitSlop={8} style={styles.button} accessibilityLabel={action.label}>
            <Ionicons name={action.icon} size={22} color="#FFFFFF" />
          </Pressable>
        ))}
        <Pressable onPress={onClose} hitSlop={8} style={styles.button} accessibilityLabel="Закрыть">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
