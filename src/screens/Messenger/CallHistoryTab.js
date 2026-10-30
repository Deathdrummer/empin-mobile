import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messengerAPI } from '../../services/api';
import { useCallContext } from '../../contexts/CallContext';
import { useAfterModalClose } from '../../hooks/useAfterModalClose';
import { StaffPicker } from './NewChatModal';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/chat/Avatar';
import { useTabBarHeight } from '../../components/TabBar';
import { formatDateSeparator, formatDuration, formatMessageTime, fullName, isSameDay } from '../../utils/chatFormat';

// Входящий без ответа: звонящий отменил, не ответили по таймауту или звонок завис в вызове
const MISSED_INCOMING = ['missed', 'cancelled', 'initiated', 'ringing'];

const describeCall = (call, myStaffId) => {
  const outgoing = myStaffId != null && Number(call.caller_id) === Number(myStaffId);
  const peer = outgoing ? call.callee : call.caller;
  const missed = !outgoing && MISSED_INCOMING.includes(call.status);

  let detail;
  if (call.status === 'completed' && call.duration) detail = formatDuration(call.duration);
  else if (call.status === 'rejected') detail = outgoing ? 'отклонён' : 'вы отклонили';
  else if (missed) detail = 'пропущенный';
  else if (outgoing) detail = 'без ответа';
  else detail = '';

  return { outgoing, peer, missed, detail };
};

export default function CallHistoryTab() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { initiateCall } = useCallContext();
  const tabBarHeight = useTabBarHeight();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myStaffId, setMyStaffId] = useState(null);
  const [onlyMissed, setOnlyMissed] = useState(false);
  // «Новый звонок» — сотрудник, которому ещё не звонили (как кнопка в журнале звонков Telegram)
  const [picking, setPicking] = useState(false);
  const { closeThen, onDismiss: onPickerDismiss } = useAfterModalClose();
  // Экран звонка — после закрытия окна выбора: на iOS иначе он не появится (см. useAfterModalClose)
  const callPicked = (person) => closeThen(
    () => setPicking(false),
    () => initiateCall(person.id, fullName(person), person.avatar),
  );

  const load = useCallback(async () => {
    try {
      const [data, userJson] = await Promise.all([messengerAPI.getCallHistory(), AsyncStorage.getItem('user')]);
      setMyStaffId(userJson ? JSON.parse(userJson)?.staff_id ?? null : null);
      setCalls(data.calls || []);
    } catch (error) {
      console.warn('[Calls] Не удалось загрузить историю:', error?.message ?? error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const sections = useMemo(() => {
    const list = calls
      .map((call) => ({ call, ...describeCall(call, myStaffId) }))
      .filter((item) => item.peer && (!onlyMissed || item.missed));

    const result = [];
    list.forEach((item) => {
      const last = result[result.length - 1];
      if (last && isSameDay(last.data[0].call.created_at, item.call.created_at)) last.data.push(item);
      else result.push({ title: formatDateSeparator(item.call.created_at), data: [item] });
    });
    return result;
  }, [calls, myStaffId, onlyMissed]);

  const s = styles(theme);

  const renderItem = ({ item }) => {
    const name = fullName(item.peer);
    return (
      <Pressable
        style={({ pressed }) => [s.row, pressed && { backgroundColor: theme.surfacePressed }]}
        onPress={() => navigation.navigate('Chat', { staffId: item.peer.id, staffName: name })}
        accessibilityLabel={`${name}, ${item.outgoing ? 'исходящий' : 'входящий'}, ${item.detail}`}
      >
        <Avatar person={item.peer} id={item.peer.id} size={46} />
        <View style={s.rowBody}>
          <View style={s.rowText}>
            <Text style={[s.name, item.missed && { color: theme.danger }]} numberOfLines={1}>{name}</Text>
            <View style={s.meta}>
              <Ionicons
                name={item.outgoing ? 'arrow-up-outline' : 'arrow-down-outline'}
                size={14}
                color={item.missed ? theme.danger : theme.textSecondary}
                style={{ transform: [{ rotate: '45deg' }] }}
              />
              <Text style={s.metaText} numberOfLines={1}>
                {[formatMessageTime(item.call.created_at), item.detail].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => initiateCall(item.peer.id, name, item.peer.avatar)}
            hitSlop={8}
            style={s.callButton}
            accessibilityLabel={`Позвонить: ${name}`}
          >
            <Ionicons name="call-outline" size={22} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Звонки</Text>
        <TouchableOpacity
          onPress={() => setPicking(true)}
          hitSlop={10}
          style={s.headerButton}
          accessibilityLabel="Новый звонок"
        >
          <MaterialCommunityIcons name="phone-plus-outline" size={25} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={s.filters}>
        {[{ key: false, label: 'Все' }, { key: true, label: 'Пропущенные' }].map((filter) => {
          const active = onlyMissed === filter.key;
          return (
            <TouchableOpacity
              key={String(filter.key)}
              onPress={() => setOnlyMissed(filter.key)}
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
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => String(item.call.id ?? index)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[sections.length ? null : s.emptyContainer, { paddingBottom: tabBarHeight + 12 }]}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          )}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Ionicons name="call-outline" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{onlyMissed ? 'Пропущенных нет' : 'Звонков пока не было'}</Text>
              {!onlyMissed ? <Text style={s.emptyText}>Позвонить можно кнопкой вверху, из чата или списка сотрудников</Text> : null}
            </View>
          )}
        />
      )}

      <Modal
        visible={picking}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(false)}
        onDismiss={onPickerDismiss}
      >
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
          <StaffPicker
            visible={picking}
            title="Новый звонок"
            onClose={() => setPicking(false)}
            onPick={callPicked}
            onCall={callPicked}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: theme.text, letterSpacing: 0.2 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.surfaceAlt },
  chipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  loader: { marginTop: 48 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, gap: 12 },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: theme.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 14, color: theme.textSecondary, flexShrink: 1 },
  callButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
});
