import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { messengerAPI } from '../../services/api';
import { setTotalUnread, subscribeMessengerEvents } from '../../services/messengerStore';
import { useCallContext } from '../../contexts/CallContext';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { PinIcon } from '../../components/chat/PinIcon';
import { formatLastSeen, fullName, mediaLabel, plural } from '../../utils/chatFormat';
import { getUserFacingError } from '../../utils/userFacingError';
import { StaffPicker } from './NewChatModal';

/**
 * Сведения о чате: собеседник, группа (участники, название, выход) или объект (участники, выход).
 * Здесь же «Без звука» и закреплённые сообщения. Что можно делать с составом, решает сервер.
 */
export default function ChatInfoScreen({ navigation, route }) {
  const { chatId, chatType, title: initialTitle } = route.params || {};
  const theme = useTheme();
  const { initiateCall } = useCallContext();
  const [info, setInfo] = useState(null);
  const [myStaffId, setMyStaffId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await messengerAPI.getChatInfo(chatId));
    } catch (error) {
      if (error?.response?.status === 404) navigation.popToTop();
    }
  }, [chatId, navigation]);

  useEffect(() => {
    load();
    AsyncStorage.getItem('user')
      .then((raw) => setMyStaffId(raw ? JSON.parse(raw)?.staff_id ?? null : null))
      .catch(() => {});
    return subscribeMessengerEvents((name, data) => {
      if (Number(data?.chat_id) === Number(chatId) && (name === 'chat.updated' || name === 'chat.pinned')) load();
    });
  }, [chatId, load]);

  const isGroup = chatType === 'group';
  const isObject = chatType === 'object';
  const hasMembers = isGroup || isObject;
  const isAdmin = info?.role === 'admin';
  const isMe = (member) => Number(member.id) === Number(myStaffId);
  // Права на состав присылает сервер; без них — прежние правила группы
  const canAdd = info?.can_add_members ?? isGroup;
  const canRemove = info?.can_remove_members ?? (isGroup && isAdmin);
  const isMember = info?.is_member ?? isGroup;
  const title = info?.title || initialTitle || 'Чат';

  const run = async (action, failText) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      Toast.show({ type: 'error', text1: failText, text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = (muted) => run(async () => {
    setInfo((current) => ({ ...current, muted }));
    const data = await messengerAPI.muteChat(chatId, muted);
    setTotalUnread(data.total_unread);
  }, 'Не удалось изменить звук');

  const rename = () => {
    const value = newTitle.trim();
    setRenaming(false);
    if (!value || value === info?.title) return;
    run(() => messengerAPI.renameGroup(chatId, value), 'Не удалось переименовать');
  };

  const removeMember = (member) => {
    const [question, details, action] = isObject
      ? [`Убрать ${fullName(member)} из чата объекта?`, 'Чат вернётся к нему, только если объект снова поставят его бригаде.', 'Убрать']
      : [`Исключить ${fullName(member)}?`, 'Участник больше не увидит переписку группы.', 'Исключить'];
    const remove = isObject ? messengerAPI.removeObjectMember : messengerAPI.removeGroupMember;
    Alert.alert(question, details, [
      { text: 'Отмена', style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => run(() => remove(chatId, member.id), 'Не удалось убрать участника') },
    ]);
  };

  const addMembers = (people) => {
    const add = isObject ? messengerAPI.addObjectMembers : messengerAPI.addGroupMembers;
    run(() => add(chatId, people.map((person) => person.id)), 'Не удалось добавить');
  };

  const leave = () => {
    const [question, details] = isObject
      ? ['Покинуть чат объекта?', 'Объект пропадёт из ваших чатов, пока его снова не поставят вашей бригаде.']
      : ['Покинуть группу?', 'Переписка группы пропадёт из ваших чатов.'];
    Alert.alert(question, details, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Покинуть',
        style: 'destructive',
        onPress: async () => {
          try {
            await (isObject ? messengerAPI.leaveObject(chatId) : messengerAPI.leaveGroup(chatId));
            navigation.popToTop();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Не удалось выйти', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
          }
        },
      },
    ]);
  };

  const openPinned = (message) => {
    // Возврат в открытую переписку с переходом к сообщению
    navigation.popTo('Chat', { ...route.params, chatId, chatType, title, focusMessageId: message.id, focusAt: Date.now() }, { merge: true });
  };

  const s = styles(theme);
  const headerChat = { type: chatType, chat_id: chatId, title, participant: info?.participant };

  const subtitle = (() => {
    if (chatType === 'direct' && info?.participant) return formatLastSeen(info.participant.online, info.participant.last_seen_at);
    if (hasMembers && info) {
      const count = info.members_count || 0;
      return `${count} ${plural(count, 'участник', 'участника', 'участников')}${info.online_count ? `, ${info.online_count} в сети` : ''}`;
    }
    return '';
  })();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={[s.topBar, scrolled && s.topBarScrolled]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={28} color={theme.accent} />
        </Pressable>
        <Text style={s.topTitle}>{isGroup ? 'Группа' : chatType === 'object' ? 'Объект' : 'Контакт'}</Text>
        <View style={s.back}>{busy ? <ActivityIndicator color={theme.accent} /> : null}</View>
      </View>

      {!info ? <ActivityIndicator style={s.loader} size="large" color={theme.accent} /> : (
        <ScrollView
          contentContainerStyle={s.content}
          scrollEventThrottle={32}
          onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 4)}
        >
          <View style={s.hero}>
            <ChatAvatar chat={headerChat} size={92} />
            <Text style={s.heroTitle}>{title}</Text>
            {subtitle ? <Text style={[s.heroSub, info?.participant?.online && { color: theme.accent }]}>{subtitle}</Text> : null}
            {isGroup && isAdmin ? (
              <TouchableOpacity onPress={() => { setNewTitle(info.title || ''); setRenaming(true); }} style={s.heroAction}>
                <Text style={s.heroActionText}>Изменить название</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {chatType === 'direct' && info.participant ? (
            <View style={s.quickRow}>
              <Pressable style={s.quick} onPress={() => navigation.goBack()}>
                <Ionicons name="chatbubble" size={22} color={theme.accent} />
                <Text style={s.quickText}>Чат</Text>
              </Pressable>
              <Pressable style={s.quick} onPress={() => initiateCall(info.participant.id, fullName(info.participant))}>
                <Ionicons name="call" size={22} color={theme.accent} />
                <Text style={s.quickText}>Позвонить</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={s.card}>
            <View style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: '#8A8D94' }]}>
                <Ionicons name="volume-mute" size={17} color="#FFFFFF" />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Без звука</Text>
                <Text style={s.rowSub}>Без уведомлений, кроме упоминаний</Text>
              </View>
              <Switch
                value={Boolean(info.muted)}
                onValueChange={toggleMute}
                trackColor={{ true: theme.accent, false: theme.separator }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {(info.pinned_messages || []).length ? (
            <>
              <Text style={s.sectionTitle}>Закреплённые сообщения</Text>
              <View style={s.card}>
                {info.pinned_messages.map((message, index) => (
                  <Pressable
                    key={message.id}
                    onPress={() => openPinned(message)}
                    style={({ pressed }) => [s.row, index > 0 && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
                  >
                    <PinIcon size={18} color={theme.accent} style={s.pinIcon} />
                    <View style={s.rowBody}>
                      {message.from_name ? <Text style={s.rowSub}>{message.from_name}</Text> : null}
                      <Text style={s.rowTitle} numberOfLines={2}>{message.text || mediaLabel(message.type) || 'Сообщение'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {hasMembers ? (
            <>
              <Text style={s.sectionTitle}>Участники</Text>
              <View style={s.card}>
                {canAdd ? (
                  <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]} onPress={() => setAdding(true)}>
                    <View style={[s.rowIcon, s.addIcon, { backgroundColor: theme.accentSoft }]}>
                      <Ionicons name="person-add" size={17} color={theme.accent} />
                    </View>
                    <Text style={[s.rowTitle, { color: theme.accentText }]}>Добавить участников</Text>
                  </Pressable>
                ) : null}
                {(info.members || []).map((member, index) => (
                  <Pressable
                    key={member.id}
                    style={({ pressed }) => [s.row, (canAdd || index > 0) && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
                    onLongPress={canRemove && !isMe(member) ? () => removeMember(member) : undefined}
                  >
                    <View>
                      <Avatar person={member} id={member.id} size={40} />
                      {member.online ? <View style={[s.online, { backgroundColor: theme.online, borderColor: theme.surface }]} /> : null}
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {fullName(member)}
                        {isMe(member) ? <Text style={s.rowSub}> (вы)</Text> : null}
                      </Text>
                      <Text style={[s.rowSub, member.online && { color: theme.accent }]}>{formatLastSeen(member.online, member.last_seen_at)}</Text>
                    </View>
                    {isGroup && member.role === 'admin' ? <Text style={s.admin}>админ</Text> : null}
                    {canRemove && !isMe(member) ? (
                      <TouchableOpacity onPress={() => removeMember(member)} hitSlop={8} accessibilityLabel={`Убрать: ${fullName(member)}`}>
                        <Ionicons name="remove-circle-outline" size={22} color={theme.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </Pressable>
                ))}
              </View>
              {isObject ? (
                <Text style={s.sectionHint}>
                  В чат автоматически входят мастера бригад, которым объект поставлен в табеле.
                </Text>
              ) : null}

              {isMember ? (
                <View style={[s.card, s.dangerCard]}>
                  <Pressable style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]} onPress={leave}>
                    <Ionicons name="exit-outline" size={20} color={theme.danger} style={s.pinIcon} />
                    <Text style={[s.rowTitle, { color: theme.danger }]}>{isObject ? 'Покинуть чат объекта' : 'Покинуть группу'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
          <StaffPicker
            visible={adding}
            title={isObject ? 'Добавить в чат объекта' : 'Добавить в группу'}
            multiple
            confirmLabel="Добавить"
            excludeIds={(info?.members || []).map((member) => member.id)}
            onClose={() => setAdding(false)}
            onConfirm={(people) => {
              setAdding(false);
              addMembers(people);
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        {/* Окно с полем ввода поднимается над клавиатурой (как общий Dialog) */}
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={() => setRenaming(false)}>
          <Pressable style={s.dialog}>
            <Text style={s.dialogTitle}>Название группы</Text>
            <TextInput
              style={s.dialogInput}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              maxLength={64}
              returnKeyType="done"
              onSubmitEditing={rename}
            />
            <View style={s.dialogButtons}>
              <TouchableOpacity style={[s.dialogButton, { backgroundColor: theme.inputBackground }]} onPress={() => setRenaming(false)}>
                <Text style={[s.dialogButtonText, { color: theme.text }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dialogButton, { backgroundColor: theme.accent }]} onPress={rename}>
                <Text style={[s.dialogButtonText, { color: theme.onAccent }]}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  // Линия под шапкой появляется, когда контент уезжает под неё
  topBarScrolled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  loader: { marginTop: 80 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 12, gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 6 },
  heroSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  heroAction: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.accentSoft },
  heroActionText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  quickRow: { flexDirection: 'row', gap: 10, marginVertical: 10 },
  quick: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.surface },
  quickText: { fontSize: 13, color: theme.accentText, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  sectionHint: { fontSize: 13, color: theme.textMuted, marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
  card: { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  dangerCard: { marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 52 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addIcon: { width: 40, height: 40, borderRadius: 20 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, color: theme.text },
  rowSub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  pinIcon: { width: 24, textAlign: 'center' },
  admin: { fontSize: 12, color: theme.textMuted, marginRight: 4 },
  online: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', paddingHorizontal: 24 },
  dialog: { backgroundColor: theme.sheet, borderRadius: 18, padding: 18 },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 12 },
  dialogInput: { fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dialogButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12 },
  dialogButtonText: { fontSize: 16, fontWeight: '600' },
});
