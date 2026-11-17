import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../../components/ui/Sheet';
import { useTheme, useThemedStyles } from '../../theme';
import { productionAPI } from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import { formatStamp } from '../../utils/tasks';

const ICONS = {
  task_executor_changed: 'swap-horizontal',
};

/**
 * Уведомления раздела (п. 6.4, п. 9.3): каждое висит до ручного закрытия. Нажатие открывает задание,
 * если к нему ещё есть доступ (прежний исполнитель доступ теряет — карточка скажет об этом).
 */
export const NotificationsSheet = ({ visible, items, loading, onClose, onClosed, onOpenTask }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [closing, setClosing] = useState(null);

  const close = async (item) => {
    setClosing(item.id);
    try {
      await productionAPI.closeNotification(item.id);
      onClosed(item.id);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось закрыть', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setClosing(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Уведомления">
      <ScrollView style={s.list} contentContainerStyle={s.listContent}>
        {loading && !items.length ? <ActivityIndicator style={s.loader} color={theme.accent} /> : null}
        {!loading && !items.length ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={theme.textMuted} />
            <Text style={s.emptyText}>Уведомлений нет</Text>
          </View>
        ) : null}
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.task_id ? () => onOpenTask(item) : undefined}
            style={({ pressed }) => [s.item, pressed && item.task_id && { backgroundColor: theme.surfacePressed }]}
          >
            <View style={[s.icon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name={ICONS[item.kind] || 'notifications'} size={18} color={theme.accentText} />
            </View>
            <View style={s.body}>
              <Text style={s.title}>{item.title}</Text>
              {item.body ? <Text style={s.text}>{item.body}</Text> : null}
              <Text style={s.time}>{formatStamp(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={s.close}
              onPress={() => close(item)}
              disabled={closing === item.id}
              hitSlop={8}
              accessibilityLabel="Закрыть уведомление"
            >
              {closing === item.id ? <ActivityIndicator size="small" color={theme.textSecondary} /> : (
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              )}
            </TouchableOpacity>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 8 },
  loader: { marginVertical: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyText: { fontSize: 15, color: theme.textSecondary },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: theme.text },
  text: { fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  time: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.inputBackground },
});
