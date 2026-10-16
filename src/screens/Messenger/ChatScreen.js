import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ImageViewing from 'react-native-image-viewing';
import Toast from 'react-native-toast-message';
import { messengerAPI } from '../../services/api';
import { setActiveChatId, setTotalUnread, subscribeMessengerEvents } from '../../services/messengerStore';
import { isCallAudioActive } from '../../services/callAudioState';
import { AudioPlayerProvider } from '../../contexts/AudioPlayerContext';
import { useCallContext } from '../../contexts/CallContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../theme';
import { getUserFacingError } from '../../utils/userFacingError';
import { formatDateSeparator, fullName, isSameDay, mediaLabel } from '../../utils/chatFormat';
import { Avatar } from '../../components/chat/Avatar';
import { MessageBubble, normalizeMedia } from '../../components/chat/MessageBubble';
import { MessageActionsSheet } from '../../components/chat/MessageActionsSheet';
import { Composer } from '../../components/chat/Composer';
import { VideoViewer } from '../../components/chat/VideoViewer';

const PAGE_SIZE = 40;
const SYNC_INTERVAL_MS = 20000;
const TYPING_VISIBLE_MS = 5000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const isServerId = (id) => typeof id === 'number';

const sortById = (list) => [...list].sort((a, b) => {
  // Отправляемые (локальные) — всегда ниже серверных
  if (isServerId(a.id) && !isServerId(b.id)) return -1;
  if (!isServerId(a.id) && isServerId(b.id)) return 1;
  if (isServerId(a.id)) return a.id - b.id;
  return a.localTime - b.localTime;
});

/** Новые и обновлённые сообщения сервера поверх текущего списка; отправляемые локальные сохраняются */
const mergeMessages = (current, incoming) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return sortById([...byId.values()]);
};

const assetToMedia = (asset) => {
  const mime = asset.mimeType || '';
  let type = 'file';
  if (asset.type === 'image' || mime.startsWith('image/')) type = 'image';
  else if (asset.type === 'video' || mime.startsWith('video/')) type = 'video';
  else if (mime.startsWith('audio/')) type = 'audio';
  else if (/pdf|word|excel|sheet|presentation|text/.test(mime)) type = 'document';
  return { type, localUri: asset.uri, name: asset.name || asset.fileName || 'Файл', size: asset.size || asset.fileSize };
};

export default function ChatScreen({ navigation, route }) {
  const { staffId, staffName = 'Собеседник' } = route.params || {};
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initiateCall } = useCallContext();
  const { can } = usePermissions();

  const [chatId, setChatId] = useState(route.params?.chatId ?? null);
  const [me, setMe] = useState({ staffId: null, userId: null });
  const [messages, setMessages] = useState([]);
  const [peerLastReadId, setPeerLastReadId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [peerTypingUntil, setPeerTypingUntil] = useState(0);
  const [imageViewer, setImageViewer] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newWhileAway, setNewWhileAway] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(56);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const listRef = useRef(null);
  const focusedRef = useRef(false);
  const scrolledAwayRef = useRef(false);
  const markReadTimerRef = useRef(null);
  const lastMarkedRef = useRef(0);
  const syncingRef = useRef(false);

  const peerTyping = peerTypingUntil > Date.now();

  // --- Загрузка ---

  useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      const user = raw ? JSON.parse(raw) : null;
      setMe({ staffId: user?.staff_id ?? null, userId: user?.id ?? null });
    }).catch(() => {});
  }, []);

  const loadLatest = useCallback(async (targetChatId, { replace = false } = {}) => {
    if (!targetChatId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const data = await messengerAPI.getMessagesPage(targetChatId, { limit: PAGE_SIZE });
      const page = data.messages || [];
      setPeerLastReadId(data.peer_last_read_id ?? null);
      if (replace) setHasMore(Boolean(data.has_more));
      setMessages((current) => {
        if (replace) {
          return mergeMessages(current.filter((message) => !isServerId(message.id)), page);
        }
        // Удалённые собеседником: серверные сообщения внутри диапазона страницы, которых в ней больше нет
        const pageIds = new Set(page.map((message) => message.id));
        const minPageId = page.length ? page[0].id : Infinity;
        const kept = current.filter((message) => !isServerId(message.id) || message.id < minPageId || pageIds.has(message.id));
        return mergeMessages(kept, page);
      });
    } catch (error) {
      console.warn('[Chat] Не удалось обновить сообщения:', error?.message ?? error);
      if (replace) {
        Toast.show({
          type: 'error',
          text1: 'Не удалось загрузить чат',
          text2: getUserFacingError(error, 'Проверьте интернет и попробуйте ещё раз.'),
          position: 'top',
        });
      }
    } finally {
      syncingRef.current = false;
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = chatId;
        if (!id) {
          const data = await messengerAPI.getOrCreateChat(staffId);
          id = data.chat_id;
          if (!cancelled) setChatId(id);
        }
        if (!cancelled) await loadLatest(id, { replace: true });
      } catch (error) {
        if (cancelled) return;
        setInitialLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Не удалось открыть чат',
          text2: getUserFacingError(error, 'Попробуйте ещё раз.'),
          position: 'top',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !hasMore || loadingOlder) return;
    const oldest = messages.find((message) => isServerId(message.id));
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const data = await messengerAPI.getMessagesPage(chatId, { limit: PAGE_SIZE, beforeId: oldest.id });
      setHasMore(Boolean(data.has_more));
      setMessages((current) => mergeMessages(current, data.messages || []));
    } catch (error) {
      console.warn('[Chat] Не удалось загрузить историю:', error?.message ?? error);
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, hasMore, loadingOlder, messages]);

  // --- Прочтение ---

  const markRead = useCallback((list) => {
    if (!chatId || !focusedRef.current || AppState.currentState !== 'active') return;
    const lastFromPeer = [...list].reverse().find((message) => isServerId(message.id) && message.from_id !== me.staffId && !message.self);
    if (!lastFromPeer || lastFromPeer.id <= lastMarkedRef.current) return;

    clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(async () => {
      try {
        const data = await messengerAPI.markRead(chatId, lastFromPeer.id);
        lastMarkedRef.current = lastFromPeer.id;
        setTotalUnread(data.total_unread);
      } catch (error) {
        console.warn('[Chat] Не удалось отметить прочитанным:', error?.message ?? error);
      }
    }, 400);
  }, [chatId, me.staffId]);

  useEffect(() => {
    if (!scrolledAwayRef.current) markRead(messages);
  }, [messages, markRead]);

  // --- Экран в фокусе: активный чат, уведомления этого чата, запасная синхронизация ---

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    setActiveChatId(chatId);

    if (chatId) {
      // Уведомления этого чата в шторке больше не нужны
      Notifications.getPresentedNotificationsAsync()
        .then((list) => list
          .filter((item) => Number(item.request.content.data?.chat_id) === Number(chatId))
          .forEach((item) => Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})))
        .catch(() => {});
    }

    const timer = setInterval(() => loadLatest(chatId), SYNC_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveChatId(chatId);
        loadLatest(chatId);
      } else {
        setActiveChatId(null);
      }
    });

    return () => {
      focusedRef.current = false;
      setActiveChatId(null);
      clearInterval(timer);
      appState.remove();
    };
  }, [chatId, loadLatest]));

  // --- Реальное время ---

  useEffect(() => {
    if (!chatId) return undefined;
    return subscribeMessengerEvents((name, data) => {
      if (Number(data?.chat_id) !== Number(chatId)) return;

      if (name === 'message.created' || name === 'message.updated') {
        if (data.truncated || !data.message) {
          loadLatest(chatId);
          return;
        }
        setPeerTypingUntil(0);
        setMessages((current) => mergeMessages(current, [data.message]));
        if (name === 'message.created' && scrolledAwayRef.current) setNewWhileAway((count) => count + 1);
      } else if (name === 'message.deleted') {
        setMessages((current) => current.filter((message) => message.id !== data.message_id));
      } else if (name === 'chat.read') {
        setPeerLastReadId((current) => Math.max(current ?? 0, data.last_read_id ?? 0));
      } else if (name === 'chat.typing') {
        setPeerTypingUntil(Date.now() + TYPING_VISIBLE_MS);
      }
    });
  }, [chatId, loadLatest]);

  // «печатает…» гаснет само
  useEffect(() => {
    if (!peerTyping) return undefined;
    const timer = setTimeout(() => setPeerTypingUntil(0), Math.max(0, peerTypingUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [peerTyping, peerTypingUntil]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
      clearTimeout(markReadTimerRef.current);
    };
  }, []);

  // --- Отправка ---

  const isMine = useCallback((message) => (me.staffId ? message.from_id === me.staffId : Boolean(message.self)), [me.staffId]);

  const sendPayload = useCallback(async (localId, payload) => {
    try {
      const saved = await messengerAPI.addMessage(chatId, payload.text, payload.replyToId, payload.files);
      setMessages((current) => mergeMessages(current.filter((message) => message.id !== localId), [saved]));
    } catch (error) {
      setMessages((current) => current.map((message) => (message.id === localId ? { ...message, _status: 'failed' } : message)));
      Toast.show({
        type: 'error',
        text1: 'Сообщение не отправлено',
        text2: 'Нажмите на него, чтобы повторить',
        position: 'top',
      });
    }
  }, [chatId]);

  const sendMessage = useCallback(async (messageText, files = []) => {
    if (!chatId) return;

    if (editing) {
      const trimmed = messageText.trim();
      if (!trimmed) return;
      const target = editing;
      setEditing(null);
      setText('');
      try {
        const saved = await messengerAPI.updateMessage(target.id, trimmed);
        setMessages((current) => mergeMessages(current, [saved]));
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Не удалось изменить', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
      }
      return;
    }

    if (!messageText.trim() && !files.length) return;

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = { text: messageText.trim(), replyToId: replyTo?.id ?? null, files };
    const optimistic = {
      id: localId,
      localTime: Date.now(),
      chat_id: chatId,
      from_id: me.staffId,
      self: true,
      message: payload.text,
      media: files.length ? files.map(assetToMedia) : null,
      reply_to: replyTo
        ? { id: replyTo.id, from: replyTo.from, message: replyTo.message, type: normalizeMedia(replyTo.media)[0]?.type ?? 'text' }
        : null,
      reactions: [],
      created_at: new Date().toISOString(),
      _status: 'sending',
      _payload: payload,
    };

    setText('');
    setReplyTo(null);
    setMessages((current) => sortById([...current, optimistic]));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    await sendPayload(localId, payload);
  }, [chatId, editing, replyTo, me.staffId, sendPayload]);

  const sendVoice = useCallback((file) => sendMessage('', [file]), [sendMessage]);

  const retry = useCallback((message) => {
    if (!message._payload) return;
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, _status: 'sending' } : item)));
    sendPayload(message.id, message._payload);
  }, [sendPayload]);

  const notifyTyping = useCallback(() => {
    if (chatId) messengerAPI.typing(chatId).catch(() => {});
  }, [chatId]);

  // --- Действия с сообщением ---

  const toggleReaction = useCallback(async (message, emoji, hasReacted) => {
    setActionMessage(null);
    if (!isServerId(message.id) || !me.userId) return;
    const before = message.reactions || [];
    const optimistic = hasReacted
      ? before.filter((reaction) => !(Number(reaction.user_id) === Number(me.userId) && reaction.emoji === emoji))
      : [...before, { user_id: me.userId, emoji }];
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, reactions: optimistic } : item)));
    try {
      const data = await messengerAPI.addReaction(message.id, emoji);
      if (data?.reactions) {
        setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, reactions: data.reactions } : item)));
      }
    } catch (error) {
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, reactions: before } : item)));
      Toast.show({ type: 'error', text1: 'Не удалось поставить реакцию', position: 'top' });
    }
  }, [me.userId]);

  const deleteMessage = useCallback((message) => {
    setActionMessage(null);
    Alert.alert('Удалить сообщение?', 'Сообщение удалится у обоих собеседников.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const before = messages;
          setMessages((current) => current.filter((item) => item.id !== message.id));
          try {
            await messengerAPI.removeMessage(message.id);
          } catch (error) {
            setMessages(before);
            Toast.show({ type: 'error', text1: 'Не удалось удалить', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
          }
        },
      },
    ]);
  }, [messages]);

  const actions = useMemo(() => {
    if (!actionMessage) return [];
    const mine = isMine(actionMessage);
    const hasText = Boolean((actionMessage.message || '').trim());
    const list = [];
    if (isServerId(actionMessage.id)) {
      list.push({ key: 'reply', label: 'Ответить', icon: 'arrow-undo-outline', onPress: () => { setReplyTo(actionMessage); setEditing(null); setActionMessage(null); } });
    }
    if (hasText) {
      list.push({
        key: 'copy',
        label: 'Копировать',
        icon: 'copy-outline',
        onPress: async () => {
          setActionMessage(null);
          await Clipboard.setStringAsync(actionMessage.message);
          Toast.show({ type: 'success', text1: 'Скопировано', position: 'top', visibilityTime: 1500 });
        },
      });
    }
    if (mine && hasText && isServerId(actionMessage.id) && can('mobile-app-can-edit-comment:site')) {
      list.push({
        key: 'edit',
        label: 'Изменить',
        icon: 'create-outline',
        onPress: () => {
          setEditing(actionMessage);
          setReplyTo(null);
          setText(actionMessage.message || '');
          setActionMessage(null);
        },
      });
    }
    if (mine && isServerId(actionMessage.id) && can('mobile-app-can-delete-comment:site')) {
      list.push({ key: 'delete', label: 'Удалить', icon: 'trash-outline', destructive: true, onPress: () => deleteMessage(actionMessage) });
    }
    return list;
  }, [actionMessage, isMine, can, deleteMessage]);

  const openDocument = useCallback(async (file) => {
    try {
      Toast.show({ type: 'info', text1: 'Загрузка файла', text2: file.name, position: 'top', visibilityTime: 1500 });
      const downloadDir = new Directory(Paths.cache, 'downloads');
      if (!downloadDir.exists) downloadDir.create();
      const target = new File(downloadDir, file.name || file.uri.split('/').pop());
      if (target.exists) target.delete();
      const downloaded = await File.downloadFileAsync(file.uri, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось открыть файл', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    }
  }, []);

  const openMedia = useCallback((items, index) => {
    const item = items[index];
    if (item.type === 'video') {
      if (isCallAudioActive()) {
        Toast.show({ type: 'info', text1: 'Идёт звонок', text2: 'Видео можно посмотреть после звонка', position: 'top' });
        return;
      }
      setVideoUri(item.uri);
      return;
    }
    const images = items.filter((media) => media.type === 'image');
    setImageViewer({ images: images.map((media) => ({ uri: media.uri })), index: Math.max(0, images.indexOf(item)) });
  }, []);

  // --- Лента: даты и группы ---

  const items = useMemo(() => {
    const result = [];
    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      const newDay = !previous || !isSameDay(previous.created_at, message.created_at);
      if (newDay) result.push({ type: 'date', key: `date-${message.created_at}`, label: formatDateSeparator(message.created_at) });

      const sameAuthor = (a, b) => a && b && isMine(a) === isMine(b) && a.from_id === b.from_id
        && Math.abs(new Date(b.created_at) - new Date(a.created_at)) < GROUP_WINDOW_MS
        && isSameDay(a.created_at, b.created_at);

      const mine = isMine(message);
      let status;
      if (mine) {
        if (message._status) status = message._status;
        else status = peerLastReadId != null && isServerId(message.id) && peerLastReadId >= message.id ? 'read' : 'sent';
      }

      result.push({
        type: 'message',
        key: String(message.id),
        message,
        mine,
        status,
        isFirstInGroup: !sameAuthor(previous, message) || newDay,
        isLastInGroup: !sameAuthor(message, next),
      });
    });
    return result.reverse();
  }, [messages, isMine, peerLastReadId]);

  const scrollToMessage = useCallback((messageId) => {
    const index = items.findIndex((item) => item.type === 'message' && item.message.id === messageId);
    if (index === -1) {
      Toast.show({ type: 'info', text1: 'Сообщение выше в истории', text2: 'Прокрутите вверх, чтобы найти его', position: 'top' });
      return;
    }
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, [items]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateRow}>
          <Text style={[styles.dateChip, { backgroundColor: theme.dateChip, color: theme.dateChipText }]}>{item.label}</Text>
        </View>
      );
    }
    return (
      <MessageBubble
        message={item.message}
        isMine={item.mine}
        status={item.status}
        isFirstInGroup={item.isFirstInGroup}
        isLastInGroup={item.isLastInGroup}
        myUserId={me.userId}
        theme={theme}
        onLongPress={(message) => setActionMessage({ ...message, isMine: item.mine })}
        onReply={(message) => { if (isServerId(message.id)) { setReplyTo(message); setEditing(null); } }}
        onReactionPress={toggleReaction}
        onOpenMedia={openMedia}
        onOpenDocument={openDocument}
        onQuotePress={scrollToMessage}
        onRetry={retry}
      />
    );
  }, [theme, me.userId, toggleReaction, openMedia, openDocument, scrollToMessage, retry]);

  const composerContext = editing
    ? { type: 'edit', title: 'Редактирование', text: editing.message }
    : replyTo
      ? {
        type: 'reply',
        title: `Ответ: ${isMine(replyTo) ? 'себе' : fullName(replyTo.from)}`,
        text: replyTo.message || mediaLabel(normalizeMedia(replyTo.media)[0]?.type),
      }
      : null;

  const s = screenStyles(theme);

  return (
    <AudioPlayerProvider>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
            <Ionicons name="chevron-back" size={28} color={theme.accent} />
          </Pressable>
          <Avatar person={{ sname: staffName.split(' ')[0], fname: staffName.split(' ')[1] }} id={staffId} size={38} />
          <View style={s.headerBody}>
            <Text style={s.headerName} numberOfLines={1}>{staffName}</Text>
            {peerTyping ? <Text style={s.headerStatus}>печатает…</Text> : null}
          </View>
          <Pressable
            onPress={() => initiateCall(staffId, staffName)}
            hitSlop={10}
            style={s.headerAction}
            accessibilityLabel={`Позвонить: ${staffName}`}
          >
            <Ionicons name="call-outline" size={24} color={theme.accent} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + headerHeight : 0}
        >
          <View style={[s.flex, { backgroundColor: theme.chatBackground }]}>
            {initialLoading ? (
              <ActivityIndicator style={s.loader} size="large" color={theme.accent} />
            ) : (
              <FlatList
                ref={listRef}
                data={items}
                inverted
                keyExtractor={(item) => item.key}
                renderItem={renderItem}
                contentContainerStyle={s.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onEndReached={loadOlder}
                onEndReachedThreshold={0.4}
                onScroll={(event) => {
                  const away = event.nativeEvent.contentOffset.y > 320;
                  if (away !== scrolledAwayRef.current) {
                    scrolledAwayRef.current = away;
                    setShowScrollDown(away);
                    if (!away) {
                      setNewWhileAway(0);
                      markRead(messages);
                    }
                  }
                }}
                scrollEventThrottle={64}
                onScrollToIndexFailed={() => {}}
                ListFooterComponent={loadingOlder ? <ActivityIndicator style={s.olderLoader} color={theme.accent} /> : null}
                ListEmptyComponent={(
                  <View style={s.empty}>
                    <Text style={[s.emptyText, { backgroundColor: theme.dateChip, color: theme.dateChipText }]}>
                      Сообщений пока нет. Напишите первым
                    </Text>
                  </View>
                )}
              />
            )}

            {showScrollDown ? (
              <Pressable
                style={s.scrollDown}
                onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                accessibilityLabel="К последним сообщениям"
              >
                <Ionicons name="chevron-down" size={24} color={theme.textSecondary} />
                {newWhileAway > 0 ? (
                  <View style={s.scrollDownBadge}>
                    <Text style={s.scrollDownBadgeText}>{newWhileAway}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>

          <View style={{ paddingBottom: keyboardVisible ? 0 : insets.bottom, backgroundColor: theme.surface }}>
            <Composer
              theme={theme}
              value={text}
              onChangeText={setText}
              onSend={sendMessage}
              onSendVoice={sendVoice}
              context={composerContext}
              onCancelContext={() => {
                if (editing) setText('');
                setEditing(null);
                setReplyTo(null);
              }}
              onTyping={notifyTyping}
            />
          </View>
        </KeyboardAvoidingView>

        <MessageActionsSheet
          visible={Boolean(actionMessage)}
          message={actionMessage}
          theme={theme}
          myUserId={me.userId}
          actions={actions}
          onReact={(emoji, hasReacted) => toggleReaction(actionMessage, emoji, hasReacted)}
          onClose={() => setActionMessage(null)}
        />

        <ImageViewing
          images={imageViewer?.images ?? []}
          imageIndex={imageViewer?.index ?? 0}
          visible={Boolean(imageViewer)}
          onRequestClose={() => setImageViewer(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
        <VideoViewer uri={videoUri} onClose={() => setVideoUri(null)} />
      </View>
    </AudioPlayerProvider>
  );
}

const styles = StyleSheet.create({
  dateRow: { alignItems: 'center', marginVertical: 8 },
  dateChip: { fontSize: 13, fontWeight: '500', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});

const screenStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  back: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBody: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '600', color: theme.text },
  headerStatus: { fontSize: 13, color: theme.accent, marginTop: 1 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 60 },
  listContent: { paddingVertical: 10 },
  olderLoader: { marginVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, overflow: 'hidden', textAlign: 'center' },
  scrollDown: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  scrollDownBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollDownBadgeText: { color: theme.onAccent, fontSize: 11, fontWeight: '700' },
});
