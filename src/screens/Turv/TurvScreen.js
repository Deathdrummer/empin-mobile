import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { PickerSheet } from '../Tasks/PickerSheet';
import { productionAPI, subscribeAccessChanged, useToday } from '../../services/production';
import { exportTurv, turvAPI } from '../../services/turv';
import { canCorrectCell, cellText, createOrderSaver, isWeekend, monthOf, monthTitle, moveRow, moveSection, orderOf, shiftMonth } from '../../utils/turv';
import { formatDayShort, isOfflineError, shortName } from '../../utils/tasks';
import { getUserFacingError } from '../../utils/userFacingError';

const NAME_WIDTH = 150;
const ORDER_WIDTH = 66;
const CELL = 32;
const TOTAL = 48;
const ROW = 40;
const SECTION = 40;
const HEAD = 36;
const REFRESH_MS = 60000;

/**
 * ТУРВ (ТЗ, раздел 7; п. 7.4): месяц как таблица Excel — разделы бригад, «Водители», персональный; «Р» / пусто / «—»;
 * итог дней по строке. Право 18 — исправление ячейки; «Изменить порядок» — бригады и строки; выгрузка XLSX и PDF
 */
export default function TurvScreen({ navigation }) {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const today = useToday();
  // Каждое открытие — текущий месяц (инт. 8.40, 8.66)
  const [month, setMonth] = useState(monthOf(today));
  const [table, setTable] = useState(null);
  const [state, setState] = useState('loading');
  const [ordering, setOrdering] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(null);
  const [staff, setStaff] = useState(null);
  const savedOrder = useRef(null);
  const saver = useRef(null);
  const left = useRef(null);
  const right = useRef(null);

  // Порядок сохраняется после каждой перестановки, по одному запросу; ошибка — молча вернуть сохранённый (инт. 8.53, 8.54, 8.68)
  if (!saver.current) {
    saver.current = createOrderSaver((next) => turvAPI.order(orderOf(next)), {
      onSaved: (next) => { savedOrder.current = next; },
      onFailed: () => setTable((t) => (t ? { ...t, sections: savedOrder.current || t.sections } : t)),
    });
  }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState('loading');
    try {
      const data = await turvAPI.month(month);
      // Тихое обновление не перебивает перестановку, которая ещё сохраняется
      if (quiet && saver.current.pending) return;
      setTable(data);
      savedOrder.current = data.sections;
      setState('ready');
    } catch {
      // Неполный табель не показывается; уже загруженный остаётся без предупреждений (инт. 8.59, 8.62–8.64)
      if (!quiet) setState('failed');
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  // Права или состав бригад изменились в ERP — табель сразу по новым правам (ИС-СМ-13)
  useEffect(() => subscribeAccessChanged(() => load(true)), [load]);
  // Пока экран открыт — тихо обновлять: табель всегда по актуальным данным (П-СМ-27, инт. 8.60)
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => load(true), REFRESH_MS);
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') load(true); });
    return () => { clearInterval(timer); sub.remove(); setOrdering(false); };
  }, [load]));

  const sections = table?.sections || [];
  const dates = table?.dates || [];

  const reorder = (next) => {
    setTable((t) => ({ ...t, sections: next }));
    saver.current.push(next);
  };

  const openCell = (section, row, date, code) => {
    if (ordering || !canCorrectCell(section, date.date, code)) return;
    setNotify(false);
    setEditing({ section, row, date, present: code !== 'R' });
  };

  const saveCell = async () => {
    const { section, row, date, present } = editing;
    setBusy(true);
    try {
      const data = await turvAPI.cell({
        kind: section.type === 'drivers' ? 'driver' : 'brigade',
        brigade_id: section.brigade_id,
        staff_id: row.staff_id,
        date: date.date,
        present,
        notify,
      });
      setTable(data);
      savedOrder.current = data.sections;
      setEditing(null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не исправлено', text2: isOfflineError(error) ? 'Нет связи' : getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setBusy(false);
    }
  };

  const startAdd = async (section) => {
    setAdding(section);
    if (!staff) {
      try {
        setStaff((await productionAPI.executors()).staff || []);
      } catch {
        setStaff([]);
      }
    }
  };

  // Выход сотруднику, которого ещё нет в строках раздела (право 18 без ограничений по бригадам)
  const addRow = (item) => {
    const section = adding;
    setAdding(null);
    if (section.rows.some((row) => row.staff_id === item.key)) return;
    const row = { staff_id: item.key, name: item.title, cells: dates.map((d) => (section.correct_dates.includes(d.date) ? '' : '-')), total: 0 };
    setTable((t) => ({ ...t, sections: t.sections.map((x) => (x.key === section.key ? { ...x, rows: [...x.rows, row], empty: false } : x)) }));
  };

  const doExport = async (format) => {
    setExporting(false);
    try {
      await exportTurv(month, format, orderOf(sections));
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось выгрузить табель', text2: 'Попробуйте ещё раз.', position: 'top' });
    }
  };

  // Вертикальная прокрутка — общая; горизонтальная — только дни, ФИО слева остаются на месте
  const renderLeft = () => (
    <View style={{ width: NAME_WIDTH + (ordering ? ORDER_WIDTH : 0) }}>
      <View style={[s.head, s.nameCell]}><Text style={s.headText}>Сотрудник</Text></View>
      {sections.map((section) => (
        <React.Fragment key={section.key}>
          <View style={[s.section, s.nameCell]}>
            <Text style={s.sectionText} numberOfLines={1}>{section.title}</Text>
            {ordering && section.type === 'brigade' ? <Arrows s={s} theme={theme} onMove={(delta) => reorder(moveSection(sections, section.key, delta))} /> : null}
            {!ordering && section.can_add_staff ? (
              <TouchableOpacity onPress={() => startAdd(section)} hitSlop={8} accessibilityLabel="Добавить сотрудника">
                <Ionicons name="person-add-outline" size={18} color={theme.accentText} />
              </TouchableOpacity>
            ) : null}
          </View>
          {section.empty ? (
            <View style={[s.row, s.nameCell]}><Text style={s.muted} numberOfLines={2}>Нет сотрудников за выбранный период</Text></View>
          ) : section.rows.map((row) => (
            <View key={row.staff_id} style={[s.row, s.nameCell]}>
              <Text style={s.name} numberOfLines={2}>{shortName(row.name)}</Text>
              {ordering ? <Arrows s={s} theme={theme} onMove={(delta) => reorder(moveRow(sections, section.key, row.staff_id, delta))} /> : null}
            </View>
          ))}
        </React.Fragment>
      ))}
    </View>
  );

  const renderGrid = () => (
    <ScrollView horizontal ref={right} showsHorizontalScrollIndicator={false}>
      <View>
        <View style={s.gridRow}>
          {dates.map((date) => (
            <View key={date.date} style={[s.head, s.cell, isWeekend(date) && s.weekend, date.date === table.today && s.today]}>
              <Text style={s.headText}>{date.day}</Text>
            </View>
          ))}
          <View style={[s.head, s.total]}><Text style={s.headText}>Итого</Text></View>
        </View>
        {sections.map((section) => (
          <React.Fragment key={section.key}>
            <View style={[s.section, { width: dates.length * CELL + TOTAL }]} />
            {section.empty ? <View style={[s.row, { width: dates.length * CELL + TOTAL }]} /> : section.rows.map((row) => (
              <View key={row.staff_id} style={s.gridRow}>
                {row.cells.map((code, index) => {
                  const date = dates[index];
                  const editable = !ordering && canCorrectCell(section, date.date, code);
                  return (
                    <Pressable
                      key={date.date}
                      style={[s.row, s.cell, isWeekend(date) && s.weekend, code === '-' && s.locked]}
                      onPress={editable ? () => openCell(section, row, date, code) : undefined}
                      disabled={!editable}
                      accessibilityLabel={editable ? `${shortName(row.name)}, ${date.day}` : undefined}
                    >
                      <Text style={[s.cellText, code === '-' && s.lockedText, code === '?' && s.markText]}>{cellText(code)}</Text>
                    </Pressable>
                  );
                })}
                <View style={[s.row, s.total]}><Text style={s.totalText}>{row.total}</Text></View>
              </View>
            ))}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={26} color={theme.accent} />
        </TouchableOpacity>
        <Text style={s.title}>Табель</Text>
        <View style={s.actions}>
          {state === 'ready' && sections.length ? (
            <>
              <TouchableOpacity onPress={() => setOrdering((on) => !on)} hitSlop={6}>
                <Text style={s.action}>{ordering ? 'Готово' : 'Изменить порядок'}</Text>
              </TouchableOpacity>
              {!ordering ? (
                <TouchableOpacity onPress={() => setExporting(true)} hitSlop={6} accessibilityLabel="Выгрузить">
                  <Ionicons name="share-outline" size={22} color={theme.accent} />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
      <View style={s.monthBar}>
        <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={8} accessibilityLabel="Предыдущий месяц">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.monthText}>{monthTitle(month)}</Text>
        <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, 1))} hitSlop={8} accessibilityLabel="Следующий месяц">
          <Ionicons name="chevron-forward" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {state === 'loading' ? <ActivityIndicator style={s.loader} color={theme.accent} /> : null}
      {state === 'failed' ? (
        <View style={s.stub}>
          <Text style={s.stubText}>Не удалось загрузить табель</Text>
          <DialogButton title="Повторить" variant="primary" onPress={() => load()} />
        </View>
      ) : null}
      {state === 'ready' && !sections.length ? (
        <View style={s.stub}><Text style={s.stubText}>Нет табелей</Text></View>
      ) : null}
      {state === 'ready' && sections.length ? (
        <ScrollView ref={left} contentContainerStyle={s.body}>
          <View style={s.table}>
            {renderLeft()}
            {renderGrid()}
          </View>
        </ScrollView>
      ) : null}

      <Dialog
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? shortName(editing.row.name) : ''}
        message={editing ? `${formatDayShort(editing.date.date, today)} · ${editing.section.title}` : ''}
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setEditing(null)} />
            <DialogButton title={editing?.present ? 'Поставить выход' : 'Снять выход'} variant="primary" onPress={saveCell} loading={busy} />
          </>
        )}
      >
        <Pressable style={s.notify} onPress={() => setNotify((on) => !on)} accessibilityRole="checkbox" accessibilityState={{ checked: notify }}>
          <Ionicons name={notify ? 'checkbox' : 'square-outline'} size={22} color={notify ? theme.accent : theme.textMuted} />
          <Text style={s.notifyText}>Уведомить сотрудника</Text>
        </Pressable>
      </Dialog>

      <Dialog
        visible={exporting}
        onClose={() => setExporting(false)}
        title="Выгрузить табель"
        message={monthTitle(month)}
        buttons={(
          <>
            <DialogButton title="XLSX" variant="primary" onPress={() => doExport('xlsx')} />
            <DialogButton title="PDF" variant="primary" onPress={() => doExport('pdf')} disabled={!table?.pdf} />
          </>
        )}
      />

      <PickerSheet
        visible={!!adding}
        title="Добавить сотрудника"
        sections={[{ key: 'staff', title: null, data: (staff || []).map((p) => ({ key: p.id, title: p.name })) }]}
        loading={!!adding && !staff}
        searchPlaceholder="Фамилия или имя"
        emptyText="Нет сотрудников"
        onSelect={addRow}
        onClose={() => setAdding(null)}
      />
    </SafeAreaView>
  );
}

const Arrows = ({ s, theme, onMove }) => (
  <View style={s.arrows}>
    <TouchableOpacity onPress={() => onMove(-1)} hitSlop={6} accessibilityLabel="Выше">
      <Ionicons name="chevron-up" size={20} color={theme.accentText} />
    </TouchableOpacity>
    <TouchableOpacity onPress={() => onMove(1)} hitSlop={6} accessibilityLabel="Ниже">
      <Ionicons name="chevron-down" size={20} color={theme.accentText} />
    </TouchableOpacity>
  </View>
);

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, height: 50, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 10 },
  action: { fontSize: 15, fontWeight: '600', color: theme.accentText },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 8 },
  monthText: { fontSize: 17, fontWeight: '700', color: theme.text, minWidth: 150, textAlign: 'center' },
  loader: { marginTop: 80 },
  stub: { alignItems: 'center', gap: 16, paddingHorizontal: 32, marginTop: 80 },
  stubText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  body: { paddingBottom: 40 },
  table: { flexDirection: 'row', backgroundColor: theme.surface },
  gridRow: { flexDirection: 'row' },
  head: { height: HEAD, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  headText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },
  section: {
    height: SECTION,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.fill,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  sectionText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.text },
  row: { height: ROW, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  nameCell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator },
  name: { flex: 1, fontSize: 13, color: theme.text },
  muted: { flex: 1, fontSize: 12, color: theme.textMuted },
  cell: { width: CELL, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator },
  weekend: { backgroundColor: theme.fill },
  today: { backgroundColor: theme.accentSoft },
  locked: { backgroundColor: theme.surfaceAlt },
  cellText: { fontSize: 13, fontWeight: '700', color: theme.text },
  lockedText: { color: theme.textMuted, fontWeight: '400' },
  markText: { color: theme.accentText },
  total: { width: TOTAL, alignItems: 'center' },
  totalText: { fontSize: 13, fontWeight: '700', color: theme.text },
  arrows: { flexDirection: 'row', gap: 6 },
  notify: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  notifyText: { fontSize: 15, color: theme.text },
});
