import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { productionAPI } from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import { executorSubtitle, formatReadiness, isOfflineError, shortName } from '../../utils/tasks';
import { PickerSheet } from './PickerSheet';

/** Строка объекта (п. 5.4): расположение, ответственный, утверждённая готовность */
export const objectSubtitle = (object) => [
  object.locality,
  object.responsible?.name ? `отв. ${shortName(object.responsible.name)}` : 'без ответственного',
  formatReadiness(object.readiness),
].filter(Boolean).join(' · ');

const loadError = (error) => (isOfflineError(error)
  ? 'Нет связи'
  : getUserFacingError(error, 'Не удалось загрузить список'));

// Бригады и сотрудники меняются в ERP редко — один запрос на открытие экрана, а не на каждую шторку
let executorsPromise = null;
const loadExecutors = () => {
  executorsPromise = executorsPromise || productionAPI.executors().catch((error) => {
    executorsPromise = null;
    throw error;
  });
  return executorsPromise;
};
export const resetExecutorsCache = () => { executorsPromise = null; };

/**
 * Выбор объекта (п. 5.4): без поиска — подсказки «Недавние» и «Мои объекты»; поиск по активным объектам;
 * фильтр по бригаде — объекты, за которыми она закреплена. initialBrigade — фильтр сразу (добавление объекта бригаде).
 */
export const ObjectPickerSheet = ({ visible, selectedId, initialBrigade = null, onPick, onClose, onDismiss }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [brigade, setBrigade] = useState(initialBrigade);
  const [brigades, setBrigades] = useState([]);
  const timer = useRef(null);

  const load = async (text, filter) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (text.trim()) params.q = text.trim();
      if (filter) params.brigade_id = filter.id;
      setItems((await productionAPI.objects(params)).items || []);
    } catch (e) {
      setItems([]);
      setError(loadError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return undefined;
    setQuery('');
    setBrigade(initialBrigade);
    load('', initialBrigade);
    loadExecutors().then((data) => setBrigades(data.brigades || [])).catch(() => {});
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const search = (text) => {
    setQuery(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(text, brigade), 300);
  };

  const filterBy = (next) => {
    setBrigade(next);
    load(query, next);
  };

  const sections = useMemo(() => {
    const row = (object) => ({
      key: object.id,
      object,
      meta: object.number,
      title: object.title || 'Объект',
      subtitle: objectSubtitle(object),
      selected: Number(selectedId) === Number(object.id),
    });
    const list = items || [];
    if (query.trim()) return [{ key: 'found', title: null, data: list.map(row) }];
    return [
      { key: 'recent', title: 'Недавние', data: list.filter((o) => o.group === 'recent').map(row) },
      { key: 'mine', title: 'Мои объекты', data: list.filter((o) => o.group === 'mine').map(row) },
      { key: 'other', title: brigade ? 'Объекты бригады' : null, data: list.filter((o) => !o.group).map(row) },
    ];
  }, [items, query, brigade, selectedId]);

  return (
    <PickerSheet
      visible={visible}
      title="Объект"
      sections={sections}
      loading={loading && !items?.length}
      searchPlaceholder="Номер, название, титул, населённый пункт"
      emptyText={error || (query.trim() ? 'Не найдено' : 'Подсказок нет')}
      onSearch={search}
      onSelect={(item) => onPick(item.object)}
      onClose={onClose}
      onDismiss={onDismiss}
      header={brigades.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
          {[null, ...brigades].map((item) => {
            const active = Number(brigade?.id ?? -1) === Number(item?.id ?? -1);
            return (
              <TouchableOpacity key={item?.id ?? 'all'} onPress={() => filterBy(item)} style={[s.chip, active && { backgroundColor: theme.text }]}>
                <Text style={[s.chipText, active && { color: theme.background, fontWeight: '600' }]}>{item ? item.name : 'Все бригады'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    />
  );
};

/** Выбор исполнителя (п. 5.4): бригада с бригадиром и составом или сотрудник с учётной записью */
export const ExecutorPickerSheet = ({ visible, selected, onPick, onClose, onDismiss }) => {
  const s = useThemedStyles(makeStyles);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [type, setType] = useState(selected?.type || 'brigade');

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setType(selected?.type || 'brigade');
    loadExecutors().then(setData).catch((e) => { setData({ brigades: [], staff: [] }); setError(loadError(e)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sections = useMemo(() => {
    if (!data) return [];
    if (type === 'brigade') {
      return [{
        key: 'brigades',
        title: null,
        data: (data.brigades || []).map((brigade) => {
          const executor = { type: 'brigade', brigade_id: brigade.id, name: brigade.name, foreman: brigade.foreman };
          // Бригадир уже назван — в составе только остальные
          const others = (brigade.members || []).filter((m) => Number(m.id) !== Number(brigade.foreman?.id));
          return {
            key: `b${brigade.id}`,
            executor,
            title: brigade.name,
            subtitle: [executorSubtitle(executor), others.length ? `состав: ${others.map((m) => shortName(m.name)).join(', ')}` : 'других членов нет'].join(' · '),
            search: `${brigade.name} ${brigade.foreman?.name || ''} ${(brigade.members || []).map((m) => m.name).join(' ')}`,
            selected: selected?.type === 'brigade' && Number(selected.brigade_id) === Number(brigade.id),
          };
        }),
      }];
    }
    return [{
      key: 'staff',
      title: null,
      data: (data.staff || []).map((person) => ({
        key: `s${person.id}`,
        executor: { type: 'staff', staff_id: person.id, name: person.name },
        title: person.name,
        subtitle: person.position,
        search: person.name,
        selected: selected?.type === 'staff' && Number(selected.staff_id) === Number(person.id),
      })),
    }];
  }, [data, type, selected]);

  return (
    <PickerSheet
      visible={visible}
      title="Исполнитель"
      sections={sections}
      loading={!data}
      searchPlaceholder={type === 'brigade' ? 'Поиск' : 'Поиск'}
      emptyText={error || (type === 'brigade' ? 'Бригад нет' : 'Нет сотрудников с учётной записью')}
      onSelect={(item) => onPick(item.executor)}
      onClose={onClose}
      onDismiss={onDismiss}
      header={(
        <View style={s.segment}>
          {[{ key: 'brigade', label: 'Бригада' }, { key: 'staff', label: 'Сотрудник' }].map((item) => {
            const active = type === item.key;
            return (
              <TouchableOpacity key={item.key} onPress={() => setType(item.key)} style={[s.segmentItem, active && s.segmentActive]}>
                <Text style={[s.segmentText, active && s.segmentTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    />
  );
};

/** Чужой объект или без ответственного — предупреждение с возможностью продолжить (П-ЗД-08, ИС-ЗД-03) */
export const ForeignObjectDialog = ({ object, onCancel, onContinue }) => {
  const theme = useTheme();
  return (
    <Dialog
      visible={!!object}
      onClose={onCancel}
      icon={<Ionicons name="warning" size={34} color={theme.accent} />}
      title="Чужой объект"
      message={object?.responsible?.name
        ? `Ответственный: ${shortName(object.responsible.name)}`
        : 'Ответственного нет'}
      buttons={(
        <>
          <DialogButton title="Отмена" onPress={onCancel} />
          <DialogButton title="Продолжить" variant="primary" onPress={() => onContinue(object)} />
        </>
      )}
    />
  );
};

const makeStyles = (theme) => StyleSheet.create({
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.inputBackground },
  chipText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  segment: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8, padding: 3, borderRadius: 12, backgroundColor: theme.inputBackground },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10 },
  segmentActive: { backgroundColor: theme.sheet, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 15, fontWeight: '500', color: theme.textSecondary },
  segmentTextActive: { color: theme.text, fontWeight: '600' },
});
