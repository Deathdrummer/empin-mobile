import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { formatStamp } from '../../utils/tasks';

const ICONS = {
  task_executor_changed: 'swap-horizontal',
};

/** Плашка-уведомление вверху экрана текущего дня (инт. 9.36: «в виде таблички, пока не закроют»; п. 9.3) */
export const NoticeCard = ({ notice, closing, onClose, onPress }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.card, pressed && onPress && s.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={s.icon}>
        <Ionicons name={ICONS[notice.kind] || 'notifications'} size={18} color={theme.accentText} />
      </View>
      <View style={s.body}>
        <Text style={s.title}>{notice.title}</Text>
        {notice.body ? <Text style={s.text}>{notice.body}</Text> : null}
        <Text style={s.time}>{formatStamp(notice.created_at)}</Text>
      </View>
      <TouchableOpacity
        style={s.close}
        onPress={onClose}
        disabled={closing}
        hitSlop={8}
        accessibilityLabel="Закрыть уведомление"
      >
        {closing ? <ActivityIndicator size="small" color={theme.textSecondary} /> : (
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        )}
      </TouchableOpacity>
    </Pressable>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.accentSoft,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    marginTop: 1,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: theme.text },
  text: { fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  time: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
});
