import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { TeamCard } from './TeamCard';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { NoticeCard } from '../../Tasks/NoticeCard';
import { formatDay, groupByExecutor } from '../../../utils/tasks';
import { useTheme, useThemedStyles } from '../../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Нижние отступы карточки дня (как в styles.contentInner и styles.addTeamButton)
const CONTENT_BOTTOM_GAP = 16;
const BUTTON_BOTTOM_GAP = 10;
// На Android панель вкладок поднимается вместе с клавиатурой и закрывает низ дня: поле переписки — выше неё
const KEYBOARD_GAP = Platform.OS === 'android' ? 96 : 16;

/** День плана-графика (п. 3.2, 6.4): дата, плашки уведомлений на текущем дне, исполнители с объектами-заданиями */
export const DayCard = ({
  date,
  today,
  entry,
  canCreate,
  copied,
  refreshing,
  pasting,
  deletingTask,
  chat,
  notices = null,
  closingNotice,
  onRefresh,
  onAddTeam,
  onAddObject,
  onPaste,
  onOpenTask,
  onEditTask,
  onCopyTask,
  onDeleteTask,
  onCloseNotice,
  onOpenNotice,
  // Высота «стеклянной» панели вкладок поверх карточки (iPhone); 0 — панель ниже экрана (Android)
  bottomInset = 0,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { dateText, weekDay, year } = formatDay(date, today);
  const groups = useMemo(() => groupByExecutor(entry?.items), [entry?.items]);
  const loading = !entry?.items && !entry?.offline;

  return (
    <View style={styles.dayContainer}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.dateText}>
                {dateText}
                {year ? <Text style={styles.yearText}> {year}</Text> : null}
              </Text>
              {!!weekDay && <Text style={styles.weekDay}>{weekDay}</Text>}
            </View>
            {date === today && (
              <View style={styles.todayPill}>
                <Text style={styles.todayLabel}>Сегодня</Text>
              </View>
            )}
          </View>
          {entry?.offline ? (
            <View style={styles.offline}>
              <Ionicons name="cloud-offline-outline" size={15} color={theme.textSecondary} />
              <Text style={styles.offlineText}>
                {entry.items ? 'Нет связи — показаны сохранённые задания' : 'Нет связи, а этот день ещё не загружался'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Поле переписки в раскрытом объекте прокручивается над клавиатурой */}
        <KeyboardAwareScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, !canCreate && bottomInset > 0 && { paddingBottom: CONTENT_BOTTOM_GAP + bottomInset }]}
          nestedScrollEnabled={true}
          directionalLockEnabled={true}
          keyboardShouldPersistTaps='handled'
          bottomOffset={KEYBOARD_GAP}
          refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
        >
          {(notices || []).map((notice) => (
            <NoticeCard
              key={`notice-${notice.id}`}
              notice={notice}
              closing={closingNotice === notice.id}
              onClose={() => onCloseNotice(notice)}
              onPress={onOpenNotice(notice)}
            />
          ))}
          {loading ? (
            <ActivityIndicator style={styles.loader} color={theme.accent} />
          ) : groups.length > 0 ? (
            <View style={(notices || []).length ? styles.afterNotices : null}>
              {groups.map((group) => (
                <TeamCard
                  key={group.key}
                  group={group}
                  canAdd={canCreate}
                  onAddObject={(executor) => onAddObject(executor, date)}
                  chat={chat}
                  deletingTask={deletingTask}
                  onOpenTask={onOpenTask}
                  onEditTask={onEditTask}
                  onCopyTask={onCopyTask}
                  onDeleteTask={onDeleteTask}
                />
              ))}
            </View>
          ) : entry?.items ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={44} color={theme.textMuted} />
              <Text style={styles.emptyText}>{entry.filtered ? 'По фильтру на этот день заданий нет' : 'На этот день заданий нет'}</Text>
            </View>
          ) : null}
        </KeyboardAwareScrollView>

        {canCreate ? (
          <SwipeBlocker>
            <View style={[styles.buttons, bottomInset > 0 && { marginBottom: BUTTON_BOTTOM_GAP + bottomInset }]}>
              <TouchableOpacity style={styles.addTeamButton} onPress={() => onAddTeam(date)} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={theme.onAccent} />
                <Text style={styles.addTeamButtonText}>Добавить бригаду</Text>
              </TouchableOpacity>
              {copied ? (
                <TouchableOpacity
                  style={styles.pasteButton}
                  onPress={() => onPaste(date)}
                  disabled={pasting}
                  activeOpacity={0.8}
                  accessibilityLabel={`Вставить скопированное задание: ${copied.object?.number || ''}`}
                >
                  {pasting ? <ActivityIndicator color={theme.accentText} /> : (
                    <>
                      <Ionicons name="clipboard-outline" size={18} color={theme.accentText} />
                      <Text style={styles.pasteText}>Вставить</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </SwipeBlocker>
        ) : null}
      </View>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  dayContainer: {
    width: SCREEN_WIDTH,
  },
  card: {
    flex: 1,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  dateText: {
    fontSize: 20,
    color: theme.text,
    fontWeight: '600',
  },
  yearText: {
    color: theme.textSecondary,
    fontWeight: '500',
  },
  weekDay: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 1,
  },
  todayPill: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todayLabel: {
    fontSize: 13,
    color: theme.onAccent,
    fontWeight: '700',
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  offlineText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 12,
    paddingBottom: CONTENT_BOTTOM_GAP,
    flexGrow: 1,
  },
  loader: {
    marginTop: 48,
  },
  afterNotices: {
    marginTop: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: BUTTON_BOTTOM_GAP,
    marginTop: 6,
  },
  addTeamButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTeamButtonText: {
    color: theme.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
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
  pasteText: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
});
