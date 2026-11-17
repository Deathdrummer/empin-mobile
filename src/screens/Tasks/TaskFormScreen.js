import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { CalendarModal } from '../Timesheet/components/modals/CalendarModal';
import { emitTasksChanged, productionAPI } from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import {
  addDays, buildTaskPayload, dayRange, driverForVehicle, executorSubtitle, executorTitle, formatDay, formatDayShort, formatQuantity,
  formatReadiness, formFromTask, isDriverAssigned, isOfflineError, parseDateKey, relativeDayLabel, shortName, toDateKey,
  unseenWarnings, validateForm, vehicleTitle,
} from '../../utils/tasks';
import { PickerSheet } from './PickerSheet';
import { useAfterModalClose } from '../../hooks/useAfterModalClose';

const objectSubtitle = (object) => [
  object.locality,
  object.responsible?.name ? `отв. ${shortName(object.responsible.name)}` : 'без ответственного',
  formatReadiness(object.readiness),
].filter(Boolean).join(' · ');

/**
 * Создание и изменение задания (п. 6.4). Только при связи (п. 9.1): без связи сервер не ответит, форма останется
 * открытой с введённым. Объект, дата и исполнитель обязательны; содержание — текст и/или виды работ из плана
 * объекта; техника с водителем — по желанию. О чужом объекте и незакреплённом водителе — предупреждение.
 */
export default function TaskFormScreen({ navigation, route }) {
  const { task: original = null, date: initialDate } = route.params || {};
  const theme = useTheme();
  const s = styles(theme);
  const today = toDateKey(new Date());
  const [form, setForm] = useState(() => formFromTask(original, initialDate || today));
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [foreignObject, setForeignObject] = useState(null);
  const [acknowledged, setAcknowledged] = useState([]);
  const [error, setError] = useState(null);

  const [objects, setObjects] = useState({ items: null, loading: false });
  const [objectQuery, setObjectQuery] = useState('');
  const [brigadeFilter, setBrigadeFilter] = useState(null);
  const [executors, setExecutors] = useState(null);
  const [executorType, setExecutorType] = useState(original?.executor?.type || 'brigade');
  const [fleet, setFleet] = useState(null);
  const [plan, setPlan] = useState(null);
  const searchTimer = useRef(null);
  // Следующее окно — после закрытия шторки: на iOS иначе оно не появится
  const { closeThen, onDismiss } = useAfterModalClose();

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const failLoad = (e) => setError(isOfflineError(e) ? 'Нет связи: ставить и изменять задания можно только при связи' : getUserFacingError(e, 'Не удалось загрузить данные'));

  // ---- Справочники ERP: объекты, исполнители, техника, план объекта ----

  const loadObjects = async (query, brigade) => {
    setObjects((current) => ({ ...current, loading: true }));
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (brigade) params.brigade_id = brigade.id;
      const data = await productionAPI.objects(params);
      setObjects({ items: data.items || [], loading: false });
    } catch (e) {
      setObjects({ items: [], loading: false });
      failLoad(e);
    }
  };

  const ensureExecutors = async () => {
    if (executors) return executors;
    try {
      const data = await productionAPI.executors();
      setExecutors(data);
      return data;
    } catch (e) {
      failLoad(e);
      return null;
    }
  };

  const ensureFleet = async () => {
    if (fleet) return fleet;
    try {
      const data = await productionAPI.vehicles();
      setFleet(data);
      return data;
    } catch (e) {
      failLoad(e);
      return null;
    }
  };

  const objectId = form.object?.id;
  useEffect(() => {
    setPlan(null);
    if (!objectId) return;
    productionAPI.plan(objectId).then(setPlan).catch(() => setPlan({ items: [], failed: true }));
  }, [objectId]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const openObjects = () => {
    setPicker('object');
    setObjectQuery('');
    loadObjects('', brigadeFilter);
    ensureExecutors();
  };

  const searchObjects = (text) => {
    setObjectQuery(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadObjects(text, brigadeFilter), 300);
  };

  const filterByBrigade = (brigade) => {
    setBrigadeFilter(brigade);
    loadObjects(objectQuery, brigade);
  };

  // Чужой объект или без ответственного — предупреждение с возможностью продолжить (П-ЗД-08, ИС-ЗД-03)
  const pickObject = (item) => {
    const { object } = item;
    closeThen(() => setPicker(null), () => (object.own ? chooseObject(object) : setForeignObject(object)));
  };

  const chooseObject = (object) => {
    setForeignObject(null);
    if (!object.own) setAcknowledged((list) => [...new Set([...list, 'foreign_object'])]);
    // Виды работ — из плана объекта (П-ЗД-11): при смене объекта прежние снимаются
    setForm((current) => ({
      ...current,
      object,
      works: Number(current.object?.id) === Number(object.id) ? current.works : [],
    }));
  };

  const openExecutors = async () => {
    setPicker('executor');
    await ensureExecutors();
  };

  const pickExecutor = (item) => {
    setPicker(null);
    set({ executor: item.executor });
  };

  const openVehicles = async () => {
    setPicker('vehicle');
    await ensureFleet();
  };

  // Один закреплённый водитель подставляется сам, при нескольких — выбор (ИС-ЗД-06)
  const pickVehicle = (item) => {
    const { driver, choose } = driverForVehicle(item.vehicle, fleet?.drivers);
    set({ vehicle: item.vehicle, driver: driver ? { ...driver, assigned: true } : null });
    closeThen(() => setPicker(null), () => choose && setPicker('driver'));
  };

  const openDrivers = async () => {
    setPicker('driver');
    await ensureFleet();
  };

  const pickDriver = (item) => {
    setPicker(null);
    if (!item.driver) {
      set({ driver: null });
      return;
    }
    const assigned = isDriverAssigned(currentVehicle, item.driver);
    if (!assigned) setAcknowledged((list) => [...new Set([...list, 'driver_not_assigned'])]);
    set({ driver: { ...item.driver, assigned } });
  };

  const pickWork = (item) => {
    setPicker(null);
    set({ works: [...form.works, { work_type_id: item.work.work_type_id, name: item.work.name, unit: item.work.unit, quantity: '' }] });
  };

  const setWorkQuantity = (workTypeId, quantity) => set({
    works: form.works.map((work) => (work.work_type_id === workTypeId ? { ...work, quantity } : work)),
  });

  const removeWork = (workTypeId) => set({ works: form.works.filter((work) => work.work_type_id !== workTypeId) });

  // Машина из справочника — с закреплёнными водителями; у сохранённой в задании их может не быть
  const currentVehicle = useMemo(() => {
    if (!form.vehicle) return null;
    return (fleet?.vehicles || []).find((vehicle) => Number(vehicle.id) === Number(form.vehicle.id)) || form.vehicle;
  }, [form.vehicle, fleet]);

  // ---- Сохранение ----

  const save = async () => {
    const problem = validateForm(form);
    if (problem) {
      Toast.show({ type: 'error', text1: problem, position: 'top' });
      return;
    }
    const body = buildTaskPayload(form, original);
    if (original && !Object.keys(body).length) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      const data = original ? await productionAPI.updateTask(original.id, body) : await productionAPI.createTask(body);
      emitTasksChanged([data.task?.date, original?.date, form.date]);
      const warnings = unseenWarnings(data.warnings, acknowledged);
      Toast.show({
        type: 'success',
        text1: original ? 'Задание изменено' : `Задание создано: ${relativeDayLabel(data.task?.date || form.date, today).toLowerCase()}`,
        text2: warnings.join('. ') || undefined,
        position: 'top',
      });
      navigation.goBack();
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: original ? 'Не удалось изменить' : 'Не удалось создать',
        text2: isOfflineError(e) ? 'Нет связи. Ставить и изменять задания можно только при связи' : getUserFacingError(e, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- Списки для шторок ----

  const objectSections = useMemo(() => {
    const items = objects.items || [];
    const row = (object) => ({
      key: object.id,
      object,
      meta: object.number,
      title: object.title || 'Объект',
      subtitle: objectSubtitle(object),
      selected: Number(form.object?.id) === Number(object.id),
    });
    if (objectQuery.trim()) return [{ key: 'found', title: null, data: items.map(row) }];
    return [
      { key: 'recent', title: 'Недавние', data: items.filter((o) => o.group === 'recent').map(row) },
      { key: 'mine', title: 'Мои объекты', data: items.filter((o) => o.group === 'mine').map(row) },
      { key: 'other', title: brigadeFilter ? 'Объекты бригады' : null, data: items.filter((o) => !o.group).map(row) },
    ];
  }, [objects.items, objectQuery, brigadeFilter, form.object]);

  const executorSections = useMemo(() => {
    if (!executors) return [];
    if (executorType === 'brigade') {
      return [{
        key: 'brigades',
        title: null,
        data: (executors.brigades || []).map((brigade) => {
          const executor = { type: 'brigade', brigade_id: brigade.id, name: brigade.name, foreman: brigade.foreman };
          return {
            key: `b${brigade.id}`,
            executor,
            title: brigade.name,
            subtitle: [executorSubtitle(executor), (() => {
              // Бригадир уже назван выше — в составе только остальные
              const others = (brigade.members || []).filter((m) => Number(m.id) !== Number(brigade.foreman?.id));
              return others.length ? `состав: ${others.map((m) => shortName(m.name)).join(', ')}` : 'других членов нет';
            })()].join(' · '),
            search: `${brigade.name} ${brigade.foreman?.name || ''} ${(brigade.members || []).map((m) => m.name).join(' ')}`,
            selected: form.executor?.type === 'brigade' && Number(form.executor.brigade_id) === Number(brigade.id),
          };
        }),
      }];
    }
    return [{
      key: 'staff',
      title: null,
      data: (executors.staff || []).map((person) => ({
        key: `s${person.id}`,
        executor: { type: 'staff', staff_id: person.id, name: person.name },
        title: person.name,
        subtitle: person.position,
        search: person.name,
        selected: form.executor?.type === 'staff' && Number(form.executor.staff_id) === Number(person.id),
      })),
    }];
  }, [executors, executorType, form.executor]);

  const vehicleSections = useMemo(() => {
    const drivers = fleet?.drivers || [];
    return [{
      key: 'vehicles',
      title: null,
      data: (fleet?.vehicles || []).map((vehicle) => {
        const assigned = drivers.filter((driver) => (vehicle.driver_ids || []).includes(driver.id));
        return {
          key: vehicle.id,
          vehicle,
          title: vehicle.name,
          subtitle: [vehicle.plate, assigned.length ? `водители: ${assigned.map((d) => shortName(d.name)).join(', ')}` : 'нет закреплённых водителей'].filter(Boolean).join(' · '),
          search: `${vehicle.name} ${vehicle.plate || ''}`,
          selected: Number(form.vehicle?.id) === Number(vehicle.id),
        };
      }),
    }];
  }, [fleet, form.vehicle]);

  const driverSections = useMemo(() => {
    const assignedIds = (currentVehicle?.driver_ids || []).map(Number);
    const row = (driver) => ({
      key: driver.id,
      driver,
      title: driver.name,
      search: driver.name,
      selected: Number(form.driver?.id) === Number(driver.id),
    });
    const drivers = fleet?.drivers || [];
    return [
      { key: 'assigned', title: 'Закреплены за машиной', data: drivers.filter((d) => assignedIds.includes(Number(d.id))).map(row) },
      { key: 'others', title: 'Другие водители', data: drivers.filter((d) => !assignedIds.includes(Number(d.id))).map((d) => ({ ...row(d), subtitle: 'Не закреплён за этой машиной' })) },
      { key: 'none', title: null, data: [{ key: 'none', driver: null, title: 'Без водителя', selected: !form.driver }] },
    ];
  }, [fleet, currentVehicle, form.driver]);

  const workSections = useMemo(() => {
    const chosen = new Set(form.works.map((work) => Number(work.work_type_id)));
    return [{
      key: 'plan',
      title: null,
      data: (plan?.items || []).filter((work) => !chosen.has(Number(work.work_type_id))).map((work) => ({
        key: work.work_type_id,
        work,
        title: work.name || 'Вид работ',
        subtitle: `по плану: ${formatQuantity(work.quantity, work.unit)}`,
        search: work.name,
      })),
    }];
  }, [plan, form.works]);

  // Новое задание — только на сегодня и будущее (П-ЗД-05); глубину переноса проверит сервер
  const allowedDates = useMemo(() => (original ? null : new Set(dayRange(today, addDays(today, 400)))), [original, today]);

  const header = (
    <View style={s.topBar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Отмена">
        <Ionicons name="chevron-back" size={28} color={theme.accent} />
      </Pressable>
      <Text style={s.topTitle}>{original ? 'Изменение задания' : 'Новое задание'}</Text>
      <TouchableOpacity onPress={save} disabled={saving} style={s.save} hitSlop={8} accessibilityLabel="Сохранить">
        {saving ? <ActivityIndicator color={theme.accent} /> : <Text style={s.saveText}>Готово</Text>}
      </TouchableOpacity>
    </View>
  );

  const vehicleWarning = form.vehicle && form.driver && form.driver.assigned === false;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {header}
      <KeyboardAwareScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {error ? (
          <View style={s.notice}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.textSecondary} />
            <Text style={s.noticeText}>{error}</Text>
          </View>
        ) : null}

        <View style={s.card}>
          <FieldRow
            s={s}
            theme={theme}
            icon="business"
            color="#5B6B8C"
            label="Объект"
            value={form.object ? `${form.object.number ? `${form.object.number} · ` : ''}${form.object.title || ''}` : null}
            hint={form.object ? objectSubtitle(form.object) : null}
            placeholder="Выберите объект"
            onPress={() => { setError(null); openObjects(); }}
          />
          <FieldRow
            s={s}
            theme={theme}
            border
            icon="calendar"
            color={theme.accent}
            label="Дата"
            value={formatDayShort(form.date, today)}
            hint={relativeDayLabel(form.date, today) !== formatDayShort(form.date, today) ? relativeDayLabel(form.date, today) : formatDay(form.date, today).weekDay}
            onPress={() => setCalendarVisible(true)}
          />
          <FieldRow
            s={s}
            theme={theme}
            border
            icon={form.executor?.type === 'staff' ? 'person' : 'people'}
            color="#1F7FA8"
            label="Исполнитель"
            value={form.executor ? executorTitle(form.executor) : null}
            hint={form.executor ? executorSubtitle(form.executor) : null}
            placeholder="Бригада или сотрудник"
            onPress={() => { setError(null); openExecutors(); }}
          />
        </View>

        <Text style={s.sectionTitle}>Что сделать</Text>
        <View style={[s.card, s.cardNoGap]}>
          <TextInput
            style={s.textInput}
            value={form.text}
            onChangeText={(text) => set({ text })}
            placeholder="Текст задания"
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
        </View>

        <Text style={s.sectionTitle}>Виды работ из плана объекта</Text>
        <View style={[s.card, s.cardNoGap]}>
          {form.works.map((work, index) => (
            <View key={work.work_type_id} style={[s.row, index > 0 && s.rowBorder]}>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>{work.name || 'Вид работ'}</Text>
              </View>
              <TextInput
                style={s.quantityInput}
                value={work.quantity}
                onChangeText={(quantity) => setWorkQuantity(work.work_type_id, quantity)}
                placeholder="кол-во"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={s.unit}>{work.unit || ''}</Text>
              <TouchableOpacity onPress={() => removeWork(work.work_type_id)} hitSlop={8} accessibilityLabel={`Убрать: ${work.name}`}>
                <Ionicons name="remove-circle" size={22} color={theme.danger} />
              </TouchableOpacity>
            </View>
          ))}
          {!form.object ? (
            <Text style={s.cardHint}>Сначала выберите объект</Text>
          ) : !plan ? (
            <ActivityIndicator style={s.inlineLoader} color={theme.accent} />
          ) : plan.items?.length ? (
            <Pressable
              style={({ pressed }) => [s.row, form.works.length > 0 && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
              onPress={() => setPicker('work')}
              disabled={!workSections[0].data.length}
            >
              <View style={[s.rowIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="add" size={18} color={theme.accentText} />
              </View>
              <Text style={[s.rowTitle, { color: workSections[0].data.length ? theme.accentText : theme.textMuted }]}>
                {workSections[0].data.length ? 'Добавить из плана' : 'Все виды работ плана добавлены'}
              </Text>
            </Pressable>
          ) : (
            <Text style={s.cardHint}>{plan.failed ? 'Не удалось загрузить план объекта' : 'У объекта нет плана работ — задание ставится текстом'}</Text>
          )}
        </View>

        <Text style={s.sectionTitle}>Техника</Text>
        <View style={[s.card, s.cardNoGap]}>
          <FieldRow
            s={s}
            theme={theme}
            icon="car"
            color="#4E7A2B"
            label="Машина"
            value={form.vehicle ? vehicleTitle(form.vehicle) : null}
            placeholder="Без техники"
            onPress={() => { setError(null); openVehicles(); }}
          />
          {form.vehicle ? (
            <>
              <FieldRow
                s={s}
                theme={theme}
                border
                icon="person"
                color="#4E7A2B"
                label="Водитель"
                value={form.driver?.name ? shortName(form.driver.name) : null}
                hint={vehicleWarning ? 'Не закреплён за этой машиной' : null}
                warning={vehicleWarning}
                placeholder="Без водителя"
                onPress={openDrivers}
              />
              <Pressable
                style={({ pressed }) => [s.row, s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]}
                onPress={() => set({ vehicle: null, driver: null })}
              >
                <Ionicons name="close-circle-outline" size={22} color={theme.danger} style={s.actionIcon} />
                <Text style={[s.rowTitle, { color: theme.danger }]}>Убрать технику</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        <Text style={s.sectionHint}>Одну машину и водителя можно указать в нескольких заданиях на одну дату.</Text>
      </KeyboardAwareScrollView>

      <PickerSheet
        visible={picker === 'object'}
        title="Объект"
        sections={objectSections}
        loading={objects.loading && !objects.items?.length}
        searchPlaceholder="Номер, название, титул, населённый пункт"
        emptyText={objectQuery.trim() ? 'Не найдено. Объекты в архиве не ищутся' : 'Подсказок нет — найдите объект поиском'}
        onSearch={searchObjects}
        onSelect={pickObject}
        onClose={() => setPicker(null)}
        onDismiss={onDismiss}
        header={executors?.brigades?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {[null, ...executors.brigades].map((brigade) => {
              const active = Number(brigadeFilter?.id ?? -1) === Number(brigade?.id ?? -1);
              return (
                <TouchableOpacity key={brigade?.id ?? 'all'} onPress={() => filterByBrigade(brigade)} style={[s.chip, active && { backgroundColor: theme.text }]}>
                  <Text style={[s.chipText, active && { color: theme.background, fontWeight: '600' }]}>{brigade ? brigade.name : 'Все бригады'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      />

      <PickerSheet
        visible={picker === 'executor'}
        title="Исполнитель"
        sections={executorSections}
        loading={!executors}
        searchPlaceholder={executorType === 'brigade' ? 'Бригада, бригадир или член бригады' : 'Фамилия или имя'}
        emptyText={executorType === 'brigade' ? 'Бригад нет' : 'Нет сотрудников с учётной записью'}
        onSelect={pickExecutor}
        onClose={() => setPicker(null)}
        onDismiss={onDismiss}
        header={(
          <View style={s.segment}>
            {[{ key: 'brigade', label: 'Бригада' }, { key: 'staff', label: 'Сотрудник' }].map((item) => {
              const active = executorType === item.key;
              return (
                <TouchableOpacity key={item.key} onPress={() => setExecutorType(item.key)} style={[s.segmentItem, active && s.segmentActive]}>
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      <PickerSheet
        visible={picker === 'vehicle'}
        title="Техника"
        sections={vehicleSections}
        loading={!fleet}
        searchPlaceholder="Название или номер"
        emptyText="Нет доступной техники"
        onSelect={pickVehicle}
        onClose={() => setPicker(null)}
        onDismiss={onDismiss}
      />

      <PickerSheet
        visible={picker === 'driver'}
        title="Водитель"
        sections={driverSections}
        loading={!fleet}
        searchPlaceholder="Фамилия или имя"
        onSelect={pickDriver}
        onClose={() => setPicker(null)}
        onDismiss={onDismiss}
      />

      <PickerSheet
        visible={picker === 'work'}
        title="Виды работ"
        sections={workSections}
        searchPlaceholder="Вид работ"
        emptyText="Все виды работ плана уже добавлены"
        onSelect={pickWork}
        onClose={() => setPicker(null)}
        onDismiss={onDismiss}
      />

      <CalendarModal
        visible={calendarVisible}
        selectedDate={parseDateKey(form.date)}
        availableDates={allowedDates}
        hasActiveFilters={!!allowedDates}
        onClose={() => setCalendarVisible(false)}
        onDateSelect={(date) => { setCalendarVisible(false); set({ date: toDateKey(date) }); }}
      />

      <Dialog
        visible={!!foreignObject}
        onClose={() => setForeignObject(null)}
        icon={<Ionicons name="warning" size={34} color={theme.accent} />}
        title="Чужой объект"
        message={foreignObject?.responsible?.name
          ? `Ответственный за объект: ${shortName(foreignObject.responsible.name)}\nЗадание будет вашим: об отчёте по нему уведомят вас, а не ответственного.`
          : 'У объекта нет ответственного начальника участка.\nЗадание будет вашим.'}
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setForeignObject(null)} />
            <DialogButton title="Продолжить" variant="primary" onPress={() => chooseObject(foreignObject)} />
          </>
        )}
      />
    </SafeAreaView>
  );
}

const FieldRow = ({ s, theme, icon, color, label, value, hint, placeholder, onPress, border, warning }) => (
  <Pressable style={({ pressed }) => [s.row, border && s.rowBorder, pressed && { backgroundColor: theme.surfacePressed }]} onPress={onPress}>
    <View style={[s.rowIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={16} color="#FFFFFF" />
    </View>
    <View style={s.rowBody}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowTitle, !value && s.placeholder]} numberOfLines={2}>{value || placeholder}</Text>
      {hint ? <Text style={[s.rowSub, warning && { color: theme.accentText }]} numberOfLines={2}>{hint}</Text> : null}
    </View>
    {warning ? <Ionicons name="warning" size={18} color={theme.accentText} /> : null}
    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
  </Pressable>
);

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  save: { minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  saveText: { fontSize: 17, fontWeight: '600', color: theme.accent },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: theme.fill, marginTop: 8 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19, color: theme.textSecondary },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  sectionHint: { fontSize: 13, color: theme.textMuted, marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
  card: { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden', marginTop: 12 },
  cardNoGap: { marginTop: 0 },
  cardHint: { fontSize: 14, color: theme.textMuted, padding: 14 },
  inlineLoader: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 52 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 1 },
  rowTitle: { fontSize: 16, color: theme.text },
  rowSub: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },
  placeholder: { color: theme.textMuted },
  actionIcon: { width: 30, textAlign: 'center' },
  textInput: { minHeight: 96, fontSize: 16, lineHeight: 22, color: theme.text, padding: 14 },
  quantityInput: {
    width: 76,
    fontSize: 16,
    color: theme.text,
    textAlign: 'right',
    backgroundColor: theme.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  unit: { minWidth: 24, fontSize: 14, color: theme.textSecondary },
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
