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
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { messengerAPI, timesheetAPI } from '../../services/api';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { fullName, plural } from '../../utils/chatFormat';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * «Переслать»: выбор чатов и сотрудников (можно несколько), как в Telegram.
 * Сверху — личные чаты и группы по последней активности, ниже — остальные сотрудники.
 * В чаты объектов не пересылается: там сообщения становятся комментариями табеля.
 */
export default function ForwardSheet({ visible, sourceChatId, messageIds, onClose, onForwarded }) {
  const theme = useTheme();
  const [chats, setChats] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setQuery('');
    setSelected([]);
    setLoading(true);

    (async () => {
      try {
        const [chatData, staffData, userJson] = await Promise.all([
          messengerAPI.getChats(),
          timesheetAPI.getAllStaff().catch(() => []),
          AsyncStorage.getItem('user'),
        ]);
        if (cancelled) return;
        const myStaffId = Number(userJson ? JSON.parse(userJson)?.staff_id : 0);
        const list = (chatData?.chats || []).filter((chat) => chat.type !== 'object');
        const withChat = new Set(list.filter((chat) => chat.type === 'direct').map((chat) => Number(chat.participant?.id)));
        setChats(list);
        setStaff((staffData || []).filter((person) => Number(person.id) !== myStaffId && !withChat.has(Number(person.id))));
      } catch (error) {
        if (!cancelled) Toast.show({ type: 'error', text1: 'Не удалось загрузить чаты', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (value) => !needle || String(value || '').toLowerCase().includes(needle);
    const chatItems = chats
      .filter((chat) => matches(chat.title))
      .map((chat) => ({ key: `chat-${chat.chat_id}`, kind: 'chat', chat }));
    // Сотрудники без чата — только при поиске, иначе список слишком длинный
    const staffItems = needle
      ? staff
        .filter((person) => matches([person.sname, person.fname, person.mname].filter(Boolean).join(' ')))
        .map((person) => ({ key: `staff-${person.id}`, kind: 'staff', person }))
      : [];
    return staffItems.length
      ? [...chatItems, { key: 'staff-title', kind: 'title' }, ...staffItems]
      : chatItems;
  }, [chats, staff, query]);

  const isSelected = (item) => selected.some((entry) => entry.key === item.key);

  const toggle = (item) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((current) => (isSelected(item)
      ? current.filter((entry) => entry.key !== item.key)
      : [...current, item]));
  };

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      const data = await messengerAPI.forward(sourceChatId, messageIds, {
        chatIds: selected.filter((item) => item.kind === 'chat').map((item) => item.chat.chat_id),
        staffIds: selected.filter((item) => item.kind === 'staff').map((item) => item.person.id),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const count = data?.chat_ids?.length ?? selected.length;
      Toast.show({
        type: 'success',
        text1: count > 1 ? `Переслано в ${count} ${plural(count, 'чат', 'чата', 'чатов')}` : 'Переслано',
        position: 'top',
        visibilityTime: 1800,
      });
      onForwarded?.(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось переслать', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setSending(false);
    }
  };

  const s = styles(theme);
  const count = messageIds?.length || 0;

  const renderItem = ({ item }) => {
    if (item.kind === 'title') return <Text style={s.sectionTitle}>Сотрудники</Text>;
    const checked = isSelected(item);
    const title = item.kind === 'chat' ? item.chat.title : fullName(item.person);
    const sub = item.kind === 'chat' && item.chat.type === 'group'
      ? `${item.chat.members_count || 0} ${plural(item.chat.members_count || 0, 'участник', 'участника', 'участников')}`
      : null;
    return (
      <Pressable
        style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
        onPress={() => toggle(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={title}
      >
        {item.kind === 'chat'
          ? <ChatAvatar chat={item.chat} size={44} showOnline={false} />
          : <Avatar person={item.person} id={item.person.id} size={44} />}
        <View style={s.rowBody}>
          <View style={s.rowText}>
            <Text style={s.name} numberOfLines={1}>{title}</Text>
            {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
          </View>
          <View style={[s.check, checked && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            {checked ? <Ionicons name="checkmark" size={16} color={theme.onAccent} /> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть">
            <Text style={s.headerAction}>Отмена</Text>
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>
            {count > 1 ? `Переслать ${count} ${plural(count, 'сообщение', 'сообщения', 'сообщений')}` : 'Переслать'}
          </Text>
          <View style={s.headerSpacer} />
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Поиск чата или сотрудника"
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
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={<Text style={s.empty}>{query.trim() ? 'Ничего не нашли' : 'Чатов пока нет — найдите сотрудника поиском'}</Text>}
          />
        )}

        {selected.length ? (
          <View style={[s.footer, { borderTopColor: theme.separator }]}>
            <Text style={s.footerText} numberOfLines={1}>
              {selected.map((item) => (item.kind === 'chat' ? item.chat.title : fullName(item.person))).join(', ')}
            </Text>
            <Pressable
              onPress={send}
              disabled={sending}
              style={({ pressed }) => [s.send, { backgroundColor: pressed ? theme.accentPressed : theme.accent }]}
              accessibilityLabel="Отправить"
            >
              {sending ? <ActivityIndicator color={theme.onAccent} /> : <Ionicons name="arrow-up" size={22} color={theme.onAccent} />}
            </Pressable>
          </View>
        ) : null}
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
    gap: 12,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
  headerAction: { fontSize: 16, color: theme.accent, fontWeight: '500', minWidth: 64 },
  headerSpacer: { minWidth: 64 },
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
  empty: { textAlign: 'center', marginTop: 40, marginHorizontal: 32, color: theme.textSecondary, fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1, fontSize: 15, color: theme.text },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
