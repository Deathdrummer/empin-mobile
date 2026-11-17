import React from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import { formatDay } from '../../utils/tasks';
import { TaskCard } from './TaskCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_BOTTOM_GAP = 16;
const BUTTON_BOTTOM_GAP = 10;

/**
 * Один день — один экран (п. 3.2): дата, плашки заданий, внизу «Добавить задание» и «Вставить».
 * Кнопки — только при праве «Создавать задания» и не на прошедший день (п. 4.4, П-ЗД-05).
 */
export const TaskDayPage = ({
  date,
  today,
  entry,
  canCreate,
  copied,
  refreshing,
  pasting,
  onRefresh,
  onAdd,
  onPaste,
  onOpenTask,
  onTaskMenu,
  bottomInset = 0,
}) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const { dateText, weekDay, year } = formatDay(date, today);
  const items = entry?.items || [];
  const showButtons = canCreate;

  return (
    <View style={s.page}>
      <View style={s.header}>
        <View style={s.headerContent}>
          <View style={s.headerText}>
            <Text style={s.dateText}>
              {dateText}
              {year ? <Text style={s.yearText}> {year}</Text> : null}
            </Text>
            {weekDay ? <Text style={s.weekDay}>{weekDay}</Text> : null}
          </View>
          {date === today ? (
            <View style={s.todayPill}>
              <Text style={s.todayLabel}>Сегодня</Text>
            </View>
          ) : null}
        </View>
        {entry?.offline ? (
          <View style={s.offline}>
            <Ionicons name="cloud-offline-outline" size={15} color={theme.textSecondary} />
            <Text style={s.offlineText}>
              {entry.items ? 'Нет связи — показаны сохранённые задания' : 'Нет связи, а этот день ещё не загружался'}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.contentInner, !showButtons && bottomInset > 0 && { paddingBottom: CONTENT_BOTTOM_GAP + bottomInset }]}
        refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        {!entry?.items && !entry?.offline ? (
          <ActivityIndicator style={s.loader} color={theme.accent} />
        ) : items.length ? (
          items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => onOpenTask(task)}
              onLongPress={() => onTaskMenu(task)}
            />
          ))
        ) : entry?.items ? (
          <View style={s.empty}>
            <Ionicons name="clipboard-outline" size={44} color={theme.textMuted} />
            <Text style={s.emptyText}>{entry.filtered ? 'По фильтру на этот день заданий нет' : 'На этот день заданий нет'}</Text>
          </View>
        ) : null}
      </ScrollView>

      {showButtons ? (
        <View style={[s.buttons, bottomInset > 0 && { marginBottom: BUTTON_BOTTOM_GAP + bottomInset }]}>
          <TouchableOpacity style={s.addButton} onPress={() => onAdd(date)} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={theme.onAccent} />
            <Text style={s.addButtonText}>Добавить задание</Text>
          </TouchableOpacity>
          {copied ? (
            <TouchableOpacity
              style={s.pasteButton}
              onPress={() => onPaste(date)}
              disabled={pasting}
              activeOpacity={0.8}
              accessibilityLabel={`Вставить скопированное задание: ${copied.object?.number || ''}`}
            >
              {pasting ? <ActivityIndicator color={theme.accentText} /> : (
                <>
                  <Ionicons name="clipboard-outline" size={18} color={theme.accentText} />
                  <Text style={s.pasteText}>Вставить</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  page: { width: SCREEN_WIDTH, flex: 1 },
  header: { paddingTop: 4, paddingBottom: 6, paddingHorizontal: 16 },
  headerContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: { flex: 1 },
  dateText: { fontSize: 20, color: theme.text, fontWeight: '600' },
  yearText: { color: theme.textSecondary, fontWeight: '500' },
  weekDay: { fontSize: 14, color: theme.textSecondary, marginTop: 1 },
  todayPill: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  todayLabel: { fontSize: 13, color: theme.onAccent, fontWeight: '700' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  offlineText: { flex: 1, fontSize: 13, color: theme.textSecondary },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 12, paddingBottom: CONTENT_BOTTOM_GAP, flexGrow: 1 },
  loader: { marginTop: 48 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: BUTTON_BOTTOM_GAP, marginTop: 6 },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: theme.onAccent, fontSize: 16, fontWeight: '600' },
  pasteButton: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentSoft,
  },
  pasteText: { color: theme.accentText, fontSize: 16, fontWeight: '600' },
});
