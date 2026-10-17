import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { isCallAudioActive } from '../../services/callAudioState';
import { formatDuration, fullName, shortName } from '../../utils/chatFormat';
import { AttachmentSheet, takePhoto } from './AttachmentSheet';
import { Avatar } from './Avatar';

const TYPING_THROTTLE_MS = 3000;
const CANCEL_DISTANCE = 90;
const MIN_VOICE_SECONDS = 0.8;
const MAX_SUGGESTIONS = 5;

// Набирается упоминание: «… @Сам» в конце текста
const MENTION_QUERY = /(^|\s)@([^\s@]*)$/;

const isVideoAsset = (asset) => asset.type === 'video' || asset.mimeType?.startsWith('video/');
const isImageAsset = (asset) => asset.type === 'image' || asset.mimeType?.startsWith('image/');

/**
 * Панель ввода как в мессенджерах: скрепка, поле с камерой, микрофон/отправка.
 * Микрофон: удерживать — запись, отпустить — отправить, сдвинуть влево — отмена.
 * В группе «@» показывает участников для упоминания; onCreatePoll добавляет «Опрос» во вложения.
 */
export const Composer = ({
  theme,
  value,
  onChangeText,
  onSend,
  onSendVoice,
  context,
  onCancelContext,
  onTyping,
  allowAttachments = true,
  mentionCandidates = null,
  onCreatePoll = null,
  transparent = false,
}) => {
  const [attachments, setAttachments] = useState([]);
  const mentionIdsRef = useRef(new Map());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const lastTypingRef = useRef(0);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const startingRef = useRef(null);
  const releaseRequestedRef = useRef(false);
  const cancelledRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const canSend = value.trim().length > 0 || attachments.length > 0 || context?.type === 'edit';

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    if (!recording) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const handleChangeText = (text) => {
    onChangeText(text);
    const now = Date.now();
    if (text.trim() && now - lastTypingRef.current > TYPING_THROTTLE_MS) {
      lastTypingRef.current = now;
      onTyping?.();
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    const text = value;
    const files = attachments;
    // Упомянутые, чьи «@Фамилия И.» остались в тексте
    const mentionIds = [...mentionIdsRef.current.entries()]
      .filter(([label]) => text.includes(label))
      .map(([, id]) => id);
    mentionIdsRef.current = new Map();
    setAttachments([]);
    lastTypingRef.current = 0;
    await onSend(text, files, { mentionIds });
  };

  // --- Упоминания ---

  const mentionMatch = mentionCandidates?.length ? value.match(MENTION_QUERY) : null;
  const mentionQuery = mentionMatch ? mentionMatch[2].toLowerCase() : null;
  const suggestions = mentionQuery === null ? [] : mentionCandidates
    .filter((person) => !mentionQuery
      || (person.sname || '').toLowerCase().startsWith(mentionQuery)
      || (person.fname || '').toLowerCase().startsWith(mentionQuery))
    .slice(0, MAX_SUGGESTIONS);

  const insertMention = (person) => {
    const label = `@${shortName(person)}`;
    mentionIdsRef.current.set(label, person.id);
    onChangeText(value.replace(MENTION_QUERY, (match, space) => `${space}${label} `));
    Haptics.selectionAsync().catch(() => {});
  };

  const openCamera = async () => {
    const assets = await takePhoto();
    if (assets?.length) setAttachments((prev) => [...prev, ...assets].slice(0, 10));
  };

  // --- Голосовые ---

  const restorePlaybackMode = () =>
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

  const startRecording = async () => {
    if (isCallAudioActive()) {
      Toast.show({ type: 'info', text1: 'Идёт звонок', text2: 'Голосовое можно записать после звонка', position: 'top' });
      return false;
    }

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Доступ к микрофону', 'Разрешите доступ к микрофону в настройках телефона, чтобы записывать голосовые.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Настройки', onPress: () => Linking.openSettings() },
      ]);
      return false;
    }

    // На iOS без этого режима expo-audio отказывается записывать (RecordingDisabledException)
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAtRef.current = Date.now();
    setRecordSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setRecordSeconds((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return true;
  };

  const finishRecording = async (send) => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    const seconds = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
    startedAtRef.current = 0;
    setRecording(false);
    setCancelling(false);

    try {
      await recorder.stop();
    } catch (error) {
      // Известная ошибка expo-audio на Android: запись уже остановлена
      if (!String(error?.message).includes('IllegalStateException')) {
        console.warn('[Voice] Не удалось остановить запись:', error?.message ?? error);
      }
    }
    await restorePlaybackMode();

    if (!send) return;
    if (seconds < MIN_VOICE_SECONDS) {
      Toast.show({ type: 'info', text1: 'Слишком коротко', text2: 'Удерживайте микрофон, пока говорите', position: 'top' });
      return;
    }
    if (!recorder.uri) {
      Toast.show({ type: 'error', text1: 'Не удалось записать', text2: 'Попробуйте ещё раз', position: 'top' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSendVoice({ uri: recorder.uri, name: 'Голосовое сообщение.m4a', mimeType: 'audio/mp4', durationSeconds: seconds });
  };

  const release = async (send) => {
    releaseRequestedRef.current = true;
    const started = startingRef.current ? await startingRef.current : false;
    startingRef.current = null;
    if (started) await finishRecording(send);
  };

  // Жест создаётся один раз: актуальные функции (с текущими onSendVoice, чатом, цитатой) берём из ссылки
  const latest = useRef({});
  latest.current = { startRecording, release, restorePlaybackMode };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      cancelledRef.current = false;
      releaseRequestedRef.current = false;
      startingRef.current = latest.current.startRecording().catch((error) => {
        console.warn('[Voice] Не удалось начать запись:', error?.message ?? error);
        latest.current.restorePlaybackMode();
        Toast.show({ type: 'error', text1: 'Не удалось начать запись', text2: 'Попробуйте ещё раз', position: 'top' });
        return false;
      });
    },
    onPanResponderMove: (_event, gesture) => {
      const willCancel = gesture.dx < -CANCEL_DISTANCE;
      setCancelling(willCancel);
      if (willCancel && !cancelledRef.current) {
        cancelledRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        latest.current.release(false);
      }
    },
    onPanResponderRelease: () => {
      if (!cancelledRef.current) latest.current.release(true);
    },
    onPanResponderTerminate: () => {
      if (!cancelledRef.current) latest.current.release(false);
    },
  })).current;

  const removeAttachment = (index) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const s = styles(theme);

  return (
    <View style={[s.container, transparent && s.containerTransparent]}>
      {suggestions.length ? (
        <View style={s.suggestions}>
          {suggestions.map((person, index) => (
            <Pressable
              key={person.id}
              onPress={() => insertMention(person)}
              style={({ pressed }) => [
                s.suggestion,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                pressed && { backgroundColor: theme.surfacePressed },
              ]}
            >
              <Avatar person={person} id={person.id} size={30} />
              <Text style={s.suggestionName} numberOfLines={1}>{fullName(person)}</Text>
              <Text style={s.suggestionTag}>{`@${shortName(person)}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {context ? (
        <View style={s.context}>
          <Ionicons name={context.type === 'edit' ? 'create-outline' : 'arrow-undo'} size={20} color={theme.accent} />
          <View style={[s.contextBody, { borderLeftColor: theme.accent }]}>
            <Text style={s.contextTitle} numberOfLines={1}>{context.title}</Text>
            <Text style={s.contextText} numberOfLines={1}>{context.text}</Text>
          </View>
          <Pressable onPress={onCancelContext} hitSlop={10} accessibilityLabel="Отменить">
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.attachments}>
          {attachments.map((asset, index) => (
            <View key={`${asset.uri}-${index}`} style={s.attachment}>
              {isImageAsset(asset) ? (
                <Image source={{ uri: asset.uri }} style={s.attachmentImage} />
              ) : (
                <View style={[s.attachmentImage, s.attachmentFile]}>
                  <Ionicons name={isVideoAsset(asset) ? 'videocam' : 'document'} size={24} color={theme.textSecondary} />
                  {!isVideoAsset(asset) ? (
                    <Text style={s.attachmentName} numberOfLines={2}>{asset.name || asset.fileName || 'Файл'}</Text>
                  ) : null}
                </View>
              )}
              <Pressable style={s.attachmentRemove} onPress={() => removeAttachment(index)} hitSlop={6}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={s.row}>
        {recording ? (
          <View style={s.recording}>
            <Animated.View style={[s.recordDot, { opacity: pulse }]} />
            <Text style={s.recordTime}>{formatDuration(recordSeconds)}</Text>
            <Text style={[s.recordHint, cancelling && { color: theme.danger }]} numberOfLines={1}>
              {cancelling ? 'Отпустите — отмена' : '‹ Влево — отмена'}
            </Text>
          </View>
        ) : (
          <>
            {allowAttachments && context?.type !== 'edit' ? (
              <Pressable onPress={() => setSheetVisible(true)} hitSlop={8} style={s.iconButton} accessibilityLabel="Прикрепить">
                <Ionicons name="attach" size={27} color={theme.textSecondary} style={s.attachIcon} />
              </Pressable>
            ) : null}
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={value}
                onChangeText={handleChangeText}
                placeholder="Сообщение"
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={4000}
                textAlignVertical="center"
              />
              {allowAttachments && context?.type !== 'edit' && !value ? (
                <Pressable onPress={openCamera} hitSlop={8} style={s.cameraButton} accessibilityLabel="Сфотографировать">
                  <Ionicons name="camera-outline" size={23} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </>
        )}

        {canSend && !recording ? (
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [s.action, { backgroundColor: pressed ? theme.accentPressed : theme.accent }]}
            accessibilityLabel={context?.type === 'edit' ? 'Сохранить' : 'Отправить'}
          >
            <Ionicons name={context?.type === 'edit' ? 'checkmark' : 'arrow-up'} size={22} color={theme.onAccent} />
          </Pressable>
        ) : (
          <View
            {...panResponder.panHandlers}
            style={[s.action, { backgroundColor: theme.accent }, recording && s.actionRecording]}
            accessibilityRole="button"
            accessibilityLabel="Удерживайте, чтобы записать голосовое"
          >
            <Ionicons name="mic" size={recording ? 28 : 22} color={theme.onAccent} />
          </View>
        )}
      </View>

      <AttachmentSheet
        visible={sheetVisible}
        theme={theme}
        onClose={() => setSheetVisible(false)}
        onPicked={(assets) => setAttachments((prev) => [...prev, ...assets].slice(0, 10))}
        extraOptions={onCreatePoll ? [{ key: 'poll', label: 'Опрос', icon: 'stats-chart', color: '#E0A100', onPress: onCreatePoll }] : []}
      />
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
    paddingBottom: 6,
  },
  // Поверх полупрозрачной панели: свой фон и граница не нужны
  containerTransparent: { backgroundColor: 'transparent', borderTopWidth: 0 },
  suggestions: {
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.separator,
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionName: { flex: 1, fontSize: 15, color: theme.text },
  suggestionTag: { fontSize: 13, color: theme.textMuted },
  cameraButton: { position: 'absolute', right: 8, bottom: 8 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  contextBody: { flex: 1, borderLeftWidth: 3, paddingLeft: 8 },
  contextTitle: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  contextText: { fontSize: 14, color: theme.textSecondary },
  attachments: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  attachment: { width: 72, height: 72 },
  attachmentImage: { width: 72, height: 72, borderRadius: 12 },
  attachmentFile: { backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: 4 },
  attachmentName: { fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 2 },
  attachmentRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  iconButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  attachIcon: { transform: [{ rotate: '45deg' }] },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    maxHeight: 130,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    paddingHorizontal: 14,
  },
  input: { fontSize: 16, color: theme.text, paddingTop: 9, paddingBottom: 9, maxHeight: 128 },
  action: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionRecording: { width: 56, height: 56, borderRadius: 28, marginTop: -16 },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 12 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.danger },
  recordTime: { fontSize: 16, color: theme.text, fontVariant: ['tabular-nums'], minWidth: 44 },
  recordHint: { flex: 1, fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
});
