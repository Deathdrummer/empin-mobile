import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Toast from 'react-native-toast-message';
import { messengerAPI } from '../../services/api';
import { setTotalUnread, subscribeMessengerEvents } from '../../services/messengerStore';
import { useDrafts } from '../../services/drafts';
import { useCallContext } from '../../contexts/CallContext';
import { useAfterModalClose } from '../../hooks/useAfterModalClose';
import { useTheme } from '../../theme';
import { useTabBarHeight } from '../../components/TabBar';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { TypingDots } from '../../components/chat/TypingDots';
import { PinIcon } from '../../components/chat/PinIcon';
import { formatListTime, fullName, plural } from '../../utils/chatFormat';
import NewChatModal from './NewChatModal';

// Запасное обновление, если Pusher недоступен: события реального времени обновляют список сразу
const FALLBACK_REFRESH_MS = 30000;
const TYPING_VISIBLE_MS = 5000;
const SEARCH_DELAY_MS = 350;

const FOLDERS = [
  { key: 'all', label: 'Все' },
  { key: 'object', label: 'Объекты' },
  { key: 'no-objects', label: 'Все, кроме объектов' },
  { key: 'direct', label: 'Личные' },
  { key: 'group', label: 'Группы' },
  { key: 'unread', label: 'Непрочитанные' },
];

const MESSAGE_TYPE_ICONS = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'mic-outline',
  document: 'document-text-outline',
  archive: 'archive-outline',
  file: 'attach-outline',
  poll: 'stats-chart-outline',
};

/** Параметры экрана переписки для элемента списка или результата поиска */
export const chatRouteParams = (chat) => (chat.type === 'direct'
  ? { chatType: 'direct', chatId: chat.chat_id, staffId: chat.participant?.id, staffName: fullName(chat.participant) }
  : { chatType: chat.type, chatId: chat.chat_id, title: chat.title });

export default function ChatsTab() {
  const theme = useTheme();
  const navigation = useNavigation();
  const tabBarHeight = useTabBarHeight();
  const { initiateCall } = useCallContext();
  const drafts = useDrafts();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [newChatVisible, setNewChatVisible] = useState(false);
  const { closeThen: closeNewChatThen, onDismiss: onNewChatDismiss } = useAfterModalClose();
  const [typing, setTyping] = useState({});
  const [search, setSearch] = useState({ loading: false, chats: [], messages: [] });
  const loadingRef = useRef(false);
  const reloadTimerRef = useRef(null);
  const openRowRef = useRef(null);

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
    const unsubscribe = subscribeMessengerEvents((name, data) => {
      if (name === 'chat.typing') {
        const chatId = Number(data?.chat_id);
        setTyping((current) => ({ ...current, [chatId]: { name: data?.name, until: Date.now() + TYPING_VISIBLE_MS } }));
        return;
      }
      if (name === 'chat.pinned') return;
      if (name === 'message.created') {
        const chatId = Number(data?.chat_id);
        setTyping((current) => {
          if (!current[chatId]) return current;
          const next = { ...current };
          delete next[chatId];
          return next;
        });
      }
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

  // «печатает…» гаснет само
  useEffect(() => {
    const active = Object.values(typing);
    if (!active.length) return undefined;
    const nextExpiry = Math.min(...active.map((item) => item.until));
    const timer = setTimeout(() => {
      const now = Date.now();
      setTyping((current) => Object.fromEntries(Object.entries(current).filter(([, item]) => item.until > now)));
    }, Math.max(0, nextExpiry - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [typing]);

  // Поиск по сообщениям, группам и объектам — на сервере, с задержкой на ввод
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSearch({ loading: false, chats: [], messages: [] });
      return undefined;
    }
    setSearch((current) => ({ ...current, loading: true }));
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await messengerAPI.search(trimmedQuery);
        if (!cancelled) setSearch({ loading: false, chats: data.chats || [], messages: data.messages || [] });
      } catch (error) {
        if (!cancelled) setSearch({ loading: false, chats: [], messages: [] });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const unreadChats = useMemo(() => chats.filter((chat) => chat.unread_count > 0).length, [chats]);

  const visibleChats = useMemo(() => chats.filter((chat) => {
    if (folder === 'all') return true;
    if (folder === 'unread') return chat.unread_count > 0 || chat.mentioned;
    if (folder === 'no-objects') return chat.type !== 'object';
    return chat.type === folder;
  }), [chats, folder]);

  const localMatches = useMemo(() => {
    if (trimmedQuery.length < 1) return [];
    const needle = trimmedQuery.toLowerCase();
    return chats.filter((chat) => {
      const extra = chat.participant ? [chat.participant.mname] : [];
      return [chat.title, ...extra].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [chats, trimmedQuery]);

  const openChat = (params) => {
    setNewChatVisible(false);
    navigation.navigate('Chat', params);
  };

  const openSearchChat = async (item) => {
    if (item.type === 'group') {
      openChat({ chatType: 'group', chatId: item.chat_id, title: item.title });
      return;
    }
    try {
      const data = await messengerAPI.openObjectChat(item.contract_id);
      openChat({ chatType: 'object', chatId: data.chat_id, title: item.title });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось открыть объект', position: 'top' });
    }
  };

  const openSearchMessage = (hit) => {
    const known = chats.find((chat) => chat.chat_id === hit.chat_id);
    const base = known ? chatRouteParams(known) : (hit.chat_type === 'direct'
      ? { chatType: 'direct', chatId: hit.chat_id, staffId: hit.peer_id, staffName: hit.chat_title }
      : { chatType: hit.chat_type, chatId: hit.chat_id, title: hit.chat_title });
    openChat({ ...base, focusMessageId: hit.message_id });
  };

  // --- Действия свайпа: прочитано, без звука, закрепить ---

  const updateChat = (chatId, patch) => setChats((current) => current.map((chat) => (chat.chat_id === chatId ? { ...chat, ...patch } : chat)));

  const runAction = async (chat, action) => {
    openRowRef.current?.close();
    Haptics.selectionAsync().catch(() => {});
    try {
      if (action === 'read') {
        updateChat(chat.chat_id, { unread_count: 0, mentioned: false });
        const data = await messengerAPI.markRead(chat.chat_id, chat.last_message?.id ?? 0);
        setTotalUnread(data.total_unread);
      } else if (action === 'mute') {
        updateChat(chat.chat_id, { muted: !chat.muted });
        const data = await messengerAPI.muteChat(chat.chat_id, !chat.muted);
        setTotalUnread(data.total_unread);
      } else if (action === 'pin') {
        updateChat(chat.chat_id, { pinned: !chat.pinned });
        await messengerAPI.pinChat(chat.chat_id, !chat.pinned);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не получилось', text2: 'Проверьте интернет и попробуйте ещё раз', position: 'top' });
    }
    loadChats();
  };

  const s = styles(theme);

  const renderActions = (chat) => (
    <View style={s.actions}>
      {chat.unread_count > 0 ? (
        <Pressable style={[s.action, { backgroundColor: '#5B6B8C' }]} onPress={() => runAction(chat, 'read')}>
          <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
          <Text style={s.actionText}>Прочитано</Text>
        </Pressable>
      ) : null}
      <Pressable style={[s.action, { backgroundColor: '#8A8D94' }]} onPress={() => runAction(chat, 'mute')}>
        <Ionicons name={chat.muted ? 'volume-high' : 'volume-mute'} size={22} color="#FFFFFF" />
        <Text style={s.actionText}>{chat.muted ? 'Со звуком' : 'Без звука'}</Text>
      </Pressable>
      <Pressable style={[s.action, { backgroundColor: theme.accent }]} onPress={() => runAction(chat, 'pin')}>
        <PinIcon variant={chat.pinned ? 'off' : 'pin'} size={24} color="#FFFFFF" />
        <Text style={s.actionText}>{chat.pinned ? 'Открепить' : 'Закрепить'}</Text>
      </Pressable>
    </View>
  );

  const renderPreview = (chat) => {
    const typingNow = typing[chat.chat_id];
    if (typingNow && typingNow.until > Date.now()) {
      return (
        <View style={s.preview}>
          <TypingDots color={theme.accent} />
          <Text style={[s.previewText, { color: theme.accent }]} numberOfLines={1}>
            {chat.type === 'direct' ? 'печатает…' : `${typingNow.name || 'Кто-то'} печатает…`}
          </Text>
        </View>
      );
    }

    const draft = drafts[chat.chat_id];
    if (draft) {
      return (
        <Text style={s.previewText} numberOfLines={1}>
          <Text style={{ color: theme.accent }}>Черновик: </Text>
          {draft.replace(/\s+/g, ' ')}
        </Text>
      );
    }

    const last = chat.last_message;
    if (!last) {
      return <Text style={s.previewText} numberOfLines={1}>{chat.type === 'group' ? 'Группа создана' : ''}</Text>;
    }

    const typeIcon = last.type !== 'text' && last.type !== 'system' ? MESSAGE_TYPE_ICONS[last.type] : null;
    const author = chat.type !== 'direct' && last.type !== 'system'
      ? (last.self ? 'Вы' : last.from_name)
      : null;

    return (
      <View style={s.preview}>
        {last.self && chat.type !== 'object' && last.type !== 'system' ? (
          <Ionicons
            name={last.read ? 'checkmark-done' : 'checkmark'}
            size={16}
            color={last.read ? theme.accent : theme.textMuted}
            style={s.previewIcon}
          />
        ) : null}
        <Text style={s.previewText} numberOfLines={1}>
          {author ? <Text style={{ color: theme.text }}>{`${author}: `}</Text> : null}
          {typeIcon ? <Ionicons name={typeIcon} size={14} color={theme.textSecondary} /> : null}
          {typeIcon ? ' ' : ''}
          {last.text}
        </Text>
      </View>
    );
  };

  const renderChat = ({ item }) => {
    const unread = item.unread_count > 0;
    let rowRef = null;

    return (
      <ReanimatedSwipeable
        ref={(ref) => { rowRef = ref; }}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => renderActions(item)}
        onSwipeableWillOpen={() => {
          if (openRowRef.current && openRowRef.current !== rowRef) openRowRef.current.close();
          openRowRef.current = rowRef;
        }}
      >
        <Pressable
          style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
          onPress={() => openChat(chatRouteParams(item))}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}${unread ? `, непрочитанных ${item.unread_count}` : ''}`}
        >
          <ChatAvatar chat={item} size={54} />
          <View style={s.rowBody}>
            <View style={s.rowTop}>
              <Text style={s.name} numberOfLines={1}>{item.title}</Text>
              {item.muted ? <Ionicons name="volume-mute" size={14} color={theme.textMuted} /> : null}
              <Text style={[s.time, unread && !item.muted && { color: theme.accent }]}>
                {formatListTime(item.last_message?.created_at ?? item.activity_at)}
              </Text>
            </View>
            <View style={s.rowBottom}>
              <View style={s.previewBox}>{renderPreview(item)}</View>
              {item.mentioned ? (
                <View style={[s.badge, s.mention]}>
                  <Text style={s.badgeText}>@</Text>
                </View>
              ) : null}
              {unread ? (
                <View style={[s.badge, { backgroundColor: item.muted ? theme.textMuted : theme.accent }]}>
                  <Text style={s.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                </View>
              ) : item.pinned ? (
                <PinIcon size={16} color={theme.textMuted} style={s.pin} />
              ) : null}
            </View>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  const renderSearch = () => {
    const sections = [];
    if (localMatches.length) sections.push({ key: 'local', title: 'Чаты', data: localMatches.map((chat) => ({ kind: 'chat', chat })) });
    const serverChats = search.chats.filter((item) => item.type === 'object' || !localMatches.some((chat) => chat.chat_id === item.chat_id));
    if (serverChats.length) sections.push({ key: 'server', title: 'Группы и объекты', data: serverChats.map((item) => ({ kind: 'found', item })) });
    if (search.messages.length) sections.push({ key: 'messages', title: 'Сообщения', data: search.messages.map((hit) => ({ kind: 'message', hit })) });

    return (
      <SectionList
        sections={sections}
        keyExtractor={(row, index) => `${row.kind}-${row.chat?.chat_id ?? row.item?.chat_id ?? row.item?.contract_id ?? row.hit?.message_id}-${index}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
        renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        renderItem={({ item: row }) => {
          if (row.kind === 'chat') return renderChat({ item: row.chat });
          if (row.kind === 'found') {
            const chat = { type: row.item.type, chat_id: row.item.chat_id ?? row.item.contract_id, title: row.item.title };
            return (
              <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]} onPress={() => openSearchChat(row.item)}>
                <ChatAvatar chat={chat} size={44} />
                <View style={s.rowBody}>
                  <Text style={s.name} numberOfLines={1}>{row.item.title}</Text>
                  <Text style={s.previewText}>{row.item.type === 'object' ? 'Чат объекта' : 'Группа'}</Text>
                </View>
              </Pressable>
            );
          }
          const { hit } = row;
          return (
            <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]} onPress={() => openSearchMessage(hit)}>
              <ChatAvatar chat={{ type: hit.chat_type, chat_id: hit.chat_id, title: hit.chat_title, participant: hit.peer_id ? { id: hit.peer_id, sname: hit.chat_title.split(' ')[0], fname: hit.chat_title.split(' ')[1] } : null }} size={44} showOnline={false} />
              <View style={s.rowBody}>
                <View style={s.rowTop}>
                  <Text style={s.name} numberOfLines={1}>{hit.chat_title}</Text>
                  <Text style={s.time}>{formatListTime(hit.created_at)}</Text>
                </View>
                <Text style={s.previewText} numberOfLines={2}>
                  <Text style={{ color: theme.text }}>{`${hit.from_name}: `}</Text>
                  {hit.text}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={(
          <View style={s.empty}>
            {search.loading ? <ActivityIndicator color={theme.accent} /> : (
              <>
                <Ionicons name="search" size={48} color={theme.textMuted} />
                <Text style={s.emptyTitle}>{trimmedQuery.length < 2 ? 'Введите хотя бы 2 буквы' : 'Ничего не нашли'}</Text>
              </>
            )}
          </View>
        )}
        ListFooterComponent={search.loading && sections.length ? <ActivityIndicator style={s.searchLoader} color={theme.accent} /> : null}
      />
    );
  };

  const emptyTitle = {
    all: 'Начните первый чат',
    unread: 'Всё прочитано',
    direct: 'Личных чатов пока нет',
    group: 'Групп пока нет',
    object: 'Здесь появятся объекты вашей бригады',
    'no-objects': 'Начните первый чат',
  }[folder];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Чаты</Text>
        <TouchableOpacity
          onPress={() => setNewChatVisible(true)}
          hitSlop={10}
          style={s.headerButton}
          accessibilityLabel="Новый чат или группа"
        >
          <Ionicons name="create-outline" size={25} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Поиск по чатам и сообщениям"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Очистить поиск">
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {trimmedQuery ? renderSearch() : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.foldersScroll} contentContainerStyle={s.folders}>
            {FOLDERS.map((item) => {
              const active = folder === item.key;
              const label = item.key === 'unread' && unreadChats ? `${item.label} ${unreadChats}` : item.label;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setFolder(item.key)}
                  style={[s.chip, active && { backgroundColor: theme.accentSoft }]}
                >
                  <Text style={[s.chipText, active && { color: theme.accentText, fontWeight: '600' }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <ActivityIndicator style={s.loader} size="large" color={theme.accent} />
          ) : (
            <FlatList
              data={visibleChats}
              keyExtractor={(item) => String(item.chat_id)}
              renderItem={renderChat}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[visibleChats.length ? null : s.emptyContainer, { paddingBottom: tabBarHeight + 12 }]}
              onScrollBeginDrag={() => openRowRef.current?.close()}
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
                  <Ionicons
                    name={folder === 'object' ? 'flash-outline' : folder === 'group' ? 'people-outline' : 'chatbubbles-outline'}
                    size={56}
                    color={theme.textMuted}
                  />
                  <Text style={s.emptyTitle}>{emptyTitle}</Text>
                  {folder === 'object' ? (
                    <Text style={s.emptyText}>
                      Объект появится здесь, когда его поставят вашей бригаде в табеле. Найти любой объект можно поиском по номеру.
                    </Text>
                  ) : null}
                  {folder === 'all' || folder === 'no-objects' || folder === 'direct' || folder === 'group' ? (
                    <TouchableOpacity style={s.emptyButton} onPress={() => setNewChatVisible(true)}>
                      <Text style={s.emptyButtonText}>{folder === 'group' ? 'Новая группа' : 'Новый чат'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              ListFooterComponent={visibleChats.length ? (
                <Text style={s.footer}>
                  {`${visibleChats.length} ${plural(visibleChats.length, 'чат', 'чата', 'чатов')} · смахните влево — закрепить или без звука`}
                </Text>
              ) : null}
            />
          )}
        </>
      )}

      <NewChatModal
        visible={newChatVisible}
        onClose={() => setNewChatVisible(false)}
        onOpenChat={(person) => openChat({ chatType: 'direct', staffId: person.id, staffName: fullName(person) })}
        onGroupCreated={(group) => openChat({ chatType: 'group', chatId: group.chatId, title: group.title })}
        // Экран звонка — после закрытия окна (на iOS иначе он не появится, см. useAfterModalClose)
        onCall={(person) => closeNewChatThen(
          () => setNewChatVisible(false),
          () => initiateCall(person.id, fullName(person), person.avatar),
        )}
        onDismiss={onNewChatDismiss}
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
  // flexShrink: 0 — иначе на маленьком экране длинный список чатов сжимает строку вкладок (ScrollView по умолчанию сжимается)
  foldersScroll: { flexGrow: 0, flexShrink: 0 },
  folders: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.surfaceAlt },
  chipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  loader: { marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 12, backgroundColor: theme.background },
  rowBody: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.text },
  time: { fontSize: 13, color: theme.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6, minHeight: 22 },
  previewBox: { flex: 1 },
  preview: { flexDirection: 'row', alignItems: 'center' },
  previewIcon: { marginRight: 3 },
  previewText: { flexShrink: 1, fontSize: 15, color: theme.textSecondary },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mention: { backgroundColor: theme.accent },
  badgeText: { color: theme.onAccent, fontSize: 12, fontWeight: '700' },
  pin: { marginLeft: 2 },
  actions: { flexDirection: 'row' },
  action: { width: 78, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  searchLoader: { marginVertical: 16 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 70, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.text, textAlign: 'center' },
  emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  emptyButton: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.accent },
  emptyButtonText: { color: theme.onAccent, fontSize: 15, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12, color: theme.textMuted, paddingVertical: 14, paddingHorizontal: 24 },
});
