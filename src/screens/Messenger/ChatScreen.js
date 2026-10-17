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
  TextInput,
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
import { getDraft, setDraft } from '../../services/drafts';
import { isCallAudioActive } from '../../services/callAudioState';
import { AudioPlayerProvider } from '../../contexts/AudioPlayerContext';
import { useCallContext } from '../../contexts/CallContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../theme';
import { getUserFacingError } from '../../utils/userFacingError';
import {
  formatDateSeparator,
  formatLastSeen,
  formatListTime,
  fullName,
  isSameDay,
  mediaLabel,
  plural,
} from '../../utils/chatFormat';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { ChatBackground } from '../../components/chat/ChatBackground';
import { MessageBubble, normalizeMedia } from '../../components/chat/MessageBubble';
import { MessageActionsSheet } from '../../components/chat/MessageActionsSheet';
import { Composer } from '../../components/chat/Composer';
import { PollCreateModal } from '../../components/chat/PollCreateModal';
import { VideoViewer } from '../../components/chat/VideoViewer';
import { GlassView } from '../../components/ui/GlassView';

const PAGE_SIZE = 40;
const SYNC_INTERVAL_MS = 20000;
const INFO_INTERVAL_MS = 30000;
const TYPING_VISIBLE_MS = 5000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const HIGHLIGHT_MS = 1600;

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

/** Голос в опросе сразу на экране, до ответа сервера */
const applyVote = (message, staffId, options) => {
  const poll = message.poll;
  const id = Number(staffId);
  const nextOptions = poll.options.map((option, index) => {
    const voters = (option.voters || []).filter((voter) => Number(voter) !== id);
    return { ...option, voters: options.includes(index) ? [...voters, id] : voters };
  });
  const voters = new Set(nextOptions.flatMap((option) => option.voters.map(Number)));
  return { ...message, poll: { ...poll, options: nextOptions, total_voters: voters.size } };
};

export default function ChatScreen({ navigation, route }) {
  const params = route.params || {};
  const chatType = params.chatType || 'direct';
  const isDirect = chatType === 'direct';
  const isGroup = chatType === 'group';
  const isObject = chatType === 'object';
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initiateCall } = useCallContext();
  const { can } = usePermissions();

  const [chatId, setChatId] = useState(params.chatId ?? null);
  const [me, setMe] = useState({ staffId: null, userId: null });
  const [info, setInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [peerLastReadId, setPeerLastReadId] = useState(null);
  const [membersRead, setMembersRead] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [peerTyping, setPeerTyping] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newWhileAway, setNewWhileAway] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 56);
  const [composerHeight, setComposerHeight] = useState(64);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [pollVisible, setPollVisible] = useState(false);
  const [search, setSearch] = useState({ active: false, query: '', loading: false, results: [] });

  const listRef = useRef(null);
  const messagesRef = useRef([]);
  const focusedRef = useRef(false);
  const scrolledAwayRef = useRef(false);
  const markReadTimerRef = useRef(null);
  const lastMarkedRef = useRef(0);
  const syncingRef = useRef(false);
  // Открыто окно истории вокруг найденного сообщения: свежие сообщения ниже ещё не загружены
  const detachedRef = useRef(false);
  const textRef = useRef('');
  const pendingJumpRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    textRef.current = editing ? '' : text;
  }, [text, editing]);

  const title = info?.title || params.title || params.staffName || 'Чат';
  const headerChat = useMemo(() => ({
    type: chatType,
    chat_id: chatId,
    title,
    participant: info?.participant || (isDirect ? {
      id: params.staffId,
      sname: (params.staffName || '').split(' ')[0],
      fname: (params.staffName || '').split(' ')[1],
    } : null),
  }), [chatType, chatId, title, info, isDirect, params.staffId, params.staffName]);

  // --- Загрузка ---

  useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      const user = raw ? JSON.parse(raw) : null;
      setMe({ staffId: user?.staff_id ?? null, userId: user?.id ?? null });
    }).catch(() => {});
  }, []);

  const applyPage = useCallback((data) => {
    setPeerLastReadId(data.peer_last_read_id ?? null);
    if (data.members_read) setMembersRead(data.members_read);
  }, []);

  const loadLatest = useCallback(async (targetChatId, { replace = false } = {}) => {
    if (!targetChatId || syncingRef.current) return;
    // Пока открыто окно найденного сообщения, свежая страница его не заменяет
    if (!replace && detachedRef.current) return;
    syncingRef.current = true;
    try {
      const data = await messengerAPI.getMessagesPage(targetChatId, { limit: PAGE_SIZE });
      const page = data.messages || [];
      // Телефон долго был без связи, и новых больше страницы: между известными и свежими сообщениями
      // была бы дыра. Показываем свежую страницу заново, а более старые догрузит прокрутка вверх
      const newestKnown = messagesRef.current.reduce(
        (max, message) => (isServerId(message.id) && message.id > max ? message.id : max),
        0
      );
      const reset = replace || (data.has_more && newestKnown > 0 && page.length > 0 && page[0].id > newestKnown);
      applyPage(data);
      if (reset) {
        setHasMore(Boolean(data.has_more));
        setHasMoreNewer(false);
        detachedRef.current = false;
      }
      setMessages((current) => {
        if (reset) {
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
  }, [applyPage]);

  /** Окно истории вокруг сообщения: переход из поиска, к закреплённому или к цитате */
  const loadAround = useCallback(async (targetChatId, messageId) => {
    try {
      const data = await messengerAPI.getMessagesPage(targetChatId, { limit: PAGE_SIZE, aroundId: messageId });
      applyPage(data);
      setHasMore(Boolean(data.has_more));
      setHasMoreNewer(Boolean(data.has_more_newer));
      detachedRef.current = Boolean(data.has_more_newer);
      pendingJumpRef.current = messageId;
      setMessages((current) => mergeMessages(current.filter((message) => !isServerId(message.id)), data.messages || []));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось открыть сообщение', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setInitialLoading(false);
    }
  }, [applyPage]);

  const loadInfo = useCallback(async (targetChatId) => {
    if (!targetChatId) return;
    try {
      const data = await messengerAPI.getChatInfo(targetChatId);
      setInfo(data);
    } catch (error) {
      if (error?.response?.status === 404 && !isDirect) {
        Toast.show({ type: 'info', text1: 'Чат недоступен', text2: 'Вас исключили из группы или её удалили', position: 'top' });
        navigation.goBack();
      }
    }
  }, [isDirect, navigation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = chatId;
        if (!id) {
          const data = await messengerAPI.getOrCreateChat(params.staffId);
          id = data.chat_id;
          if (!cancelled) setChatId(id);
        }
        if (cancelled) return;
        loadInfo(id);
        const draft = await getDraft(id);
        if (!cancelled && draft && !textRef.current) setText(draft);
        if (params.focusMessageId) await loadAround(id, params.focusMessageId);
        else await loadLatest(id, { replace: true });
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
  }, [params.staffId, params.chatId]);

  // Черновик сохраняется при выходе из чата
  useEffect(() => () => {
    if (chatId) setDraft(chatId, textRef.current);
  }, [chatId]);

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

  const loadNewer = useCallback(async () => {
    if (!chatId || !hasMoreNewer || loadingNewer) return;
    const newest = [...messages].reverse().find((message) => isServerId(message.id));
    if (!newest) return;
    setLoadingNewer(true);
    try {
      const data = await messengerAPI.getMessagesPage(chatId, { limit: PAGE_SIZE, afterId: newest.id });
      setHasMoreNewer(Boolean(data.has_more_newer));
      detachedRef.current = Boolean(data.has_more_newer);
      setMessages((current) => mergeMessages(current, data.messages || []));
    } catch (error) {
      console.warn('[Chat] Не удалось загрузить новые:', error?.message ?? error);
    } finally {
      setLoadingNewer(false);
    }
  }, [chatId, hasMoreNewer, loadingNewer, messages]);

  // --- Прочтение ---

  const isMine = useCallback(
    (message) => (me.staffId ? Number(message.from_id) === Number(me.staffId) : Boolean(message.self)),
    [me.staffId]
  );

  const markRead = useCallback((list) => {
    if (!chatId || !focusedRef.current || AppState.currentState !== 'active') return;
    const lastFromOthers = [...list].reverse().find((message) => isServerId(message.id)
      && (me.staffId ? Number(message.from_id) !== Number(me.staffId) : !message.self));
    if (!lastFromOthers || lastFromOthers.id <= lastMarkedRef.current) return;

    clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(async () => {
      try {
        const data = await messengerAPI.markRead(chatId, lastFromOthers.id);
        lastMarkedRef.current = lastFromOthers.id;
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
      loadInfo(chatId);
    }

    const timer = setInterval(() => loadLatest(chatId), SYNC_INTERVAL_MS);
    const infoTimer = setInterval(() => loadInfo(chatId), INFO_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveChatId(chatId);
        loadLatest(chatId);
        loadInfo(chatId);
      } else {
        setActiveChatId(null);
        if (chatId) setDraft(chatId, textRef.current);
      }
    });

    return () => {
      focusedRef.current = false;
      setActiveChatId(null);
      clearInterval(timer);
      clearInterval(infoTimer);
      appState.remove();
    };
  }, [chatId, loadLatest, loadInfo]));

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
        if (name === 'message.created') {
          setPeerTyping(null);
          // В окне старой истории новое сообщение не вставляем — иначе была бы дыра; показываем счётчик
          if (detachedRef.current) {
            setNewWhileAway((count) => count + 1);
            return;
          }
          if (scrolledAwayRef.current) setNewWhileAway((count) => count + 1);
        }
        setMessages((current) => (name === 'message.updated' && !current.some((item) => item.id === data.message.id)
          ? current
          : mergeMessages(current, [data.message])));
      } else if (name === 'message.deleted') {
        setMessages((current) => current.filter((message) => message.id !== data.message_id));
      } else if (name === 'chat.read') {
        if (isGroup) setMembersRead((current) => ({ ...current, [data.reader_id]: Math.max(current[data.reader_id] ?? 0, data.last_read_id ?? 0) }));
        else setPeerLastReadId((current) => Math.max(current ?? 0, data.last_read_id ?? 0));
      } else if (name === 'chat.typing') {
        setPeerTyping({ name: data.name, until: Date.now() + TYPING_VISIBLE_MS });
      } else if (name === 'chat.pinned') {
        setInfo((current) => (current ? { ...current, pinned_messages: data.pinned_messages || [] } : current));
        const pinnedIds = new Set((data.pinned_messages || []).map((item) => item.id));
        setMessages((current) => current.map((message) => (Boolean(message.pinned) !== pinnedIds.has(message.id)
          ? { ...message, pinned: pinnedIds.has(message.id) }
          : message)));
      } else if (name === 'chat.updated') {
        loadInfo(chatId);
      }
    });
  }, [chatId, loadLatest, loadInfo, isGroup]);

  // «печатает…» гаснет само
  useEffect(() => {
    if (!peerTyping) return undefined;
    const timer = setTimeout(() => setPeerTyping(null), Math.max(0, peerTyping.until - Date.now()));
    return () => clearTimeout(timer);
  }, [peerTyping]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
      clearTimeout(markReadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!highlightId) return undefined;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  // --- Отправка ---

  const backToLatest = useCallback(async () => {
    if (detachedRef.current && chatId) {
      await loadLatest(chatId, { replace: true });
    }
    setNewWhileAway(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [chatId, loadLatest]);

  const sendPayload = useCallback(async (localId, payload) => {
    try {
      const saved = await messengerAPI.addMessage(chatId, payload.text, payload.replyToId, payload.files, { mentionIds: payload.mentionIds });
      setMessages((current) => mergeMessages(current.filter((message) => message.id !== localId), [saved]));
    } catch (error) {
      setMessages((current) => current.map((message) => (message.id === localId ? { ...message, _status: 'failed' } : message)));
      Toast.show({
        type: 'error',
        text1: 'Сообщение не отправлено',
        text2: error?.response?.status === 403 ? getUserFacingError(error, 'Нет прав') : 'Нажмите на него, чтобы повторить',
        position: 'top',
      });
    }
  }, [chatId]);

  const sendMessage = useCallback(async (messageText, files = [], { mentionIds = [] } = {}) => {
    if (!chatId) return;

    if (editing) {
      const trimmed = messageText.trim();
      if (!trimmed) return;
      const target = editing;
      setEditing(null);
      setText('');
      try {
        const saved = await messengerAPI.updateMessage(target.id, trimmed, chatId);
        setMessages((current) => mergeMessages(current, [saved]));
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Не удалось изменить', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
      }
      return;
    }

    if (!messageText.trim() && !files.length) return;
    if (detachedRef.current) await backToLatest();

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = { text: messageText.trim(), replyToId: replyTo?.id ?? null, files, mentionIds };
    const optimistic = {
      id: localId,
      localTime: Date.now(),
      chat_id: chatId,
      from_id: me.staffId,
      self: true,
      type: 'text',
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
    setDraft(chatId, '');
    setMessages((current) => sortById([...current, optimistic]));
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    await sendPayload(localId, payload);
  }, [chatId, editing, replyTo, me.staffId, sendPayload, backToLatest]);

  const sendVoice = useCallback((file) => sendMessage('', [file]), [sendMessage]);

  const retry = useCallback((message) => {
    if (!message._payload) return;
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, _status: 'sending' } : item)));
    sendPayload(message.id, message._payload);
  }, [sendPayload]);

  const notifyTyping = useCallback(() => {
    if (chatId) messengerAPI.typing(chatId).catch(() => {});
  }, [chatId]);

  const createPoll = useCallback(async (poll) => {
    try {
      const saved = await messengerAPI.addPoll(chatId, poll);
      if (detachedRef.current) await backToLatest();
      setMessages((current) => mergeMessages(current, [saved]));
      return true;
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось создать опрос', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
      return false;
    }
  }, [chatId, backToLatest]);

  const vote = useCallback(async (message, options) => {
    if (!me.staffId) return;
    const before = message;
    setMessages((current) => current.map((item) => (item.id === message.id ? applyVote(item, me.staffId, options) : item)));
    try {
      const data = await messengerAPI.votePoll(message.id, options);
      if (data?.message) setMessages((current) => mergeMessages(current, [data.message]));
    } catch (error) {
      setMessages((current) => current.map((item) => (item.id === message.id ? before : item)));
      Toast.show({ type: 'error', text1: 'Голос не учтён', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    }
  }, [me.staffId]);

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
      const data = await messengerAPI.addReaction(message.id, emoji, chatId);
      if (data?.reactions) {
        setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, reactions: data.reactions } : item)));
      }
    } catch (error) {
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, reactions: before } : item)));
      Toast.show({ type: 'error', text1: 'Не удалось поставить реакцию', position: 'top' });
    }
  }, [me.userId, chatId]);

  const deleteMessage = useCallback((message) => {
    setActionMessage(null);
    Alert.alert('Удалить сообщение?', isObject ? 'Комментарий удалится и из табеля.' : 'Сообщение удалится у всех участников чата.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const before = messages;
          setMessages((current) => current.filter((item) => item.id !== message.id));
          try {
            await messengerAPI.removeMessage(message.id, chatId);
          } catch (error) {
            setMessages(before);
            Toast.show({ type: 'error', text1: 'Не удалось удалить', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
          }
        },
      },
    ]);
  }, [messages, chatId, isObject]);

  const togglePin = useCallback(async (message) => {
    setActionMessage(null);
    const pinned = !message.pinned;
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, pinned } : item)));
    try {
      const data = await messengerAPI.pinMessage(chatId, message.id, pinned);
      setInfo((current) => (current ? { ...current, pinned_messages: data.pinned_messages || [] } : current));
      setPinnedIndex(0);
    } catch (error) {
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, pinned: !pinned } : item)));
      Toast.show({ type: 'error', text1: pinned ? 'Не удалось закрепить' : 'Не удалось открепить', position: 'top' });
    }
  }, [chatId]);

  const actions = useMemo(() => {
    if (!actionMessage) return [];
    const mine = isMine(actionMessage);
    const hasText = Boolean((actionMessage.message || '').trim());
    const serverMessage = isServerId(actionMessage.id);
    const list = [];
    if (serverMessage && info?.can_write !== false) {
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
    if (serverMessage) {
      list.push({
        key: 'pin',
        label: actionMessage.pinned ? 'Открепить' : 'Закрепить',
        icon: actionMessage.pinned ? 'pin-outline' : 'pin',
        onPress: () => togglePin(actionMessage),
      });
    }
    if (mine && hasText && serverMessage && actionMessage.type !== 'poll' && can('mobile-app-can-edit-comment:site')) {
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
    if (mine && serverMessage && can('mobile-app-can-delete-comment:site')) {
      list.push({ key: 'delete', label: 'Удалить', icon: 'trash-outline', destructive: true, onPress: () => deleteMessage(actionMessage) });
    }
    return list;
  }, [actionMessage, isMine, can, deleteMessage, togglePin, info]);

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

  // --- Лента: даты, системные сообщения, группы ---

  const items = useMemo(() => {
    const result = [];
    const othersRead = Math.max(0, ...Object.values(membersRead || {}).map((value) => Number(value) || 0));

    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      const newDay = !previous || !isSameDay(previous.created_at, message.created_at);
      if (newDay) result.push({ type: 'date', key: `date-${message.created_at}`, label: formatDateSeparator(message.created_at) });

      if (message.type === 'system') {
        result.push({ type: 'system', key: `system-${message.id}`, message });
        return;
      }

      const sameAuthor = (a, b) => a && b && a.type !== 'system' && b.type !== 'system'
        && isMine(a) === isMine(b) && Number(a.from_id) === Number(b.from_id)
        && Math.abs(new Date(b.created_at) - new Date(a.created_at)) < GROUP_WINDOW_MS
        && isSameDay(a.created_at, b.created_at);

      const mine = isMine(message);
      let status;
      if (mine) {
        if (message._status) status = message._status;
        else if (!isServerId(message.id) || isObject) status = 'sent';
        else if (isGroup) status = othersRead >= message.id ? 'read' : 'sent';
        else status = peerLastReadId != null && peerLastReadId >= message.id ? 'read' : 'sent';
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
  }, [messages, isMine, peerLastReadId, membersRead, isGroup, isObject]);

  const jumpToMessage = useCallback(async (messageId) => {
    const index = items.findIndex((item) => item.type === 'message' && item.message.id === messageId);
    if (index !== -1) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlightId(messageId);
      return;
    }
    if (chatId) await loadAround(chatId, messageId);
  }, [items, chatId, loadAround]);

  // Переход к сообщению из «Сведений о чате» (закреплённые): экран уже открыт, меняются только параметры
  const focusAtRef = useRef(params.focusAt);
  useEffect(() => {
    if (!params.focusAt || params.focusAt === focusAtRef.current) return;
    focusAtRef.current = params.focusAt;
    if (params.focusMessageId) jumpToMessage(params.focusMessageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focusAt]);

  // После загрузки окна истории — прокрутка к нужному сообщению и подсветка
  useEffect(() => {
    const target = pendingJumpRef.current;
    if (!target) return;
    const index = items.findIndex((item) => item.type === 'message' && item.message.id === target);
    if (index === -1) return;
    pendingJumpRef.current = null;
    setHighlightId(target);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }));
  }, [items]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateRow}>
          <Text style={[styles.dateChip, { backgroundColor: theme.dateChip, color: theme.dateChipText }]}>{item.label}</Text>
        </View>
      );
    }
    if (item.type === 'system') {
      return (
        <View style={styles.dateRow}>
          <Text style={[styles.systemChip, { backgroundColor: theme.dateChip, color: theme.dateChipText }]}>{item.message.message}</Text>
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
        myStaffId={me.staffId}
        chatType={chatType}
        highlighted={item.message.id === highlightId}
        theme={theme}
        onLongPress={(message) => setActionMessage({ ...message, isMine: item.mine })}
        onReply={(message) => { if (isServerId(message.id) && info?.can_write !== false) { setReplyTo(message); setEditing(null); } }}
        onReactionPress={toggleReaction}
        onOpenMedia={openMedia}
        onOpenDocument={openDocument}
        onQuotePress={jumpToMessage}
        onRetry={retry}
        onVote={vote}
      />
    );
  }, [theme, me.userId, me.staffId, chatType, highlightId, toggleReaction, openMedia, openDocument, jumpToMessage, retry, vote, info]);

  // --- Поиск в чате ---

  useEffect(() => {
    const query = search.query.trim();
    if (!search.active || query.length < 2 || !chatId) {
      setSearch((current) => (current.results.length || current.loading ? { ...current, results: [], loading: false } : current));
      return undefined;
    }
    let cancelled = false;
    setSearch((current) => ({ ...current, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const data = await messengerAPI.search(query, chatId);
        if (!cancelled) setSearch((current) => ({ ...current, loading: false, results: data.messages || [] }));
      } catch (error) {
        if (!cancelled) setSearch((current) => ({ ...current, loading: false, results: [] }));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search.active, search.query, chatId]);

  const closeSearch = () => setSearch({ active: false, query: '', loading: false, results: [] });

  // --- Заголовок ---

  const subtitle = (() => {
    if (peerTyping) return { text: isDirect ? 'печатает…' : `${peerTyping.name || 'Кто-то'} печатает…`, accent: true };
    if (isDirect) {
      const participant = info?.participant;
      if (!participant) return null;
      return { text: formatLastSeen(participant.online, participant.last_seen_at), accent: participant.online };
    }
    if (isGroup && info) {
      const count = info.members_count || 0;
      const online = info.online_count || 0;
      return { text: `${count} ${plural(count, 'участник', 'участника', 'участников')}${online ? `, ${online} в сети` : ''}` };
    }
    if (isObject) return { text: 'Чат объекта · комментарии табеля' };
    return null;
  })();

  const pinned = info?.pinned_messages || [];
  const currentPinned = pinned.length ? pinned[pinnedIndex % pinned.length] : null;

  const composerContext = editing
    ? { type: 'edit', title: 'Редактирование', text: editing.message }
    : replyTo
      ? {
        type: 'reply',
        title: `Ответ: ${isMine(replyTo) ? 'себе' : fullName(replyTo.from)}`,
        text: replyTo.message || mediaLabel(normalizeMedia(replyTo.media)[0]?.type) || (replyTo.type === 'poll' ? 'Опрос' : ''),
      }
      : null;

  const mentionCandidates = useMemo(
    () => (isGroup ? (info?.members || []).filter((member) => Number(member.id) !== Number(me.staffId)) : null),
    [isGroup, info, me.staffId]
  );

  const canWrite = info?.can_write !== false;
  const s = screenStyles(theme);

  return (
    <AudioPlayerProvider>
      <View style={s.container}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.flex}>
            <ChatBackground />

            {initialLoading ? (
              <ActivityIndicator style={[s.loader, { marginTop: headerHeight + 40 }]} size="large" color={theme.accent} />
            ) : (
              <FlatList
                ref={listRef}
                data={items}
                inverted
                keyExtractor={(item) => item.key}
                renderItem={renderItem}
                contentContainerStyle={{ paddingTop: composerHeight + 8, paddingBottom: headerHeight + 8 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onEndReached={loadOlder}
                onEndReachedThreshold={0.4}
                onScroll={(event) => {
                  const offset = event.nativeEvent.contentOffset.y;
                  if (offset < 120 && hasMoreNewer && !loadingNewer) loadNewer();
                  const away = offset > 320 || detachedRef.current;
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
                onScrollToIndexFailed={(failure) => {
                  listRef.current?.scrollToOffset({ offset: failure.averageItemLength * failure.index, animated: false });
                }}
                ListHeaderComponent={loadingNewer ? <ActivityIndicator style={s.olderLoader} color={theme.accent} /> : null}
                ListFooterComponent={loadingOlder ? <ActivityIndicator style={s.olderLoader} color={theme.accent} /> : null}
                ListEmptyComponent={(
                  <View style={s.empty}>
                    <Text style={[s.emptyText, { backgroundColor: theme.dateChip, color: theme.dateChipText }]}>
                      {isObject ? 'Комментариев к объекту пока нет' : 'Сообщений пока нет. Напишите первым'}
                    </Text>
                  </View>
                )}
              />
            )}

            {showScrollDown || hasMoreNewer ? (
              <Pressable style={[s.scrollDown, { bottom: composerHeight + 12 }]} onPress={backToLatest} accessibilityLabel="К последним сообщениям">
                <Ionicons name="chevron-down" size={24} color={theme.textSecondary} />
                {newWhileAway > 0 ? (
                  <View style={s.scrollDownBadge}>
                    <Text style={s.scrollDownBadgeText}>{newWhileAway}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <GlassView
              edge="top"
              style={[s.composerBar, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]}
              onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
            >
              {canWrite ? (
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
                  mentionCandidates={mentionCandidates}
                  onCreatePoll={isGroup ? () => setPollVisible(true) : null}
                  transparent
                />
              ) : (
                <Text style={s.readOnly}>Писать в чат объекта может сотрудник с правом комментировать в табеле</Text>
              )}
            </GlassView>
          </View>
        </KeyboardAvoidingView>

        <GlassView
          edge="bottom"
          style={[s.headerBar, { paddingTop: insets.top }]}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          {search.active ? (
            <View style={s.header}>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={theme.textMuted} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Поиск в чате"
                  placeholderTextColor={theme.textMuted}
                  value={search.query}
                  onChangeText={(query) => setSearch((current) => ({ ...current, query }))}
                  autoFocus
                  returnKeyType="search"
                />
              </View>
              <Pressable onPress={closeSearch} hitSlop={10}>
                <Text style={s.searchCancel}>Отмена</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.header}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
                <Ionicons name="chevron-back" size={28} color={theme.accent} />
              </Pressable>
              <Pressable
                style={s.headerMain}
                onPress={() => chatId && navigation.navigate('ChatInfo', { chatId, chatType, title })}
                accessibilityLabel={`${title}, сведения о чате`}
              >
                <ChatAvatar chat={headerChat} size={38} />
                <View style={s.headerBody}>
                  <Text style={s.headerName} numberOfLines={1}>{title}</Text>
                  {subtitle ? (
                    <Text style={[s.headerStatus, { color: subtitle.accent ? theme.accent : theme.textSecondary }]} numberOfLines={1}>
                      {subtitle.text}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => setSearch({ active: true, query: '', loading: false, results: [] })}
                hitSlop={8}
                style={s.headerAction}
                accessibilityLabel="Поиск в чате"
              >
                <Ionicons name="search-outline" size={22} color={theme.accent} />
              </Pressable>
              {isDirect ? (
                <Pressable
                  onPress={() => initiateCall(params.staffId ?? info?.participant?.id, title)}
                  hitSlop={8}
                  style={s.headerAction}
                  accessibilityLabel={`Позвонить: ${title}`}
                >
                  <Ionicons name="call-outline" size={23} color={theme.accent} />
                </Pressable>
              ) : null}
            </View>
          )}

          {!search.active && currentPinned ? (
            <Pressable
              style={s.pinned}
              onPress={() => {
                jumpToMessage(currentPinned.id);
                setPinnedIndex((index) => index + 1);
              }}
              accessibilityLabel="Перейти к закреплённому сообщению"
            >
              <View style={s.pinnedBars}>
                {pinned.slice(0, 4).map((item, index) => (
                  <View
                    key={item.id}
                    style={[s.pinnedBar, { backgroundColor: index === pinnedIndex % pinned.length ? theme.accent : theme.separator }]}
                  />
                ))}
              </View>
              <View style={s.pinnedBody}>
                <Text style={s.pinnedTitle} numberOfLines={1}>
                  {pinned.length > 1 ? `Закреплённое сообщение ${(pinnedIndex % pinned.length) + 1} из ${pinned.length}` : 'Закреплённое сообщение'}
                </Text>
                <Text style={s.pinnedText} numberOfLines={1}>
                  {currentPinned.from_name ? `${currentPinned.from_name}: ` : ''}
                  {currentPinned.text || mediaLabel(currentPinned.type) || 'Сообщение'}
                </Text>
              </View>
              <Ionicons name="pin" size={18} color={theme.textMuted} style={s.pinnedIcon} />
            </Pressable>
          ) : null}

          {search.active && search.query.trim().length >= 2 ? (
            <View style={s.searchResults}>
              {search.loading ? <ActivityIndicator style={s.searchLoader} color={theme.accent} /> : null}
              {!search.loading && !search.results.length ? <Text style={s.searchEmpty}>Ничего не нашли</Text> : null}
              {search.results.slice(0, 8).map((hit) => (
                <Pressable
                  key={hit.message_id}
                  style={({ pressed }) => [s.searchHit, pressed && { backgroundColor: theme.surfacePressed }]}
                  onPress={() => {
                    closeSearch();
                    Keyboard.dismiss();
                    jumpToMessage(hit.message_id);
                  }}
                >
                  <View style={s.searchHitTop}>
                    <Text style={s.searchHitName} numberOfLines={1}>{hit.from_name}</Text>
                    <Text style={s.searchHitTime}>{formatListTime(hit.created_at)}</Text>
                  </View>
                  <Text style={s.searchHitText} numberOfLines={2}>{hit.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </GlassView>

        <MessageActionsSheet
          visible={Boolean(actionMessage)}
          message={actionMessage}
          theme={theme}
          myUserId={me.userId}
          actions={actions}
          onReact={(emoji, hasReacted) => toggleReaction(actionMessage, emoji, hasReacted)}
          onClose={() => setActionMessage(null)}
        />

        <PollCreateModal visible={pollVisible} onClose={() => setPollVisible(false)} onCreate={createPoll} />

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
  dateRow: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 24 },
  dateChip: { fontSize: 13, fontWeight: '500', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  systemChip: { fontSize: 13, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
});

const screenStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.chatBackground },
  flex: { flex: 1 },
  headerBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 56,
  },
  back: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBody: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '600', color: theme.text },
  headerStatus: { fontSize: 13, marginTop: 1 },
  headerAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.glassBorder,
  },
  pinnedBars: { gap: 2, alignSelf: 'stretch', justifyContent: 'center' },
  pinnedBar: { width: 3, flex: 1, maxHeight: 34, borderRadius: 2 },
  pinnedBody: { flex: 1 },
  pinnedTitle: { fontSize: 13, fontWeight: '600', color: theme.accent },
  pinnedText: { fontSize: 14, color: theme.textSecondary, marginTop: 1 },
  pinnedIcon: { transform: [{ rotate: '45deg' }] },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
  },
  searchInput: { flex: 1, fontSize: 16, color: theme.text, paddingVertical: 0 },
  searchCancel: { fontSize: 16, color: theme.accent, paddingHorizontal: 8 },
  searchResults: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.glassBorder, maxHeight: 420 },
  searchLoader: { marginVertical: 14 },
  searchEmpty: { textAlign: 'center', color: theme.textSecondary, fontSize: 15, paddingVertical: 16 },
  searchHit: { paddingHorizontal: 16, paddingVertical: 9 },
  searchHitTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchHitName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.text },
  searchHitTime: { fontSize: 12, color: theme.textMuted },
  searchHitText: { fontSize: 14, color: theme.textSecondary, marginTop: 1 },
  composerBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  readOnly: { textAlign: 'center', color: theme.textSecondary, fontSize: 14, paddingHorizontal: 24, paddingVertical: 16 },
  loader: { alignSelf: 'center' },
  olderLoader: { marginVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, overflow: 'hidden', textAlign: 'center' },
  scrollDown: {
    position: 'absolute',
    right: 12,
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
