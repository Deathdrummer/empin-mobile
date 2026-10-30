import React, { useMemo } from 'react';
import { Modal, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { fullName, formatLastSeen } from '../../utils/chatFormat';
import { plainText } from '../../utils/richText';

/**
 * «Прочитали» у своего сообщения в группе и чате объекта: кто прочитал и кто ещё нет
 * (в Telegram — только прочитавшие; для бригад полезно видеть и тех, кто ещё не видел).
 */
export default function ReadersSheet({ visible, message, read, unread, onClose }) {
  const theme = useTheme();
  const s = styles(theme);

  const sections = useMemo(() => [
    { key: 'read', title: `Прочитали · ${read.length}`, data: read },
    { key: 'unread', title: `Ещё не прочитали · ${unread.length}`, data: unread },
  ].filter((section) => section.data.length), [read, unread]);

  const preview = message ? plainText(message.message || '').replace(/\s+/g, ' ').trim() : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={s.headerSpacer} />
          <Text style={s.title} numberOfLines={1}>Прочитали</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть" style={s.headerSpacer}>
            <Text style={s.headerAction}>Готово</Text>
          </TouchableOpacity>
        </View>
        {preview ? <Text style={s.preview} numberOfLines={2}>{preview}</Text> : null}

        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
          renderItem={({ item, section }) => (
            <View style={s.row} accessible accessibilityLabel={`${fullName(item)}, ${section.key === 'read' ? 'прочитал' : 'ещё не прочитал'}`}>
              <Avatar person={item} id={item.id} size={40} />
              <View style={s.rowBody}>
                <View style={s.rowText}>
                  <Text style={s.name} numberOfLines={1}>{fullName(item)}</Text>
                  <Text style={[s.sub, item.online && { color: theme.accent }]} numberOfLines={1}>
                    {formatLastSeen(item.online, item.last_seen_at)}
                  </Text>
                </View>
                {section.key === 'read'
                  ? <Ionicons name="checkmark-done" size={20} color={theme.accent} />
                  : <Ionicons name="checkmark" size={20} color={theme.textMuted} />}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>В чате больше никого нет</Text>}
          contentContainerStyle={s.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
  headerAction: { fontSize: 16, color: theme.accent, fontWeight: '600', textAlign: 'right' },
  headerSpacer: { minWidth: 64 },
  preview: { fontSize: 14, color: theme.textSecondary, paddingHorizontal: 16, paddingBottom: 4, textAlign: 'center' },
  listContent: { paddingBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 12 },
  rowBody: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500', color: theme.text },
  sub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 40, marginHorizontal: 32, color: theme.textSecondary, fontSize: 15 },
});
