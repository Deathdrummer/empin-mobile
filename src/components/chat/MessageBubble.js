import React, { memo, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SERVER_URL } from '../../services/api';
import { formatMessageTime, fullName, mediaLabel } from '../../utils/chatFormat';
import { VoiceMessage } from './VoiceMessage';
import { DocumentCard, MediaGrid } from './MessageAttachments';

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
  theme,
  onLongPress,
  onReply,
  onReactionPress,
  onOpenMedia,
  onOpenDocument,
  onQuotePress,
  onRetry,
}) => {
  const swipeableRef = useRef(null);
  const media = useMemo(() => normalizeMedia(message.media), [message.media]);
  const visual = media.filter((item) => item.type === 'image' || item.type === 'video');
  const audio = media.filter((item) => item.type === 'audio');
  const files = media.filter((item) => !['image', 'video', 'audio'].includes(item.type));
  const reactions = useMemo(() => groupReactions(message.reactions, myUserId), [message.reactions, myUserId]);
  const text = (message.message || '').trim();

  const colors = isMine
    ? { bg: theme.bubbleOut, text: theme.bubbleOutText, meta: theme.bubbleOutMeta, accent: theme.bubbleOutAccent }
    : { bg: theme.bubbleIn, text: theme.bubbleInText, meta: theme.bubbleInMeta, accent: theme.accentText };

  const time = formatMessageTime(message.created_at);
  const edited = isEdited(message);
  const metaText = `${edited ? 'изменено ' : ''}${time}`;
  const mediaOnly = visual.length > 0 && !text && !audio.length && !files.length;

  const meta = (
    <View style={[styles.meta, mediaOnly && styles.metaOnMedia]}>
      <Text style={[styles.metaText, { color: mediaOnly ? '#FFFFFF' : colors.meta }]}>{metaText}</Text>
      {isMine ? (
        <StatusIcon
          status={status}
          color={mediaOnly ? '#FFFFFF' : colors.meta}
          readColor={mediaOnly ? '#FFFFFF' : colors.accent}
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

  const bubble = (
    <Pressable
      onLongPress={handleLongPress}
      onPress={status === 'failed' ? () => onRetry(message) : undefined}
      delayLongPress={280}
      style={[
        styles.bubble,
        corner,
        { backgroundColor: colors.bg },
        mediaOnly && styles.bubbleMedia,
        // Голосовое или файл без текста: время ниже содержимого, а не поверх него
        !text && !mediaOnly && styles.bubbleMetaBelow,
      ]}
    >
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
          trackColor={isMine ? 'rgba(160, 65, 74, 0.35)' : theme.separator}
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

      {text ? (
        <Text style={[styles.text, { color: colors.text }]} selectable={false}>
          {text}
          {/* Невидимый хвост резервирует место под время и галочки на последней строке */}
          <Text style={styles.metaSpacer}>{`  ${metaText}${isMine ? '    ' : ''}`}</Text>
        </Text>
      ) : null}

      {!mediaOnly ? meta : null}
    </Pressable>
  );

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs, isFirstInGroup && styles.rowGroupStart]}>
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

      {reactions.length ? (
        <View style={[styles.reactions, isMine ? styles.reactionsMine : styles.reactionsTheirs]}>
          {reactions.map((reaction) => (
            <Pressable
              key={reaction.emoji}
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
          ))}
        </View>
      ) : null}
    </View>
  );
};

export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, marginTop: 2 },
  rowGroupStart: { marginTop: 8 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  swipeContainer: { maxWidth: '82%', overflow: 'visible' },
  bubble: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, minWidth: 64 },
  bubbleMedia: { padding: 3 },
  bubbleMetaBelow: { paddingBottom: 20 },
  mediaSpacing: { marginBottom: 4 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  quoteName: { fontSize: 13, fontWeight: '600' },
  quoteText: { fontSize: 13, opacity: 0.85 },
  text: { fontSize: 16, lineHeight: 21 },
  metaSpacer: { fontSize: 11, color: 'transparent' },
  meta: { position: 'absolute', right: 9, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaOnMedia: {
    right: 10,
    bottom: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
