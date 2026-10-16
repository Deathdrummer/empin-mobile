import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { messengerAPI } from '../../services/api';
import { setTotalUnread, subscribeMessengerEvents } from '../../services/messengerStore';
import { useCallContext } from '../../contexts/CallContext';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { formatListTime, fullName } from '../../utils/chatFormat';
import NewChatModal from './NewChatModal';

// Запасное обновление, если Pusher недоступен: события реального времени обновляют список сразу
const FALLBACK_REFRESH_MS = 30000;

const MESSAGE_TYPE_ICONS = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'mic-outline',
  document: 'document-text-outline',
  archive: 'archive-outline',
  file: 'attach-outline',
};

export default function ChatsTab() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { initiateCall } = useCallContext();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [newChatVisible, setNewChatVisible] = useState(false);
  const loadingRef = useRef(false);
  const reloadTimerRef = useRef(null);

  const loadChats = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await messengerAPI.getChats();
      setChats(data.chats || []);
      setTotalUnread(data.total_unread);
    } catch (error) {
      console.warn('[Messenger] Не удалось загрузить чаты:', error?.message ?? error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Возврат на экран (в том числе из переписки) — свежие непрочитанные и превью
  useFocusEffect(useCallback(() => {
    loadChats();
    const timer = setInterval(loadChats, FALLBACK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadChats]));

  // Новое сообщение, правка, прочтение — обновляем список (несколько событий подряд — одна загрузка)
  useEffect(() => {
    const unsubscribe = subscribeMessengerEvents((name) => {
      if (name === 'chat.typing') return;
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(loadChats, 300);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadChats();
    });
    return () => {
      unsubscribe();
      appState.remove();
      clearTimeout(reloadTimerRef.current);
    };
  }, [loadChats]);

  const unreadChats = useMemo(() => chats.filter((chat) => chat.unread_count > 0).length, [chats]);

  const visibleChats = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chats.filter((chat) => {
      if (onlyUnread && !chat.unread_count) return false;
      if (!needle) return true;
      const name = [chat.participant?.sname, chat.participant?.fname, chat.participant?.mname].filter(Boolean).join(' ');
      return `${name} ${chat.last_message?.text ?? ''}`.toLowerCase().includes(needle);
    });
  }, [chats, query, onlyUnread]);

  const openChat = (participant, chatId = null) => {
    setNewChatVisible(false);
    navigation.navigate('Chat', {
      staffId: participant.id,
      staffName: fullName(participant),
      chatId,
    });
  };

  const s = styles(theme);

  const renderItem = ({ item }) => {
    const last = item.last_message;
    const unread = item.unread_count > 0;
    const typeIcon = last && last.type !== 'text' ? MESSAGE_TYPE_ICONS[last.type] : null;

    return (
      <Pressable
        style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
        onPress={() => item.participant && openChat(item.participant, item.chat_id)}
        accessibilityRole="button"
        accessibilityLabel={`Чат: ${fullName(item.participant)}${unread ? `, непрочитанных ${item.unread_count}` : ''}`}
      >
        <Avatar person={item.participant} id={item.participant?.id} size={52} />
        <View style={s.rowBody}>
          <View style={s.rowTop}>
            <Text style={s.name} numberOfLines={1}>{fullName(item.participant)}</Text>
            <Text style={[s.time, unread && { color: theme.accent }]}>{formatListTime(last?.created_at)}</Text>
          </View>
          <View style={s.rowBottom}>
            <View style={s.preview}>
              {last?.self ? (
                <Ionicons
                  name={last.read ? 'checkmark-done' : 'checkmark'}
                  size={16}
                  color={last.read ? theme.accent : theme.textMuted}
                  style={s.previewIcon}
                />
              ) : null}
              {typeIcon ? <Ionicons name={typeIcon} size={15} color={theme.textSecondary} style={s.previewIcon} /> : null}
              <Text style={s.previewText} numberOfLines={1}>{last?.text}</Text>
            </View>
            {unread ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Чаты</Text>
        <TouchableOpacity
          onPress={() => setNewChatVisible(true)}
          hitSlop={10}
          style={s.headerButton}
          accessibilityLabel="Новый чат"
        >
          <Ionicons name="create-outline" size={25} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Поиск"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={s.filters}>
        {[
          { key: false, label: 'Все' },
          { key: true, label: unreadChats ? `Непрочитанные ${unreadChats}` : 'Непрочитанные' },
        ].map((filter) => {
          const active = onlyUnread === filter.key;
          return (
            <TouchableOpacity
              key={String(filter.key)}
              onPress={() => setOnlyUnread(filter.key)}
              style={[s.chip, active && { backgroundColor: theme.accentSoft }]}
            >
              <Text style={[s.chipText, active && { color: theme.accentText, fontWeight: '600' }]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} size="large" color={theme.accent} />
      ) : (
        <FlatList
          data={visibleChats}
          keyExtractor={(item) => String(item.chat_id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={visibleChats.length ? null : s.emptyContainer}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadChats();
              }}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>
                {query || onlyUnread ? 'Ничего не нашли' : 'Начните первый чат'}
              </Text>
              {!query && !onlyUnread ? (
                <TouchableOpacity style={s.emptyButton} onPress={() => setNewChatVisible(true)}>
                  <Text style={s.emptyButtonText}>Новый чат</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      <NewChatModal
        visible={newChatVisible}
        onClose={() => setNewChatVisible(false)}
        onOpenChat={(person) => openChat(person)}
        onCall={(person) => {
          setNewChatVisible(false);
          initiateCall(person.id, fullName(person));
        }}
      />
    </View>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 30, fontWeight: '700', color: theme.text, letterSpacing: 0.2 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
  },
  searchInput: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 0 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.surfaceAlt },
  chipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  loader: { marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 12 },
  rowBody: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.text },
  time: { fontSize: 13, color: theme.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8, minHeight: 22 },
  preview: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  previewIcon: { marginRight: 3 },
  previewText: { flex: 1, fontSize: 15, color: theme.textSecondary },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: theme.onAccent, fontSize: 12, fontWeight: '700' },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  emptyButton: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.accent },
  emptyButtonText: { color: theme.onAccent, fontSize: 15, fontWeight: '600' },
});
