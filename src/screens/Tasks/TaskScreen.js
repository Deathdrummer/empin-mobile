import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import {
  cachedTask, emitTasksChanged, forgetTask, productionAPI, saveTask, setCopiedTask, useToday,
} from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import {
  describeHistoryEntry, executorSubtitle, executorTitle, formatDayShort, formatQuantity, formatReadiness, formatStamp,
  isOfflineError, objectTitle, relativeDayLabel, shortName, vehicleTitle,
} from '../../utils/tasks';
import { PickerSheet } from './PickerSheet';

/**
 * Карточка задания (п. 6.4): объект с готовностью, дата, исполнитель, создатель, содержание, виды работ, техника
 * и водитель, участники (право 7), история изменений и исполнителей. Действия — только при праве и при связи.
 * Без связи открывается последняя загруженная версия (п. 9.1).
 */
export default function TaskScreen({ navigation, route }) {
  const { taskId, task: preview } = route.params || {};
  const theme = useTheme();
  const s = styles(theme);
  const [task, setTask] = useState(preview || null);
  const [invites, setInvites] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState(preview ? 'preview' : 'loading');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [staff, setStaff] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const today = useToday();

  const apply = useCallback((data) => {
    setTask(data.task);
    setInvites(data.invites ?? null);
    setHistory(data.history || []);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await productionAPI.task(taskId);
      apply(data);
      setState('ready');
      saveTask(taskId, data);
    } catch (error) {
      if (error?.response?.status === 404) {
        forgetTask(taskId);
        setState('gone');
        return;
      }
      const saved = await cachedTask(taskId);
      if (saved) apply(saved);
      setState(saved || preview ? 'offline' : 'failed');
    }
  }, [taskId, apply, preview]);

  // Возврат из формы — задание могло измениться
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const offline = state === 'offline';
  const abilities = task?.abilities || {};
  const canAct = state === 'ready';

  const showError = (title, error, offlineText) => Toast.show({
    type: 'error',
    text1: title,
    text2: isOfflineError(error) ? offlineText : getUserFacingError(error, 'Попробуйте ещё раз.'),
    position: 'top',
  });

  const copy = () => {
    setCopiedTask(task);
    Toast.show({ type: 'success', text1: 'Задание скопировано', text2: 'Откройте нужный день и нажмите «Вставить»', position: 'top' });
  };

  const remove = async () => {
    setBusy(true);
    try {
      await productionAPI.deleteTask(task.id);
      forgetTask(task.id);
      emitTasksChanged([task.date]);
      setDeleting(false);
      navigation.goBack();
    } catch (error) {
      showError('Не удалось удалить', error, 'Удалить задание можно только при связи');
    } finally {
      setBusy(false);
    }
  };

  const openInvite = async () => {
    setInviting(true);
    if (staff) return;
    try {
      setStaff((await productionAPI.executors()).staff || []);
    } catch (error) {
      setInviting(false);
      showError('Не удалось загрузить сотрудников', error, 'Пригласить можно только при связи');
    }
  };

  const invite = async (person) => {
    setInviting(false);
    setBusy(true);
    try {
      const data = await productionAPI.invite(task.id, person.id);
      setInvites(data.invites || []);
      load();
    } catch (error) {
      showError('Не удалось пригласить', error, 'Пригласить можно только при связи');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (person) => {
    setBusy(true);
    try {
      const data = await productionAPI.revokeInvite(task.id, person.id);
      setInvites(data.invites || []);
      load();
    } catch (error) {
      showError('Не удалось отозвать', error, 'Отозвать приглашение можно только при связи');
    } finally {
      setBusy(false);
    }
  };

  const invitedIds = useMemo(() => new Set((invites || []).map((item) => Number(item.staff?.id))), [invites]);
  const staffSections = useMemo(() => [{
    key: 'staff',
    title: null,
    data: (staff || [])
      .filter((person) => !invitedIds.has(Number(person.id)))
      .map((person) => ({ key: person.id, id: person.id, title: person.name, subtitle: person.position, search: person.name })),
  }], [staff, invitedIds]);

  const topBar = (
    <View style={[s.topBar, scrolled && s.topBarScrolled]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
        <Ionicons name="chevron-back" size={28} color={theme.accent} />
      </Pressable>
      <Text style={s.topTitle}>Задание</Text>
      <View style={s.back}>{busy ? <ActivityIndicator color={theme.accent} /> : null}</View>
    </View>
  );

  if (!task) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        {topBar}
        {state === 'loading' ? <ActivityIndicator style={s.loader} size="large" color={theme.accent} /> : (
          <View style={s.stub}>
            <Ionicons name={state === 'gone' ? 'lock-closed-outline' : 'cloud-offline-outline'} size={44} color={theme.textMuted} />
            <Text style={s.stubText}>
              {state === 'gone' ? 'Задание удалено или у вас больше нет к нему доступа' : 'Нет связи, а это задание ещё не загружалось'}
            </Text>
            {state !== 'gone' ? (
              <TouchableOpacity onPress={() => { setState('loading'); load(); }} style={s.heroAction}>
                <Text style={s.heroActionText}>Повторить</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    );
  }

  const { object, executor, creator, vehicle, driver, works } = task;
  const readiness = formatReadiness(object?.readiness);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {topBar}
      <ScrollView
        contentContainerStyle={s.content}
        scrollEventThrottle={32}
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 4)}
      >
        {state === 'gone' ? (
          <View style={s.notice}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
            <Text style={s.noticeText}>Задание удалено или у вас больше нет к нему доступа</Text>
          </View>
        ) : null}
        {offline ? (
          <View style={s.notice}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} />
            <Text style={s.noticeText}>Нет связи — показана сохранённая версия. Изменять задание можно только при связи.</Text>
          </View>
        ) : null}

        <View style={s.hero}>
          {object?.number ? <Text style={s.heroNumber}>{object.number}</Text> : null}
          <Text style={s.heroTitle}>{object?.title || 'Объект'}</Text>
          {object?.titul ? <Text style={s.heroSub}>{object.titul}</Text> : null}
        </View>

        <View style={s.card}>
          <InfoRow s={s} theme={theme} icon="location" color="#5B6B8C" title={object?.locality || 'Расположение не указано'} subtitle="Расположение" />
          <InfoRow
            s={s}
            theme={theme}
            border
            icon="person"
            color="#2F8A6C"
            title={object?.responsible?.name ? shortName(object.responsible.name) : 'Не назначен'}
            subtitle="Ответственный начальник участка"
          />
          <InfoRow s={s} theme={theme} border icon="speedometer" color="#C46A1B" title={readiness || 'Не задана'} subtitle="Утверждённая готовность объекта" />
        </View>

        <View style={s.card}>
          <InfoRow s={s} theme={theme} icon="calendar" color={theme.accent} title={relativeDayLabel(task.date, today)} subtitle={formatDayShort(task.date, today)} />
          <InfoRow
            s={s}
            theme={theme}
            border
            icon={executor?.type === 'brigade' ? 'people' : 'person'}
            color="#1F7FA8"
            title={executorTitle(executor)}
            subtitle={executorSubtitle(executor)}
          />
          <InfoRow s={s} theme={theme} border icon="create" color="#8A5BB0" title={creator?.name ? shortName(creator.name) : 'Не указан'} subtitle="Создатель задания" />
        </View>

        <Text style={s.sectionTitle}>Задание</Text>
        <View style={[s.card, s.cardNoGap]}>
          <Text style={[s.taskText, !task.text && s.muted]}>{task.text || 'Текст не задан'}</Text>
        </View>

        {works?.length ? (
          <>
            <Text style={s.sectionTitle}>Виды работ</Text>
            <View style={[s.card, s.cardNoGap]}>
              {works.map((work, index) => (
                <View key={work.work_type_id} style={[s.row, index > 0 && s.rowBorder]}>
                  <Text style={[s.rowTitle, s.flex]}>{work.name || 'Вид работ'}</Text>
                  <Text style={s.quantity}>{formatQuantity(work.quantity, work.unit)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {vehicle ? (
          <>
            <Text style={s.sectionTitle}>Техника</Text>
            <View style={[s.card, s.cardNoGap]}>
              <InfoRow s={s} theme={theme} icon="car" color="#4E7A2B" title={vehicleTitle(vehicle)} subtitle="Машина" />
              <InfoRow
                s={s}
                theme={theme}
                border
                icon="person"
                color="#4E7A2B"
                title={driver?.name ? shortName(driver.name) : 'Без водителя'}
                subtitle={driver && driver.assigned === false ? 'Водитель не закреплён за этой машиной' : 'Водитель'}
                warning={driver && driver.assigned === false}
              />
            </View>
          </>
        ) : null}

        {invites !== null ? (
          <>
            <Text style={s.sectionTitle}>Приглашённые в задание</Text>
            <View style={[s.card, s.cardNoGap]}>
              {invites.map((item, index) => (
                <View key={item.staff?.id} style={[s.row, index > 0 && s.rowBorder]}>
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle}>{shortName(item.staff?.name) || 'Сотрудник'}</Text>
                    <Text style={s.rowSub}>{`Пригласил ${shortName(item.invited_by?.name)}, ${formatStamp(item.invited_at)}`}</Text>
                  </View>
                  {canAct ? (
                    <TouchableOpacity onPress={() => revoke(item.staff)} hitSlop={8} accessibilityLabel={`Отозвать приглашение: ${item.staff?.name}`}>
                      <Ionicons name="remove-circle" size={24} color={theme.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {canAct ? (
                <Pressable
                  style={({ pressed }) => [s.row, invites.length > 0 && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
                  onPress={openInvite}
                >
                  <View style={[s.rowIcon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons name="person-add" size={16} color={theme.accentText} />
                  </View>
                  <Text style={[s.rowTitle, { color: theme.accentText }]}>Пригласить</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={s.sectionHint}>Приглашённый видит только это задание и может писать в переписку.</Text>
          </>
        ) : null}

        {history.length ? (
          <>
            <Text style={s.sectionTitle}>История</Text>
            <View style={[s.card, s.cardNoGap]}>
              {history.map((entry, index) => {
                const item = describeHistoryEntry(entry, today);
                return (
                  <View key={entry.id} style={[s.historyRow, index > 0 && s.rowBorder]}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    {item.details.map((line) => <Text key={line} style={s.historyDetail}>{line}</Text>)}
                    <Text style={s.rowSub}>{`${item.actor}, ${formatStamp(entry.at)}`}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {canAct && (abilities.copy || abilities.edit) ? (
          <View style={[s.card, s.actionsCard]}>
            {abilities.copy ? (
              <ActionRow s={s} theme={theme} icon="copy-outline" title="Копировать" subtitle="Объект и исполнитель — на другой день" onPress={copy} />
            ) : null}
            {abilities.edit ? (
              <ActionRow
                s={s}
                theme={theme}
                border={abilities.copy}
                icon="create-outline"
                title="Изменить"
                onPress={() => navigation.navigate('TaskForm', { task })}
              />
            ) : null}
          </View>
        ) : null}

        {canAct && abilities.delete ? (
          <View style={[s.card, s.actionsCard]}>
            <ActionRow s={s} theme={theme} icon="trash-outline" title="Удалить задание" danger onPress={() => setDeleting(true)} />
          </View>
        ) : null}
      </ScrollView>

      <PickerSheet
        visible={inviting}
        title="Пригласить в задание"
        sections={staffSections}
        loading={inviting && !staff}
        searchPlaceholder="Фамилия или имя"
        emptyText="Некого пригласить"
        onSelect={invite}
        onClose={() => setInviting(false)}
      />

      <Dialog
        visible={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить задание?"
        message={`${objectTitle(object)}. Задание удалится вместе с перепиской.`}
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setDeleting(false)} />
            <DialogButton title="Удалить" variant="danger" onPress={remove} loading={busy} />
          </>
        )}
      />
    </SafeAreaView>
  );
}

const InfoRow = ({ s, theme, icon, color, title, subtitle, border, warning }) => (
  <View style={[s.row, border && s.rowBorder]}>
    <View style={[s.rowIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={16} color="#FFFFFF" />
    </View>
    <View style={s.rowBody}>
      <Text style={s.rowTitle}>{title}</Text>
      {subtitle ? <Text style={[s.rowSub, warning && { color: theme.accentText }]}>{subtitle}</Text> : null}
    </View>
    {warning ? <Ionicons name="warning" size={18} color={theme.accentText} /> : null}
  </View>
);

const ActionRow = ({ s, theme, icon, title, subtitle, onPress, border, danger }) => (
  <Pressable style={({ pressed }) => [s.row, border && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]} onPress={onPress}>
    <Ionicons name={icon} size={22} color={danger ? theme.danger : theme.accent} style={s.actionIcon} />
    <View style={s.rowBody}>
      <Text style={[s.rowTitle, { color: danger ? theme.danger : theme.accentText }]}>{title}</Text>
      {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
    </View>
  </Pressable>
);

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  topBarScrolled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  loader: { marginTop: 80 },
  stub: { alignItems: 'center', gap: 12, paddingHorizontal: 32, marginTop: 80 },
  stubText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 21 },
  heroAction: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.accentSoft },
  heroActionText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: theme.fill, marginTop: 8 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  hero: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  heroNumber: { fontSize: 15, fontWeight: '700', color: theme.accentText },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  sectionHint: { fontSize: 13, color: theme.textMuted, marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
  card: { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  cardNoGap: { marginTop: 0 },
  actionsCard: { marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 52 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, color: theme.text },
  rowSub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  flex: { flex: 1 },
  muted: { color: theme.textMuted },
  quantity: { fontSize: 15, fontWeight: '600', color: theme.text },
  taskText: { fontSize: 16, lineHeight: 22, color: theme.text, padding: 14 },
  historyRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  historyDetail: { fontSize: 14, color: theme.text },
  actionIcon: { width: 30, textAlign: 'center' },
});
