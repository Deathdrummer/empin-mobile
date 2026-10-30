import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import ImageViewing from 'react-native-image-viewing';
import Toast from 'react-native-toast-message';
import { messengerAPI } from '../../services/api';
import { openDocument } from '../../services/openDocument';
import { shareMediaItem } from '../../services/messageShare';
import { AudioPlayerProvider } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../theme';
import { normalizeMedia } from '../../components/chat/MessageBubble';
import { CachedImage, cachedFileUri } from '../../components/ui/CachedImage';
import { VideoViewer } from '../../components/chat/VideoViewer';
import { ViewerHeader } from '../../components/chat/ViewerHeader';
import { VoiceMessage } from '../../components/chat/VoiceMessage';
import { formatDateSeparator, formatFileSize, formatMessageTime, formatMonthTitle } from '../../utils/chatFormat';
import { linkHref } from '../../utils/richText';
import { getUserFacingError } from '../../utils/userFacingError';

const TABS = [
  { key: 'media', label: 'Медиа', empty: 'Фото и видео из этого чата появятся здесь' },
  { key: 'files', label: 'Файлы', empty: 'Документы и файлы из этого чата появятся здесь' },
  { key: 'voice', label: 'Голосовые', empty: 'Голосовые сообщения из этого чата появятся здесь' },
  { key: 'links', label: 'Ссылки', empty: 'Ссылки из сообщений этого чата появятся здесь' },
];
const COLUMNS = 3;
const GAP = 2;
const PAGE = 60;

const monthKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}`;
};

/** Разделы по месяцам; для медиа — строки по три плитки */
const toSections = (items, kind) => {
  const sections = [];
  items.forEach((item) => {
    const key = monthKey(item.created_at);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, title: formatMonthTitle(item.created_at), items: [] };
      sections.push(section);
    }
    section.items.push(item);
  });
  return sections.map((section) => ({
    ...section,
    data: kind === 'media'
      ? Array.from({ length: Math.ceil(section.items.length / COLUMNS) }, (_, row) => section.items.slice(row * COLUMNS, row * COLUMNS + COLUMNS))
      : section.items,
  }));
};

const linkHost = (url) => linkHref(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];

/**
 * «Медиа, файлы и ссылки» чата — как раздел в сведениях о чате Telegram: фото и видео сеткой, файлы,
 * голосовые и ссылки по месяцам, от новых к старым. Долгое нажатие — «Показать в чате».
 */
export default function ChatMediaScreen({ navigation, route }) {
  const { chatId, chatType, title } = route.params || {};
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('media');
  const [state, setState] = useState({});
  const [imageViewer, setImageViewer] = useState(null);
  const [video, setVideo] = useState(null);
  const loadingRef = useRef({});
  const s = styles(theme);
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const current = state[tab] || { items: [], nextBeforeId: undefined, loading: true };

  const load = useCallback(async (kind, { more = false } = {}) => {
    const known = state[kind];
    if (loadingRef.current[kind]) return;
    if (more && (!known || !known.nextBeforeId)) return;
    loadingRef.current[kind] = true;
    setState((prev) => ({ ...prev, [kind]: { ...(prev[kind] || { items: [] }), loading: true, error: null } }));
    try {
      const data = await messengerAPI.getChatMedia(chatId, kind, more ? known.nextBeforeId : undefined, PAGE);
      const items = (data.items || []).map((item) => (item.media ? { ...item, media: normalizeMedia([item.media])[0] } : item));
      setState((prev) => ({
        ...prev,
        [kind]: {
          items: more ? [...(prev[kind]?.items || []), ...items] : items,
          nextBeforeId: data.next_before_id ?? null,
          loading: false,
        },
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, [kind]: { ...(prev[kind] || { items: [] }), loading: false, error: getUserFacingError(error, 'Попробуйте ещё раз.') } }));
    } finally {
      loadingRef.current[kind] = false;
    }
  }, [chatId, state]);

  useEffect(() => {
    if (!state[tab]) load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const sections = useMemo(() => toSections(current.items, tab), [current.items, tab]);

  // Возврат в переписку с переходом к сообщению
  const showInChat = useCallback((messageId) => {
    navigation.popTo('Chat', { chatId, chatType, title, focusMessageId: messageId, focusAt: Date.now() }, { merge: true });
  }, [navigation, chatId, chatType, title]);

  const itemMenu = useCallback((item, extra = []) => {
    Haptics.selectionAsync().catch(() => {});
    const from = [item.from?.name, formatDateSeparator(item.created_at)].filter(Boolean).join(', ');
    Alert.alert(from || 'Сообщение', undefined, [
      ...extra,
      { text: 'Показать в чате', onPress: () => showInChat(item.message_id) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }, [showInChat]);

  const openMediaItem = useCallback(async (item) => {
    if (item.media.type === 'video') {
      setVideo(item);
      return;
    }
    // Все загруженные фото листаются свайпом, как в Telegram
    const images = current.items.filter((entry) => entry.media.type === 'image');
    const uris = await Promise.all(images.map((entry) => cachedFileUri(entry.media.uri)));
    setImageViewer({ images: uris.map((uri) => ({ uri })), items: images, index: Math.max(0, images.indexOf(item)) });
  }, [current.items]);

  const renderMediaRow = (row) => (
    <View style={s.gridRow}>
      {row.map((item) => (
        <Pressable
          key={`${item.message_id}-${item.media.uri}`}
          onPress={() => openMediaItem(item)}
          onLongPress={() => itemMenu(item, [{ text: 'Поделиться', onPress: () => shareMediaItem(item.media) }])}
          delayLongPress={280}
          style={[s.tile, { width: tile, height: tile }]}
          accessibilityLabel={item.media.type === 'video' ? 'Видео' : 'Фото'}
        >
          {item.media.type === 'video' ? (
            <>
              {item.media.thumbnailUri ? <CachedImage uri={item.media.thumbnailUri} style={{ width: tile, height: tile }} /> : null}
              <View style={s.videoBadge}>
                <Ionicons name="play" size={12} color="#FFFFFF" />
              </View>
            </>
          ) : (
            <CachedImage uri={item.media.uri} style={{ width: tile, height: tile }} transition={0} />
          )}
        </Pressable>
      ))}
    </View>
  );

  const renderFile = (item) => {
    const extension = (item.media.name || '').split('.').pop().toUpperCase();
    return (
      <Pressable
        style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
        onPress={() => openDocument(item.media)}
        onLongPress={() => itemMenu(item, [{ text: 'Поделиться', onPress: () => shareMediaItem(item.media) }])}
        delayLongPress={280}
      >
        <View style={[s.fileIcon, { backgroundColor: theme.accent }]}>
          <Text style={s.fileExt} numberOfLines={1}>{extension.slice(0, 4) || 'ФАЙЛ'}</Text>
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={2}>{item.media.name || 'Файл'}</Text>
          <Text style={s.rowSub} numberOfLines={1}>
            {[formatFileSize(item.media.size), item.from?.name, `${formatDateSeparator(item.created_at)} ${formatMessageTime(item.created_at)}`].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderVoice = (item) => (
    <Pressable
      style={s.row}
      onLongPress={() => itemMenu(item)}
      delayLongPress={280}
    >
      <View style={s.rowBody}>
        <Text style={s.rowSub} numberOfLines={1}>
          {[item.from?.name, `${formatDateSeparator(item.created_at)} ${formatMessageTime(item.created_at)}`].filter(Boolean).join(' · ')}
        </Text>
        <VoiceMessage
          uri={item.media.uri}
          messageId={item.message_id}
          waveform={item.media.waveform}
          durationSeconds={item.media.duration}
          tint={theme.accent}
          trackColor={theme.separator}
          metaColor={theme.textSecondary}
          onLongPress={() => itemMenu(item)}
        />
      </View>
    </Pressable>
  );

  const renderLink = (item) => (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
      onPress={() => Linking.openURL(linkHref(item.url)).catch(() => {})}
      onLongPress={() => itemMenu(item, [
        { text: 'Копировать ссылку', onPress: async () => { await Clipboard.setStringAsync(item.url); Toast.show({ type: 'success', text1: 'Скопировано', position: 'top', visibilityTime: 1500 }); } },
      ])}
      delayLongPress={280}
    >
      <View style={[s.linkIcon, { backgroundColor: theme.accentSoft }]}>
        <Text style={[s.linkLetter, { color: theme.accentText }]}>{(linkHost(item.url)[0] || '#').toUpperCase()}</Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>{linkHost(item.url)}</Text>
        <Text style={[s.linkUrl, { color: theme.accentText }]} numberOfLines={1}>{item.url}</Text>
        {item.text ? <Text style={s.rowSub} numberOfLines={2}>{item.text}</Text> : null}
      </View>
    </Pressable>
  );

  const renderItem = ({ item }) => {
    if (tab === 'media') return renderMediaRow(item);
    if (tab === 'files') return renderFile(item);
    if (tab === 'voice') return renderVoice(item);
    return renderLink(item);
  };

  const emptyText = TABS.find((entry) => entry.key === tab)?.empty;

  return (
    <AudioPlayerProvider>
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
            <Ionicons name="chevron-back" size={28} color={theme.accent} />
          </Pressable>
          <Text style={s.topTitle} numberOfLines={1}>Медиа, файлы и ссылки</Text>
          <View style={s.back} />
        </View>

        <View style={s.tabs}>
          {TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <Pressable
                key={entry.key}
                onPress={() => {
                  if (!active) Haptics.selectionAsync().catch(() => {});
                  setTab(entry.key);
                }}
                style={[s.tab, active && { backgroundColor: theme.accentSoft }]}
              >
                <Text style={[s.tabText, active && { color: theme.accentText, fontWeight: '600' }]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionList
          key={tab}
          sections={sections}
          keyExtractor={(item, index) => (Array.isArray(item) ? `row-${item[0]?.message_id}-${index}` : `${item.message_id}-${item.url || item.media?.uri}-${index}`)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={s.month}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          onEndReached={() => load(tab, { more: true })}
          onEndReachedThreshold={0.5}
          contentContainerStyle={!sections.length && s.emptyContainer}
          ListFooterComponent={current.loading ? <ActivityIndicator style={s.loader} color={theme.accent} /> : null}
          ListEmptyComponent={current.loading ? null : (
            <View style={s.empty}>
              <Ionicons name={current.error ? 'cloud-offline-outline' : 'images-outline'} size={48} color={theme.textMuted} />
              <Text style={s.emptyText}>{current.error || emptyText}</Text>
              {current.error ? (
                <Pressable onPress={() => load(tab)} style={[s.retry, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[s.retryText, { color: theme.accentText }]}>Повторить</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />

        <ImageViewing
          images={imageViewer?.images ?? []}
          imageIndex={imageViewer?.index ?? 0}
          visible={Boolean(imageViewer)}
          onRequestClose={() => setImageViewer(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          HeaderComponent={({ imageIndex }) => (
            <ViewerHeader
              title={(imageViewer?.images?.length ?? 0) > 1 ? `${imageIndex + 1} из ${imageViewer.images.length}` : ''}
              onClose={() => setImageViewer(null)}
              actions={[
                {
                  key: 'chat',
                  icon: 'chatbubble-outline',
                  label: 'Показать в чате',
                  onPress: () => {
                    const item = imageViewer?.items?.[imageIndex];
                    setImageViewer(null);
                    if (item) showInChat(item.message_id);
                  },
                },
                {
                  key: 'share',
                  icon: 'share-outline',
                  label: 'Поделиться',
                  onPress: () => imageViewer?.items?.[imageIndex] && shareMediaItem(imageViewer.items[imageIndex].media),
                },
              ]}
            />
          )}
        />
        <VideoViewer uri={video?.media?.uri} onClose={() => setVideo(null)} onShare={() => video && shareMediaItem(video.media)} />
      </SafeAreaView>
    </AudioPlayerProvider>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: theme.text },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 16, backgroundColor: theme.surfaceAlt },
  tabText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  month: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: theme.background },
  gridRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: { backgroundColor: theme.dark ? '#1C1C21' : '#E7E7EC', overflow: 'hidden' },
  videoBadge: { position: 'absolute', left: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: theme.text },
  rowSub: { fontSize: 13, color: theme.textSecondary },
  fileIcon: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileExt: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  linkIcon: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkLetter: { fontSize: 20, fontWeight: '700' },
  linkUrl: { fontSize: 13 },
  loader: { marginVertical: 20 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  retry: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16 },
  retryText: { fontSize: 15, fontWeight: '600' },
});
