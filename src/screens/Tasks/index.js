import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useActionSheet } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarHeight } from '../../components/TabBar';
import { useTheme, useThemedStyles } from '../../theme';
import {
  cachedDays, emitTasksChanged, forgetTask, productionAPI, refreshMe, saveDays, setCopiedTask, subscribeTasksChanged,
  useCopiedTask, useProductionMe,
} from '../../services/production';
import { getUserFacingError } from '../../utils/userFacingError';
import {
  addDays, canCreateOn, dayRange, daysBetween, filtersKey, filtersToParams, filterTags, hasFilters, isOfflineError,
  objectTitle, parseDateKey, toDateKey,
} from '../../utils/tasks';
import { ActiveFilterTags } from '../Timesheet/components/ActiveFilterTags';
import { CalendarModal } from '../Timesheet/components/modals/CalendarModal';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { TaskDayPage } from './TaskDayPage';
import { FilterSheet } from './FilterSheet';
import { NotificationsSheet } from './NotificationsSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Окно листания: год назад и год вперёд от выбранной даты. Дальше — через календарь (окно сдвигается)
const WINDOW_DAYS = 365;
// Сколько дней по сторонам от открытого подгружать заранее (и держать для работы без связи)
const PRELOAD_DAYS = 3;

const phoneToday = () => toDateKey(new Date());

/**
 * Календарь заданий (п. 6.4): один день — один экран, листание по дням, фильтры, уведомления.
 * Заменяет прототип «Табель»: те же записи план-графика ERP, но с правами и журналом ТЗ.
 */
export default function TasksScreen() {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const { showActionSheetWithOptions } = useActionSheet();
  const me = useProductionMe();
  const copied = useCopiedTask();

  const [today, setToday] = useState(phoneToday);
  const [center, setCenter] = useState(phoneToday);
  const [current, setCurrent] = useState(phoneToday);
  const [filters, setFilters] = useState({});
  const [entries, setEntries] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDates, setCalendarDates] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const listRef = useRef(null);
  const filtersRef = useRef(filters);
  const loadingRef = useRef(new Set());
  filtersRef.current = filters;

  const days = useMemo(() => dayRange(addDays(center, -WINDOW_DAYS), addDays(center, WINDOW_DAYS)), [center]);
  const indexOf = useCallback((date) => daysBetween(days[0], date), [days]);

  // ---- Загрузка дней ----

  const load = useCallback(async (dates, { force = false } = {}) => {
    const currentFilters = filtersRef.current;
    const key = filtersKey(currentFilters);
    const wanted = dates.filter((date) => force || !loadingRef.current.has(`${key}|${date}`));
    if (!wanted.length) return;
    wanted.forEach((date) => loadingRef.current.add(`${key}|${date}`));
    const from = wanted.reduce((a, b) => (a < b ? a : b));
    const to = wanted.reduce((a, b) => (a > b ? a : b));
    const filtered = hasFilters(currentFilters);

    try {
      const data = await productionAPI.tasks({ from, to, ...filtersToParams(currentFilters) });
      if (filtersKey(filtersRef.current) !== key) return;
      if (data.today) setToday(data.today);
      const byDate = Object.fromEntries(dayRange(from, to).map((date) => [date, []]));
      (data.items || []).forEach((task) => { (byDate[task.date] ||= []).push(task); });
      setEntries((prev) => {
        const next = { ...prev };
        Object.entries(byDate).forEach(([date, items]) => { next[date] = { items, filtered }; });
        return next;
      });
      saveDays(Object.fromEntries(Object.entries(byDate).map(([date, items]) => [`${key}|${date}`, items])));
    } catch (error) {
      if (filtersKey(filtersRef.current) !== key) return;
      // Не загрузилось — при следующем открытии дня пробуем снова
      wanted.forEach((date) => loadingRef.current.delete(`${key}|${date}`));
      const offline = isOfflineError(error);
      const cached = await cachedDays(wanted.map((date) => `${key}|${date}`));
      setEntries((prev) => {
        const next = { ...prev };
        wanted.forEach((date) => {
          const saved = cached[`${key}|${date}`];
          if (saved) next[date] = { items: saved.items, filtered, offline: true };
          else if (!prev[date]?.items) next[date] = { items: offline ? undefined : [], filtered, offline: true };
        });
        return next;
      });
      if (!offline) {
        Toast.show({ type: 'error', text1: 'Не удалось загрузить задания', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
      }
    }
  }, []);

  const around = useCallback((date) => dayRange(addDays(date, -PRELOAD_DAYS), addDays(date, PRELOAD_DAYS)), []);

  useEffect(() => {
    load(around(current));
  }, [current, filters, load, around]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(around(current), { force: true }), refreshMe()]);
    setRefreshing(false);
  }, [current, load, around]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      setNotifications((await productionAPI.notifications()).items || []);
    } catch {
      // Без связи — покажем прежний список
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Вкладку открыли снова или вернулись из карточки: тихо обновляем открытые дни, права и уведомления
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      load(around(current), { force: true });
      refreshMe();
      loadNotifications();
    }
    wasFocused.current = isFocused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Задание создано, изменено, удалено или вставлено — обновляем затронутые дни
  useEffect(() => subscribeTasksChanged((dates) => {
    loadingRef.current.clear();
    load([...new Set([...dates, ...around(current)])], { force: true });
  }), [current, load, around]);

  // ---- Листание и переход к дате ----

  const goTo = useCallback((date) => {
    if (Math.abs(daysBetween(center, date)) > WINDOW_DAYS - 7) {
      setCenter(date);
      setCurrent(date);
      return;
    }
    setCurrent(date);
    listRef.current?.scrollToIndex({ index: indexOf(date), animated: false });
  }, [center, indexOf]);

  const onMomentumScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (days[index] && days[index] !== current) setCurrent(days[index]);
  };

  const openCalendar = async () => {
    setCalendarDates(null);
    setCalendarVisible(true);
    if (!hasFilters(filters)) return;
    // С фильтром в календаре доступны только дни с заданиями
    try {
      const date = parseDateKey(current);
      // Те же ±3 месяца, что календарь отмечает недоступными
      const from = toDateKey(new Date(date.getFullYear(), date.getMonth() - 3, 1));
      const to = toDateKey(new Date(date.getFullYear(), date.getMonth() + 4, 0));
      const data = await productionAPI.taskDates({ from, to, ...filtersToParams(filters) });
      setCalendarDates(new Set(data.dates || []));
    } catch {
      setCalendarDates(null);
    }
  };

  const applyFilters = (next) => {
    setFilterVisible(false);
    loadingRef.current.clear();
    setEntries({});
    setFilters(next);
  };

  const removeFilter = (type) => applyFilters(Object.fromEntries(Object.entries(filters).filter(([key]) => key !== type)));

  // ---- Действия с заданием ----

  const openTask = useCallback((task) => navigation.navigate('Task', { taskId: task.id, task }), [navigation]);

  const copy = (task) => {
    setCopiedTask(task);
    Toast.show({
      type: 'success',
      text1: 'Задание скопировано',
      text2: 'Откройте нужный день и нажмите «Вставить»: перенесутся объект и исполнитель',
      position: 'top',
    });
  };

  const paste = async (date) => {
    if (!copied) return;
    setPasting(true);
    try {
      await productionAPI.copyTask(copied.id, date);
      emitTasksChanged([date]);
      Toast.show({ type: 'success', text1: 'Задание вставлено', text2: objectTitle(copied.object), position: 'top' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Не удалось вставить',
        text2: isOfflineError(error) ? 'Вставить задание можно только при связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    } finally {
      setPasting(false);
    }
  };

  const confirmDelete = async () => {
    const task = deleting;
    setDeleteBusy(true);
    try {
      await productionAPI.deleteTask(task.id);
      forgetTask(task.id);
      setDeleting(null);
      emitTasksChanged([task.date]);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Не удалось удалить',
        text2: isOfflineError(error) ? 'Удалить задание можно только при связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  const taskMenu = (task) => {
    const actions = [{ label: 'Открыть', run: () => openTask(task) }];
    if (task.abilities?.copy) actions.push({ label: 'Копировать', run: () => copy(task) });
    if (task.abilities?.edit) actions.push({ label: 'Изменить', run: () => navigation.navigate('TaskForm', { task }) });
    if (task.abilities?.delete) actions.push({ label: 'Удалить', run: () => setDeleting(task), destructive: true });
    const options = [...actions.map((action) => action.label), 'Отмена'];
    const destructive = actions.findIndex((action) => action.destructive);
    showActionSheetWithOptions({
      title: objectTitle(task.object),
      options,
      cancelButtonIndex: options.length - 1,
      destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      containerStyle: { paddingBottom: insets.bottom },
    }, (index) => actions[index]?.run());
  };

  const openNotification = (item) => {
    setNotificationsVisible(false);
    navigation.navigate('Task', { taskId: item.task_id });
  };

  const tags = filterTags(filters);
  const filtered = tags.length > 0;
  const notificationsCount = notifications.length;

  const renderDay = ({ item: date }) => (
    <TaskDayPage
      date={date}
      today={today}
      entry={entries[date]}
      canCreate={canCreateOn(me, date, today)}
      copied={copied}
      refreshing={refreshing && date === current}
      pasting={pasting}
      onRefresh={refresh}
      onAdd={(day) => navigation.navigate('TaskForm', { date: day })}
      onPaste={paste}
      onOpenTask={openTask}
      onTaskMenu={taskMenu}
      bottomInset={tabBarHeight}
    />
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <Text style={s.title}>Задания</Text>
        <View style={s.actions}>
          <TouchableOpacity
            style={s.actionButton}
            onPress={() => { setNotificationsVisible(true); loadNotifications(); }}
            hitSlop={6}
            accessibilityLabel={notificationsCount ? `Уведомления: ${notificationsCount}` : 'Уведомления'}
          >
            <Ionicons name={notificationsCount ? 'notifications' : 'notifications-outline'} size={21} color={theme.text} />
            {notificationsCount ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{notificationsCount > 99 ? '99+' : notificationsCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.actionButton} onPress={openCalendar} hitSlop={6} accessibilityLabel="Выбрать дату">
            <Ionicons name="calendar-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionButton, filtered && { backgroundColor: theme.accentSoft }]}
            onPress={() => setFilterVisible(true)}
            hitSlop={6}
            accessibilityLabel={filtered ? 'Фильтр, включён' : 'Фильтр'}
          >
            <Ionicons name={filtered ? 'funnel' : 'funnel-outline'} size={20} color={filtered ? theme.accent : theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ActiveFilterTags tags={tags} onRemoveTag={removeFilter} onClearAll={() => applyFilters({})} />

      <FlatList
        key={center}
        ref={listRef}
        style={s.list}
        data={days}
        renderItem={renderDay}
        keyExtractor={(date) => date}
        extraData={[entries, today, me, copied, refreshing, pasting, current]}
        initialScrollIndex={indexOf(current)}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        decelerationRate="fast"
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 100)}
      />

      <CalendarModal
        visible={calendarVisible}
        selectedDate={parseDateKey(current)}
        availableDates={calendarDates}
        hasActiveFilters={filtered && !!calendarDates}
        onClose={() => setCalendarVisible(false)}
        onDateSelect={(date) => { setCalendarVisible(false); goTo(toDateKey(date)); }}
      />

      <FilterSheet visible={filterVisible} filters={filters} onApply={applyFilters} onClose={() => setFilterVisible(false)} />

      <NotificationsSheet
        visible={notificationsVisible}
        items={notifications}
        loading={notificationsLoading}
        onClose={() => setNotificationsVisible(false)}
        onClosed={(id) => setNotifications((list) => list.filter((item) => item.id !== id))}
        onOpenTask={openNotification}
      />

      <Dialog
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title="Удалить задание?"
        message={deleting ? `${objectTitle(deleting.object)}. Задание удалится вместе с перепиской.` : ''}
        buttons={(
          <>
            <DialogButton title="Отмена" onPress={() => setDeleting(null)} />
            <DialogButton title="Удалить" variant="danger" onPress={confirmDelete} loading={deleteBusy} />
          </>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: { fontSize: 30, fontWeight: '700', color: theme.text, letterSpacing: 0.2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.dark ? theme.surfaceAlt : theme.surface,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  badgeText: { color: theme.onAccent, fontSize: 11, fontWeight: '700' },
  list: { flex: 1 },
});
