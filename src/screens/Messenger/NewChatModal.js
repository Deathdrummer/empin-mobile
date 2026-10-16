import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { timesheetAPI } from '../../services/api';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { fullName } from '../../utils/chatFormat';

/** Новый чат: выбор сотрудника с поиском. Справа — звонок без открытия переписки. */
export default function NewChatModal({ visible, onClose, onOpenChat, onCall }) {
  const theme = useTheme();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setQuery('');
    setLoading(true);

    (async () => {
      try {
        const [data, userJson] = await Promise.all([timesheetAPI.getAllStaff(), AsyncStorage.getItem('user')]);
        const myStaffId = userJson ? JSON.parse(userJson)?.staff_id : null;
        if (!cancelled) setStaff((data || []).filter((person) => person.id !== myStaffId));
      } catch (error) {
        console.warn('[Messenger] Не удалось загрузить сотрудников:', error?.message ?? error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((person) =>
      [person.sname, person.fname, person.mname].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [staff, query]);

  const s = styles(theme);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Новый чат</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть">
            <Text style={s.close}>Отмена</Text>
          </TouchableOpacity>
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Поиск сотрудника"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <ActivityIndicator style={s.loader} color={theme.accent} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.empty}>Никого не нашли</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
                onPress={() => onOpenChat(item)}
              >
                <Avatar person={item} id={item.id} size={44} />
                <View style={s.rowBody}>
                  <Text style={s.name} numberOfLines={1}>{fullName(item)}</Text>
                  {item.mname ? <Text style={s.sub} numberOfLines={1}>{`${item.fname ?? ''} ${item.mname}`.trim()}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => onCall(item)}
                  hitSlop={8}
                  style={s.callButton}
                  accessibilityLabel={`Позвонить: ${fullName(item)}`}
                >
                  <Ionicons name="call-outline" size={22} color={theme.accent} />
                </TouchableOpacity>
              </Pressable>
            )}
          />
        )}
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
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.text },
  close: { fontSize: 16, color: theme.accent, fontWeight: '500' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
  },
  searchInput: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 0 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: theme.textSecondary, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  rowBody: { flex: 1, minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  name: { fontSize: 16, fontWeight: '500', color: theme.text },
  sub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  callButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
