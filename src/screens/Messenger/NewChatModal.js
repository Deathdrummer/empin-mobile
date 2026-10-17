import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { messengerAPI, timesheetAPI } from '../../services/api';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { fullName, plural, shortName } from '../../utils/chatFormat';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * Выбор сотрудников: один (новый чат) или несколько (группа, добавление в группу).
 * excludeIds — уже выбранные или уже состоящие в группе.
 */
export function StaffPicker({ visible, title, multiple = false, excludeIds = [], confirmLabel = 'Готово', onConfirm, onClose, onPick, onCall, header }) {
  const theme = useTheme();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
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
        const [data, userJson] = await Promise.all([timesheetAPI.getAllStaff(), AsyncStorage.getItem('user')]);
        const myStaffId = userJson ? JSON.parse(userJson)?.staff_id : null;
        const excluded = new Set([myStaffId, ...excludeIds].map(Number));
        if (!cancelled) setStaff((data || []).filter((person) => !excluded.has(Number(person.id))));
      } catch (error) {
        console.warn('[Messenger] Не удалось загрузить сотрудников:', error?.message ?? error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((person) =>
      [person.sname, person.fname, person.mname].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [staff, query]);

  const toggle = (person) => setSelected((current) => (
    current.some((item) => item.id === person.id)
      ? current.filter((item) => item.id !== person.id)
      : [...current, person]
  ));

  const s = styles(theme);

  return (
    <View style={s.flex}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть">
          <Text style={s.headerAction}>Отмена</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {multiple ? (
          <TouchableOpacity onPress={() => onConfirm(selected)} disabled={!selected.length} hitSlop={12}>
            <Text style={[s.headerAction, s.headerActionStrong, !selected.length && { opacity: 0.4 }]}>{confirmLabel}</Text>
          </TouchableOpacity>
        ) : <View style={s.headerSpacer} />}
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Поиск сотрудника"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {multiple && selected.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.selectedScroll} contentContainerStyle={s.selected}>
          {selected.map((person) => (
            <Pressable key={person.id} style={s.selectedChip} onPress={() => toggle(person)}>
              <Avatar person={person} id={person.id} size={24} />
              <Text style={s.selectedName}>{shortName(person)}</Text>
              <Ionicons name="close" size={14} color={theme.accentText} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {header}

      {loading ? (
        <ActivityIndicator style={s.loader} color={theme.accent} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>Никого не нашли</Text>}
          renderItem={({ item }) => {
            const checked = selected.some((person) => person.id === item.id);
            return (
              <Pressable
                style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
                onPress={() => (multiple ? toggle(item) : onPick(item))}
              >
                <Avatar person={item} id={item.id} size={44} />
                <View style={s.rowBody}>
                  <View style={s.rowText}>
                    <Text style={s.name} numberOfLines={1}>{fullName(item)}</Text>
                    {item.mname ? <Text style={s.sub} numberOfLines={1}>{`${item.fname ?? ''} ${item.mname}`.trim()}</Text> : null}
                  </View>
                  {multiple ? (
                    <View style={[s.check, checked && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                      {checked ? <Ionicons name="checkmark" size={16} color={theme.onAccent} /> : null}
                    </View>
                  ) : onCall ? (
                    <TouchableOpacity
                      onPress={() => onCall(item)}
                      hitSlop={8}
                      style={s.callButton}
                      accessibilityLabel={`Позвонить: ${fullName(item)}`}
                    >
                      <Ionicons name="call-outline" size={22} color={theme.accent} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

/** Новый чат или новая группа: выбор сотрудника, для группы — участники и название */
export default function NewChatModal({ visible, onClose, onOpenChat, onCall, onGroupCreated }) {
  const theme = useTheme();
  const [step, setStep] = useState('chat');
  const [members, setMembers] = useState([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('chat');
      setMembers([]);
      setTitle('');
    }
  }, [visible]);

  const createGroup = async () => {
    const name = title.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const data = await messengerAPI.createGroup(name, members.map((person) => person.id));
      onGroupCreated({ chatId: data.chat_id, title: name });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось создать группу', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setCreating(false);
    }
  };

  const s = styles(theme);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        {step === 'chat' ? (
          <StaffPicker
            visible={visible && step === 'chat'}
            title="Новый чат"
            onClose={onClose}
            onPick={onOpenChat}
            onCall={onCall}
            header={(
              <Pressable style={({ pressed }) => [s.row, s.newGroup, pressed && { backgroundColor: theme.surfacePressed }]} onPress={() => setStep('members')}>
                <View style={[s.newGroupIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="people" size={22} color={theme.accent} />
                </View>
                <View style={s.rowBody}>
                  <View style={s.rowText}>
                    <Text style={[s.name, { color: theme.accentText }]}>Новая группа</Text>
                    <Text style={s.sub}>Бригада, объект или общий чат</Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        ) : null}

        {step === 'members' ? (
          <StaffPicker
            visible={visible && step === 'members'}
            title="Участники"
            multiple
            confirmLabel="Далее"
            onClose={() => setStep('chat')}
            onConfirm={(people) => {
              setMembers(people);
              setStep('title');
            }}
          />
        ) : null}

        {step === 'title' ? (
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setStep('members')} hitSlop={12}>
                <Text style={s.headerAction}>Назад</Text>
              </TouchableOpacity>
              <Text style={s.title}>Новая группа</Text>
              <TouchableOpacity onPress={createGroup} disabled={!title.trim() || creating} hitSlop={12}>
                {creating ? <ActivityIndicator color={theme.accent} /> : (
                  <Text style={[s.headerAction, s.headerActionStrong, !title.trim() && { opacity: 0.4 }]}>Создать</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.titleRow}>
              <View style={[s.groupMark, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="people" size={28} color={theme.accent} />
              </View>
              <TextInput
                style={s.titleInput}
                placeholder="Название, например «Бригада Иванова»"
                placeholderTextColor={theme.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus
                maxLength={64}
                returnKeyType="done"
                onSubmitEditing={createGroup}
              />
            </View>

            <Text style={s.sectionTitle}>
              {`${members.length} ${plural(members.length, 'участник', 'участника', 'участников')}`}
            </Text>
            <FlatList
              data={members}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={s.row}>
                  <Avatar person={item} id={item.id} size={40} />
                  <View style={s.rowBody}>
                    <Text style={s.name} numberOfLines={1}>{fullName(item)}</Text>
                  </View>
                </View>
              )}
            />
          </KeyboardAvoidingView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
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
  headerActionStrong: { fontWeight: '700', textAlign: 'right' },
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
  selectedScroll: { flexGrow: 0 },
  selected: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: 16,
    backgroundColor: theme.accentSoft,
  },
  selectedName: { fontSize: 14, color: theme.accentText, fontWeight: '500' },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: theme.textSecondary, fontSize: 15 },
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
  callButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  newGroup: { paddingVertical: 6 },
  newGroupIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  groupMark: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  titleInput: {
    flex: 1,
    fontSize: 17,
    color: theme.text,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.accent,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});
