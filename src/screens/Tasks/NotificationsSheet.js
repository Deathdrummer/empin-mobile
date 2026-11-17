import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../../components/ui/Sheet';
import { useTheme, useThemedStyles } from '../../theme';
import { NoticeCard } from './NoticeCard';

/**
 * Список уведомлений раздела (п. 6.4): те же плашки, что вверху экрана текущего дня, — все сразу, когда их много.
 * Каждое закрывается вручную.
 */
export const NotificationsSheet = ({ visible, items, loading, closingId, onClose, onCloseNotice, onOpenNotice }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);

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
          <NoticeCard
            key={item.id}
            notice={item}
            closing={closingId === item.id}
            onClose={() => onCloseNotice(item)}
            onPress={onOpenNotice(item)}
          />
        ))}
      </ScrollView>
    </Sheet>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8 },
  loader: { marginVertical: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyText: { fontSize: 15, color: theme.textSecondary },
});
