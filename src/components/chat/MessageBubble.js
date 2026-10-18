import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Keyframe, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { SERVER_URL } from '../../services/api';
import { avatarColor } from '../../theme';
import { formatMessageTime, formatShortDay, fullName, mediaLabel, shortName } from '../../utils/chatFormat';
import { Avatar } from './Avatar';
import { PollCard } from './PollCard';
import { VoiceMessage } from './VoiceMessage';
import { DocumentCard, MediaGrid } from './MessageAttachments';
import { ReactionBurst } from './ReactionBurst';

const AVATAR_SLOT = 34;

// Отступ под скрепку и галочки в невидимом хвосте текста. Неразрывные пробелы: обычные
// в конце строки «висят» за её краем и не учитываются при переносе
const NBSP = '\u00A0';
const metaPadding = (pinned, isMine) => NBSP.repeat(1 + (pinned ? 5 : 0) + (isMine ? 7 : 0));

// «@Самсонов А.» — упоминание в тексте
const MENTION_PATTERN = /(@[A-Za-zА-Яа-яЁё-]+(?:\s[A-ZА-ЯЁ]\.)?)/g;

/** Текст с подсвеченными упоминаниями */
const textParts = (text) => text.split(MENTION_PATTERN).filter((part) => part !== '');

// Эмодзи без регулярных выражений с \p{…}: диапазоны символов, соединители и модификаторы
const isEmojiBase = (code) => (code >= 0x1f000 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf)
  || (code >= 0x2300 && code <= 0x23ff) || (code >= 0x2b00 && code <= 0x2bff) || (code >= 0x2194 && code <= 0x21aa)
  || [0xa9, 0xae, 0x203c, 0x2049, 0x2122, 0x2139, 0x3030, 0x303d, 0x3297, 0x3299].includes(code);
const isEmojiJoiner = (code) => code === 0x200d || code === 0xfe0f || code === 0x20e3 || (code >= 0xe0020 && code <= 0xe007f);
const isSkinTone = (code) => code >= 0x1f3fb && code <= 0x1f3ff;
const isRegionalIndicator = (code) => code >= 0x1f1e6 && code <= 0x1f1ff;

/** Сколько эмодзи в сообщении из одних эмодзи (1–3), иначе 0 — такие показываются крупно, как в Telegram */
export const jumboEmojiCount = (text) => {
  if (!text || text.length > 40) return 0;
  let count = 0;
  let joined = false;
  let regional = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (char.trim() === '') {
      joined = false;
    } else if (isEmojiJoiner(code)) {
      joined = code === 0x200d;
    } else if (isRegionalIndicator(code)) {
      // Флаг — пара символов-букв
      regional += 1;
      if (regional % 2 === 1) count += 1;
    } else if (!isSkinTone(code)) {
      if (!isEmojiBase(code)) return 0;
      if (!joined) count += 1;
      joined = false;
    }
  }
  return count <= 3 ? count : 0;
};

const JUMBO_SIZES = { 1: 52, 2: 44, 3: 38 };
const QUICK_TAP_MS = 300;

// Новое сообщение проявляется один раз: при прокрутке истории анимация не повторяется
const appearedIds = new Set();
const APPEAR = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(220);
const JUMBO_APPEAR = ZoomIn.springify().damping(9).stiffness(170);
const REACTION_APPEAR = ZoomIn.springify().damping(12).stiffness(260);

/** Вложения сообщения в одном формате: старый формат — один объект, новый — массив */
export const normalizeMedia = (media) => {
  if (!media) return [];
  const list = Array.isArray(media) ? media : [media];
  return list
    .filter(Boolean)
    .map((item) => ({
      ...item,
      uri: item.localUri || (item.path?.startsWith('http') ? item.path : `${SERVER_URL}${item.path ?? ''}`),
    }));
};

const isEdited = (message) => {
  if (!message.updated_at || !message.created_at) return false;
  return new Date(message.updated_at) - new Date(message.created_at) > 2000;
};

const groupReactions = (reactions, myUserId) => {
  const groups = new Map();
  (reactions || []).forEach((reaction) => {
    const group = groups.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, mine: false };
    group.count += 1;
    group.mine = group.mine || Number(reaction.user_id) === Number(myUserId);
    groups.set(reaction.emoji, group);
  });
  return [...groups.values()];
};

const StatusIcon = ({ status, color, readColor, failedColor }) => {
  if (status === 'sending') return <Ionicons name="time-outline" size={13} color={color} />;
  if (status === 'failed') return <Ionicons name="alert-circle" size={14} color={failedColor} />;
  if (status === 'read') return <Ionicons name="checkmark-done" size={15} color={readColor} />;
  return <Ionicons name="checkmark" size={15} color={color} />;
};

const MessageBubbleComponent = ({
  message,
  isMine,
  status,
  isLastInGroup,
  isFirstInGroup,
  myUserId,
  myStaffId,
  chatType = 'direct',
  highlighted = false,
  theme,
  onLongPress,
  onReply,
  onReactionPress,
  onOpenMedia,
  onOpenDocument,
  onQuotePress,
  onRetry,
  onVote,
  onQuickReact,
  burst,
}) => {
  // В группе и чате объекта у чужих сообщений — автор и аватар, как в Telegram
  const multiAuthor = chatType !== 'direct';
  const showAuthor = multiAuthor && !isMine && isFirstInGroup;
  const showAvatarSlot = multiAuthor && !isMine;
  const isPoll = message.type === 'poll' && message.poll;
  const swipeableRef = useRef(null);
  const media = useMemo(() => normalizeMedia(message.media), [message.media]);
  const visual = media.filter((item) => item.type === 'image' || item.type === 'video');
  const audio = media.filter((item) => item.type === 'audio');
  const files = media.filter((item) => !['image', 'video', 'audio'].includes(item.type));
  const reactions = useMemo(() => groupReactions(message.reactions, myUserId), [message.reactions, myUserId]);
  const text = (message.message || '').trim();
  const jumbo = !isPoll && !message.reply_to && !media.length ? jumboEmojiCount(text) : 0;
  const lastTapRef = useRef(0);

  // Проявление только у только что пришедших и отправленных сообщений (флаг ставит экран чата)
  const appear = useRef(Boolean(message._appear) && !appearedIds.has(message.id)).current;
  useEffect(() => {
    if (message._appear) appearedIds.add(message.id);
  }, [message._appear, message.id]);

  const colors = isMine
    ? { bg: theme.bubbleOut, text: theme.bubbleOutText, meta: theme.bubbleOutMeta, accent: theme.bubbleOutAccent }
    : { bg: theme.bubbleIn, text: theme.bubbleInText, meta: theme.bubbleInMeta, accent: theme.accentText };

  const time = formatMessageTime(message.created_at);
  const edited = isEdited(message);
  const metaText = `${edited ? 'изменено ' : ''}${time}`;
  const mediaOnly = visual.length > 0 && !text && !audio.length && !files.length;
  // Время на тёмной плашке — поверх фото и рядом с крупными эмодзи
  const metaOnChip = mediaOnly || jumbo > 0;

  const meta = (
    <View style={[styles.meta, mediaOnly && styles.metaOnMedia, jumbo > 0 && styles.metaJumbo]}>
      {message.pinned ? <Ionicons name="pin" size={11} color={metaOnChip ? '#FFFFFF' : colors.meta} style={styles.metaPin} /> : null}
      <Text style={[styles.metaText, { color: metaOnChip ? '#FFFFFF' : colors.meta }]}>{metaText}</Text>
      {isMine ? (
        <StatusIcon
          status={status}
          color={metaOnChip ? '#FFFFFF' : colors.meta}
          readColor={metaOnChip ? '#FFFFFF' : colors.accent}
          failedColor={theme.danger}
        />
      ) : null}
    </View>
  );

  const corner = { borderRadius: 18 };
  if (isLastInGroup) {
    if (isMine) corner.borderBottomRightRadius = 5;
    else corner.borderBottomLeftRadius = 5;
  }

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress(message);
  };

  // Двойное касание — быстрая реакция, как в Telegram (фото, ответы и опросы ловят касания сами)
  const handlePress = () => {
    if (status === 'failed') {
      onRetry(message);
      return;
    }
    if (!onQuickReact || status === 'sending') return;
    const now = Date.now();
    if (now - lastTapRef.current < QUICK_TAP_MS) {
      lastTapRef.current = 0;
      onQuickReact(message);
    } else {
      lastTapRef.current = now;
    }
  };

  const bubble = (
    <Pressable
      onLongPress={handleLongPress}
      onPress={handlePress}
      delayLongPress={280}
      style={[
        styles.bubble,
        corner,
        { backgroundColor: jumbo ? 'transparent' : colors.bg },
        mediaOnly && styles.bubbleMedia,
        jumbo > 0 && styles.bubbleJumbo,
        // Голосовое, файл или опрос без текста: время ниже содержимого, а не поверх него
        !text && !mediaOnly && styles.bubbleMetaBelow,
        highlighted && { borderWidth: 2, borderColor: theme.accent },
      ]}
    >
      {showAuthor ? (
        <Text style={[styles.author, mediaOnly && styles.authorOnMedia]} numberOfLines={1}>
          <Text style={{ color: avatarColor(message.from_id) }}>{shortName(message.from)}</Text>
          {message.context?.day ? (
            <Text style={[styles.authorContext, { color: colors.meta }]}>
              {`  ${formatShortDay(message.context.day)}`}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {isPoll ? (
        <PollCard
          message={message}
          myStaffId={myStaffId}
          theme={theme}
          colors={{ ...colors, track: isMine ? theme.bubbleOutTrack : theme.separator }}
          onVote={onVote}
        />
      ) : null}

      {message.reply_to ? (
        <Pressable
          onPress={() => onQuotePress(message.reply_to.id)}
          style={[styles.quote, { backgroundColor: theme.quoteBackground, borderLeftColor: colors.accent }]}
        >
          <Text style={[styles.quoteName, { color: colors.accent }]} numberOfLines={1}>
            {fullName(message.reply_to.from)}
          </Text>
          <Text style={[styles.quoteText, { color: colors.text }]} numberOfLines={2}>
            {message.reply_to.message || mediaLabel(message.reply_to.type)}
          </Text>
        </Pressable>
      ) : null}

      {visual.length ? (
        <View style={!mediaOnly && styles.mediaSpacing}>
          <MediaGrid items={visual} onOpen={(index) => onOpenMedia(visual, index)} />
          {mediaOnly ? meta : null}
        </View>
      ) : null}

      {audio.map((item, index) => (
        <VoiceMessage
          key={`${item.uri}-${index}`}
          uri={item.uri}
          messageId={message.id}
          tint={theme.accent}
          trackColor={isMine ? theme.bubbleOutTrack : theme.separator}
          metaColor={colors.meta}
        />
      ))}

      {files.map((file, index) => (
        <DocumentCard
          key={`${file.uri}-${index}`}
          file={file}
          tint={theme.accent}
          textColor={colors.text}
          metaColor={colors.meta}
          onPress={onOpenDocument}
        />
      ))}

      {jumbo ? (
        <Animated.Text
          entering={appear ? JUMBO_APPEAR : undefined}
          style={[styles.jumbo, { fontSize: JUMBO_SIZES[jumbo], lineHeight: JUMBO_SIZES[jumbo] * 1.2 }]}
        >
          {text}
        </Animated.Text>
      ) : null}

      {text && !jumbo ? (
        <Text style={[styles.text, { color: colors.text }]} selectable={false}>
          {text.includes('@')
            ? textParts(text).map((part, index) => (part.startsWith('@')
              ? <Text key={index} style={[styles.mention, { color: colors.accent }]}>{part}</Text>
              : part))
            : text}
          {/* Невидимый хвост резервирует место под время и галочки на последней строке */}
          <Text style={styles.metaSpacer}>{`  ${metaText}${metaPadding(message.pinned, isMine)}`}</Text>
        </Text>
      ) : null}

      {!mediaOnly ? meta : null}
    </Pressable>
  );

  const swipeable = (
    <ReanimatedSwipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={56}
        overshootLeft={false}
        renderLeftActions={() => (
          <View style={styles.swipeAction}>
            <View style={[styles.swipeIcon, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="arrow-undo" size={18} color={theme.accent} />
            </View>
          </View>
        )}
        onSwipeableWillOpen={() => {
          Haptics.selectionAsync().catch(() => {});
          onReply(message);
          requestAnimationFrame(() => swipeableRef.current?.close());
        }}
        containerStyle={styles.swipeContainer}
      >
        {bubble}
      </ReanimatedSwipeable>
  );

  // Реакции, которые уже были при показе, не анимируются; новая плашка появляется с пружинкой
  const reactionsRow = reactions.length ? (
    <LayoutAnimationConfig skipEntering>
      <View style={[styles.reactions, isMine ? styles.reactionsMine : styles.reactionsTheirs]}>
        {reactions.map((reaction) => (
          <Animated.View key={reaction.emoji} entering={REACTION_APPEAR}>
            <Pressable
              onPress={() => onReactionPress(message, reaction.emoji, reaction.mine)}
              style={[
                styles.reaction,
                {
                  backgroundColor: reaction.mine ? theme.reactionMine : theme.reactionBackground,
                  borderColor: reaction.mine ? theme.accent : theme.reactionBorder,
                },
              ]}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              {reaction.count > 1 ? <Text style={[styles.reactionCount, { color: theme.text }]}>{reaction.count}</Text> : null}
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </LayoutAnimationConfig>
  ) : null;

  const burstView = burst ? <ReactionBurst key={burst.key} emoji={burst.emoji} alignRight={isMine} /> : null;

  if (showAvatarSlot) {
    return (
      <Animated.View entering={appear ? APPEAR : undefined} style={[styles.row, styles.rowWithAvatar, isFirstInGroup && styles.rowGroupStart]}>
        <View style={styles.avatarSlot}>
          {isLastInGroup ? <Avatar person={message.from} id={message.from_id} size={30} /> : null}
        </View>
        <View style={styles.rowColumn}>
          {swipeable}
          {reactionsRow}
        </View>
        {burstView}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={appear ? APPEAR : undefined}
      style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs, isFirstInGroup && styles.rowGroupStart]}
    >
      {swipeable}
      {reactionsRow}
      {burstView}
    </Animated.View>
  );
};

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, marginTop: 2 },
  rowGroupStart: { marginTop: 8 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  rowWithAvatar: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 6 },
  avatarSlot: { width: AVATAR_SLOT, alignItems: 'flex-start', justifyContent: 'flex-end', marginBottom: 1 },
  rowColumn: { flex: 1, alignItems: 'flex-start' },
  author: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  authorOnMedia: { paddingHorizontal: 7, paddingTop: 3 },
  authorContext: { fontSize: 11, fontWeight: '400' },
  mention: { fontWeight: '600' },
  metaPin: { transform: [{ rotate: '45deg' }] },
  swipeContainer: { maxWidth: '82%', overflow: 'visible' },
  bubble: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, minWidth: 64 },
  bubbleMedia: { padding: 3 },
  bubbleJumbo: { paddingHorizontal: 2, paddingTop: 0, paddingBottom: 2, minWidth: 0 },
  jumbo: { textAlign: 'center' },
  bubbleMetaBelow: { paddingBottom: 20 },
  mediaSpacing: { marginBottom: 4 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  quoteName: { fontSize: 13, fontWeight: '600' },
  quoteText: { fontSize: 13, opacity: 0.85 },
  text: { fontSize: 16, lineHeight: 21 },
  // Не 'transparent': на Android цвет 0x00000000 во вложенном Text считается «не задан»
  // и наследует цвет текста — время становилось видно дважды
  metaSpacer: { fontSize: 11, color: 'rgba(255, 255, 255, 0)' },
  meta: { position: 'absolute', right: 9, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaOnMedia: {
    right: 10,
    bottom: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  metaJumbo: {
    position: 'relative',
    right: 0,
    bottom: 0,
    alignSelf: 'flex-end',
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  metaText: { fontSize: 11 },
  swipeAction: { width: 56, justifyContent: 'center', alignItems: 'center' },
  swipeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, maxWidth: '82%' },
  reactionsMine: { justifyContent: 'flex-end', paddingRight: 6 },
  reactionsTheirs: { justifyContent: 'flex-start', paddingLeft: 6 },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, fontWeight: '600' },
});
