import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Accelerometer } from 'expo-sensors';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarHeight } from '../../components/TabBar';
import { useTheme, useThemedStyles } from '../../theme';
import {
  cachedDays, closeNotification, emitTasksChanged, forgetTask, getToday, loadNotifications, noteServerToday, productionAPI,
  refreshMe, saveDays, setCopiedTask, subscribeTasksChanged, useCopiedTask, useNotifications, useProductionMe, useToday,
} from '../../services/production';
import { flushTaskChat } from '../../services/taskChat';
import { getUserFacingError } from '../../utils/userFacingError';
import {
  addDays, canCreateOn, dayRange, daysBetween, filtersKey, filtersToParams, filterTags, hasFilters, isOfflineError,
  objectTitle, parseDateKey, toDateKey, unseenWarnings,
} from '../../utils/tasks';
import { useAfterModalClose } from '../../hooks/useAfterModalClose';
import { Dialog, DialogButton } from '../../components/ui/Dialog';
import { DayCard } from './components/DayCard';
import { ActiveFilterTags } from './components/ActiveFilterTags';
import { CalendarModal } from './components/modals/CalendarModal';
import { EditCommentModal } from './components/modals/EditCommentModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { useTaskChat } from './hooks/useTaskChat';
import { FilterSheet } from '../Tasks/FilterSheet';
import { NotificationsSheet } from '../Tasks/NotificationsSheet';
import { ExecutorPickerSheet, ForeignObjectDialog, ObjectPickerSheet } from '../Tasks/pickers';
import { AudioPlayerProvider } from '../../contexts/AudioPlayerContext';
import { SwipeControlProvider, useSwipeControl } from '../../contexts/SwipeControlContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Окно листания: год назад и год вперёд от выбранной даты. Дальше — через календарь (окно сдвигается)
const WINDOW_DAYS = 365;
// Сколько дней по сторонам от открытого подгружать заранее (и держать для работы без связи)
const PRELOAD_DAYS = 3;

/**
 * План-график (ТЗ п. 3.2, 6.4; инт., блок 7) — прежний «Табель», доведённый до правил ТЗ: один день — один экран,
 * под исполнителем (бригада или сотрудник) — карточки объектов-заданий с мини-чатом. Задания и переписка — из API
 * заданий с правами и журналом ТЗ; кнопки — только при праве (п. 4.4).
 */
function PlanScreenContent() {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const tabBarHeight = useTabBarHeight();
  const me = useProductionMe();
  const copied = useCopiedTask();
  const chat = useTaskChat(me?.staff?.id);
  const { flatListRef, scrollEnabled } = useSwipeControl();
  const { closeThen, onDismiss } = useAfterModalClose();

  // «Сегодня» — по серверу в часовом поясе организации (п. 9.2), до первого ответа — по телефону
  const today = useToday();
  const notices = useNotifications();
  const [center, setCenter] = useState(getToday);
  const [current, setCurrent] = useState(getToday);
  const [filters, setFilters] = useState({});
  const [entries, setEntries] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDates, setCalendarDates] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [closingNotice, setClosingNotice] = useState(null);
  const [pasting, setPasting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  // Новое задание из плана-графика: исполнитель → объект → (чужой объект — предупреждение) → создание
  const [adding, setAdding] = useState(null);
  const [picker, setPicker] = useState(null);
  const [foreignObject, setForeignObject] = useState(null);

  const filtersRef = useRef(filters);
  const loadingRef = useRef(new Set());
  // Пользователь сам листал или выбирал дату — не перескакиваем на «сегодня» по ответу сервера
  const movedRef = useRef(false);
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
      noteServerToday(data.today);
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

  // Хук переписки — новый объект на каждый рендер; обновлению и встряхиванию нужна последняя версия, а не подписка заново
  const chatRef = useRef(chat);
  chatRef.current = chat;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    flushTaskChat();
    const { expandedTask, reload } = chatRef.current;
    await Promise.all([
      load(around(current), { force: true }),
      refreshMe(),
      expandedTask ? reload(expandedTask) : null,
    ]);
    setRefreshing(false);
  }, [current, load, around]);

  const reloadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    await loadNotifications();
    setNotificationsLoading(false);
  }, []);

  useEffect(() => {
    reloadNotifications();
    flushTaskChat();
  }, [reloadNotifications]);

  // Телефон думал, что сегодня другой день (часы, часовой пояс): сервер поправил — открываем его «сегодня»
  useEffect(() => {
    if (movedRef.current || current === today) return;
    setCenter(today);
    setCurrent(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // Вкладку открыли снова или вернулись из карточки: тихо обновляем открытые дни, права, уведомления, переписку
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      load(around(current), { force: true });
      refreshMe();
      reloadNotifications();
      flushTaskChat();
      if (chatRef.current.expandedTask) chatRef.current.reload(chatRef.current.expandedTask);
    }
    wasFocused.current = isFocused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Задание создано, изменено, удалено или вставлено — обновляем затронутые дни
  useEffect(() => subscribeTasksChanged((dates) => {
    loadingRef.current.clear();
    load([...new Set([...dates, ...around(current)])], { force: true });
  }), [current, load, around]);

  // Встряхивание — обновить день, как в прежнем «Табеле». Акселерометр: на iPhone не нужно разрешение «Движение»
  useEffect(() => {
    if (!isFocused) return undefined;
    const SHAKE_FORCE_G = 2.3;
    const PEAK_WINDOW_MS = 600;
    const SHAKE_COOLDOWN_MS = 2000;
    let lastPeak = 0;
    let lastShake = 0;
    Accelerometer.setUpdateInterval(100);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (Math.sqrt(x * x + y * y + z * z) < SHAKE_FORCE_G) return;
      const now = Date.now();
      if (now - lastShake < SHAKE_COOLDOWN_MS) return;
      if (now - lastPeak > 80 && now - lastPeak < PEAK_WINDOW_MS) {
        lastShake = now;
        lastPeak = 0;
        refresh();
      } else {
        lastPeak = now;
      }
    });
    return () => subscription.remove();
  }, [isFocused, refresh]);

  // ---- Листание и переход к дате ----

  const goTo = useCallback((date) => {
    movedRef.current = true;
    if (Math.abs(daysBetween(center, date)) > WINDOW_DAYS - 7) {
      setCenter(date);
      setCurrent(date);
      return;
    }
    setCurrent(date);
    flatListRef.current?.scrollToIndex({ index: indexOf(date), animated: false });
  }, [center, indexOf, flatListRef]);

  const onMomentumScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (days[index] && days[index] !== current) {
      movedRef.current = true;
      setCurrent(days[index]);
    }
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

  // ---- Новое задание: «Добавить бригаду» (исполнитель, затем объект) и «+ Объект» у исполнителя ----

  const startAddTeam = (date) => {
    setAdding({ date, executor: null });
    setPicker('executor');
  };

  const startAddObject = (executor, date) => {
    setAdding({ date, executor });
    setPicker('object');
  };

  const pickExecutor = (executor) => {
    setAdding((current) => ({ ...current, executor }));
    closeThen(() => setPicker(null), () => setPicker('object'));
  };

  const createTask = async (object) => {
    const { date, executor } = adding || {};
    setForeignObject(null);
    setAdding(null);
    if (!date || !executor || !object) return;
    try {
      const body = { object_id: object.id, date };
      if (executor.type === 'brigade') body.brigade_id = executor.brigade_id;
      else body.executor_staff_id = executor.staff_id;
      const data = await productionAPI.createTask(body);
      emitTasksChanged([date]);
      // О чужом объекте уже предупредили при выборе
      const warnings = unseenWarnings(data.warnings, object.own ? [] : ['foreign_object']);
      if (warnings.length) Toast.show({ type: 'info', text1: 'Задание поставлено', text2: warnings.join('. '), position: 'top' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Не удалось поставить задание',
        text2: isOfflineError(error) ? 'Ставить задания можно только при связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    }
  };

  // Чужой объект или без ответственного — предупреждение с возможностью продолжить (П-ЗД-08, ИС-ЗД-03)
  const pickObject = (object) => {
    closeThen(() => setPicker(null), () => (object.own ? createTask(object) : setForeignObject(object)));
  };

  // ---- Действия с заданием ----

  const openTask = useCallback((task) => navigation.navigate('Task', { taskId: task.id, task }), [navigation]);
  const editTask = useCallback((task) => navigation.navigate('TaskForm', { task }), [navigation]);

  const copy = (task) => {
    setCopiedTask(task);
    Toast.show({
      type: 'success',
      text1: 'Задание скопировано',
      text2: 'Откройте нужный день и нажмите «Вставить»: перенесутся объект и исполнитель',
      position: 'top',
    });
  };

  // Вставка переносит только объект и исполнителя (П-ЗД-04) — сразу открываем новое задание, чтобы дописать остальное
  const paste = async (date) => {
    if (!copied) return;
    setPasting(true);
    try {
      const data = await productionAPI.copyTask(copied.id, date);
      emitTasksChanged([date]);
      Toast.show({ type: 'success', text1: 'Задание вставлено', text2: 'Допишите, что сделать, или вернитесь назад', position: 'top' });
      if (data?.task?.abilities?.edit) navigation.navigate('TaskForm', { task: data.task });
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
    setDeleting(null);
    setDeletingTask(task.id);
    try {
      await productionAPI.deleteTask(task.id);
      forgetTask(task.id);
      emitTasksChanged([task.date]);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Не удалось удалить',
        text2: isOfflineError(error) ? 'Удалить задание можно только при связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    } finally {
      setDeletingTask(null);
    }
  };

  // ---- Уведомления ----

  const closeNotice = async (item) => {
    setClosingNotice(item.id);
    try {
      await closeNotification(item.id);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Не удалось закрыть уведомление',
        text2: isOfflineError(error) ? 'Закрыть можно при связи' : getUserFacingError(error, 'Попробуйте ещё раз.'),
        position: 'top',
      });
    } finally {
      setClosingNotice(null);
    }
  };

  // Прежний исполнитель доступ к заданию теряет (П-ЗД-32): его уведомление — только для прочтения
  const openNotice = (item) => (item.task_id && item.kind !== 'task_executor_changed'
    ? () => { setNotificationsVisible(false); navigation.navigate('Task', { taskId: item.task_id }); }
    : undefined);

  const tags = filterTags(filters);
  const filtered = tags.length > 0;
  const notificationsCount = notices.length;

  const renderDay = ({ item: date }) => (
    <DayCard
      date={date}
      today={today}
      entry={entries[date]}
      canCreate={canCreateOn(me, date, today)}
      copied={copied}
      refreshing={refreshing && date === current}
      pasting={pasting}
      deletingTask={deletingTask}
      chat={chat}
      notices={date === today ? notices : null}
      closingNotice={closingNotice}
      onRefresh={refresh}
      onAddTeam={startAddTeam}
      onAddObject={startAddObject}
      onPaste={paste}
      onOpenTask={openTask}
      onEditTask={editTask}
      onCopyTask={copy}
      onDeleteTask={setDeleting}
      onCloseNotice={closeNotice}
      onOpenNotice={openNotice}
      bottomInset={tabBarHeight}
    />
  );

  return (
    <AudioPlayerProvider>
      {/* Низ без отступа: на iPhone день прокручивается под «стеклянной» панелью вкладок (iOS 26),
          отступ на её высоту — внутри карточки дня (см. DayCard, bottomInset) */}
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.topBar}>
          <Text style={s.title}>План-график</Text>
          <View style={s.actions}>
            <TouchableOpacity
              style={s.actionButton}
              onPress={() => { setNotificationsVisible(true); reloadNotifications(); }}
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
          ref={flatListRef}
          style={s.list}
          data={days}
          renderItem={renderDay}
          keyExtractor={(date) => date}
          extraData={[entries, today, me, copied, refreshing, pasting, current, notices, closingNotice, chat, deletingTask]}
          initialScrollIndex={indexOf(current)}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          horizontal
          scrollEnabled={scrollEnabled}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          decelerationRate="fast"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={1}
          windowSize={3}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={({ index }) => setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: false }), 100)}
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
          items={notices}
          loading={notificationsLoading}
          closingId={closingNotice}
          onClose={() => setNotificationsVisible(false)}
          onCloseNotice={closeNotice}
          onOpenNotice={openNotice}
        />

        <ExecutorPickerSheet
          visible={picker === 'executor'}
          selected={adding?.executor}
          onPick={pickExecutor}
          onClose={() => { setPicker(null); setAdding(null); }}
          onDismiss={onDismiss}
        />

        <ObjectPickerSheet
          visible={picker === 'object'}
          initialBrigade={adding?.executor?.type === 'brigade' ? { id: adding.executor.brigade_id, name: adding.executor.name } : null}
          onPick={pickObject}
          onClose={() => { setPicker(null); setAdding(null); }}
          onDismiss={onDismiss}
        />

        <ForeignObjectDialog object={foreignObject} onCancel={() => { setForeignObject(null); setAdding(null); }} onContinue={createTask} />

        <EditCommentModal
          visible={!!chat.editingComment}
          comment={chat.editingComment}
          onClose={chat.handleCancelEdit}
          onSave={chat.handleUpdateComment}
          loading={chat.updatingComment}
        />

        <DeleteConfirmModal
          visible={!!chat.deleteTarget}
          title="Удалить сообщение?"
          message="Сообщение пропадёт из переписки задания."
          onCancel={chat.cancelDelete}
          onConfirm={chat.confirmDeleteComment}
        />

        <Dialog
          visible={!!deleting}
          onClose={() => setDeleting(null)}
          title="Удалить задание?"
          message={deleting ? `${objectTitle(deleting.object)}. Задание удалится вместе с перепиской.` : ''}
          buttons={(
            <>
              <DialogButton title="Отмена" onPress={() => setDeleting(null)} />
              <DialogButton title="Удалить" variant="danger" onPress={confirmDelete} />
            </>
          )}
        />
      </SafeAreaView>
    </AudioPlayerProvider>
  );
}

export default function TimesheetScreen() {
  return (
    <SwipeControlProvider>
      <PlanScreenContent />
    </SwipeControlProvider>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.dark ? theme.background : theme.surfaceAlt,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
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
  list: {
    flex: 1,
  },
});
