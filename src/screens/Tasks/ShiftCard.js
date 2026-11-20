import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { DialogButton } from '../../components/ui/Dialog';
import { PickerSheet } from './PickerSheet';
import {
  loadAttendanceToday, serverNow, submitAttendance, subscribeAttendanceResult, useAttendanceOutbox, useAttendanceToday,
} from '../../services/attendance';
import { getToday } from '../../services/production';
import { crewText, dayState, markChoices, markedBrigade, markTitle, markWindowOpen, outboxDay } from '../../utils/attendance';
import { shortName } from '../../utils/tasks';
import { getUserFacingError } from '../../utils/userFacingError';

/**
 * Плашка «Выход на смену» на экране текущего дня (п. 7.4): кнопка «Выйти на смену» с 05:00 до 10:00, после отметки —
 * «Вы отметились» и видимый состав бригады; «Заявить состав» — по праву 16. Без связи отметка и заявка уходят позже
 */
export const ShiftCard = ({ staffId, refreshKey = 0 }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  // «Сегодня» — на каждой отрисовке (раз в 30 с — по таймеру): после полуночи плашка переходит на новый день сама
  const today = getToday();
  const saved = useAttendanceToday();
  const state = dayState(saved, today);
  const outbox = useAttendanceOutbox(staffId).filter((item) => outboxDay(item) === today);
  const [busy, setBusy] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [declaring, setDeclaring] = useState(null);
  const [crewBrigade, setCrewBrigade] = useState(null);
  const [selected, setSelected] = useState([]);
  const [, setTick] = useState(0);

  const reload = useCallback(() => (staffId ? loadAttendanceToday(staffId) : null), [staffId]);
  useEffect(() => { reload(); }, [reload, refreshKey]);
  // Состояние за прошлый день — обновить (без связи останется сохранённое, но без вчерашней отметки)
  useEffect(() => {
    if (saved?.date && saved.date !== today) reload();
  }, [saved?.date, today, reload]);
  useEffect(() => subscribeAttendanceResult((item, result, error) => {
    if (error) Toast.show({ type: 'error', text1: item.kind === 'crew' ? 'Заявка состава не принята' : 'Отметка не принята', text2: error, position: 'top' });
    reload();
  }), [reload]);
  // Окно 05:00–10:00 открывается и закрывается само, пока экран открыт
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const pendingMark = outbox.find((item) => item.kind === 'mark');
  const pendingCrew = outbox.find((item) => item.kind === 'crew');
  const mark = state?.mark || (pendingMark ? pendingMarkOf(pendingMark, state) : null);
  const brigade = markedBrigade(state) || (mark?.brigade_id ? (state?.brigades || []).find((b) => b.id === mark.brigade_id) : null);
  const open = markWindowOpen(state, serverNow().getTime());
  const choices = useMemo(() => markChoices(state), [state]);

  if (!state?.eligible || state.staffId !== staffId) return null;

  const sendMark = async (choice) => {
    setChoosing(false);
    setBusy('mark');
    try {
      const result = await submitAttendance({ kind: 'mark', body: choice.body, staffId, date: today });
      if (result.data) reload();
      else Toast.show({ type: 'info', text1: 'Вы отметились', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Отметка не принята', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(null);
    }
  };

  const pressMark = () => {
    if (choices.length > 1) setChoosing(true);
    else if (choices.length === 1) sendMark(choices[0]);
  };

  const ownBrigades = state.brigades || [];
  const startDeclare = () => {
    if (!ownBrigades.length) {
      Toast.show({ type: 'error', text1: 'Вы не член бригады', position: 'top' });
      return;
    }
    if (ownBrigades.length > 1) setCrewBrigade('choose');
    else openDeclare(ownBrigades[0]);
  };

  const openDeclare = (target) => {
    setCrewBrigade(null);
    setSelected(target.declared?.staff_ids || target.members.filter((m) => m.marked).map((m) => m.id));
    setDeclaring(target);
  };

  const sendCrew = async () => {
    const target = declaring;
    setBusy('crew');
    try {
      const result = await submitAttendance({ kind: 'crew', body: { brigade_id: target.id, staff_ids: selected }, staffId, date: today });
      setDeclaring(null);
      if (result.data) reload();
      else Toast.show({ type: 'info', text1: 'Состав заявлен', position: 'top' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Заявка состава не принята', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (item) => setSelected((ids) => (ids.includes(item.key) ? ids.filter((id) => id !== item.key) : [...ids, item.key]));

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name={mark ? 'checkmark-circle' : 'time'} size={18} color={theme.accentText} />
        </View>
        <View style={s.body}>
          <Text style={s.title}>Выход на смену</Text>
          {mark ? (
            <View style={s.line}>
              <Text style={s.text}>{`Вы отметились${markTitle(mark) ? ` · ${markTitle(mark)}` : ''}`}</Text>
              {mark.pending || state.offline ? <Ionicons name="cloud-offline-outline" size={14} color={theme.textSecondary} /> : null}
            </View>
          ) : (
            <Text style={s.text}>{`${state.window.from}–${state.window.to}`}</Text>
          )}
          {brigade && brigade.crew?.length ? <Text style={s.text}>{`Состав: ${crewText(brigade.crew)}`}</Text> : null}
          {brigade?.confirmed ? (
            <Text style={s.meta}>{`Подтверждено: ${shortName(brigade.confirmed.by?.name)}`}</Text>
          ) : brigade?.declared ? (
            <Text style={s.meta}>{`Заявил состав: ${shortName(brigade.declared.by?.name)}`}</Text>
          ) : null}
        </View>
      </View>
      {!mark || state.can_declare ? (
        <View style={s.buttons}>
          {!mark ? (
            <DialogButton title="Выйти на смену" variant="primary" onPress={pressMark} disabled={!open} loading={busy === 'mark'} />
          ) : null}
          {state.can_declare ? (
            <DialogButton
              title={pendingCrew ? 'Состав заявлен' : 'Заявить состав'}
              onPress={startDeclare}
              disabled={ownBrigades.length > 0 && ownBrigades.every((b) => b.confirmed)}
              loading={busy === 'crew'}
            />
          ) : null}
        </View>
      ) : null}

      <PickerSheet
        visible={choosing}
        title="Выход на смену"
        sections={[{ key: 'choices', title: null, data: choices.map((choice) => ({ key: choice.key, title: choice.title, choice })) }]}
        onSelect={(item) => sendMark(item.choice)}
        onClose={() => setChoosing(false)}
      />
      <PickerSheet
        visible={crewBrigade === 'choose'}
        title="Бригада"
        sections={[{ key: 'brigades', title: null, data: ownBrigades.filter((b) => !b.confirmed).map((b) => ({ key: b.id, title: b.name, brigade: b })) }]}
        onSelect={(item) => openDeclare(item.brigade)}
        onClose={() => setCrewBrigade(null)}
      />
      <PickerSheet
        visible={!!declaring}
        title="Заявить состав"
        sections={declaring ? [{
          key: 'members',
          title: declaring.name,
          data: declaring.members.map((member) => ({
            key: member.id,
            title: member.name,
            subtitle: member.marked ? 'Отметился' : null,
            selected: selected.includes(member.id),
          })),
        }] : []}
        searchPlaceholder="Фамилия или имя"
        emptyText="Нет членов бригады"
        onSelect={toggle}
        onClose={() => setDeclaring(null)}
        footer={(
          <View style={s.sheetFooter}>
            <DialogButton title="Заявить" variant="primary" onPress={sendCrew} loading={busy === 'crew'} />
          </View>
        )}
      />
    </View>
  );
};

/** Отметка в очереди без связи: как будет показана, пока не дошла до сервера */
const pendingMarkOf = (item, state) => {
  const asDriver = !!item.body?.as_driver || !(state?.brigades || []).length;
  const brigade = asDriver ? null : (state?.brigades || []).find((b) => b.id === item.body?.brigade_id) || (state?.brigades || [])[0];
  return { as_driver: asDriver, brigade_id: brigade?.id ?? null, brigade_name: brigade?.name ?? null, pending: true };
};

const makeStyles = (theme) => StyleSheet.create({
  card: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.accentSoft,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    marginTop: 1,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: theme.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: 10 },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, flexDirection: 'row' },
});
