import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Can } from '../../../components/Can';
import { TeamCard } from './TeamCard';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { formatTimesheetDay } from '../../../utils/dateTime';
import { useTheme, useThemedStyles } from '../../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DayCard = ({
  item,
  expandedContract,
  commentText,
  addingComment,
  replyingToComment,
  deletingTeam,
  deletingContract,
  deletingComment,
  onAddTeam,
  onDeleteTeam,
  onAddContract,
  onDeleteContract,
  onDeleteContractDirect,
  onToggleChat,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onReplyComment,
  onToggleReaction,
  onCancelReply,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { dateText, weekDay, year } = formatTimesheetDay(item);
  const showYear = !!year && Number(year) !== new Date().getFullYear();

  return (
    <View style={styles.dayContainer}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.dateText}>
                {dateText}
                {showYear ? <Text style={styles.yearText}> {year}</Text> : null}
              </Text>
              {!!weekDay && <Text style={styles.weekDay}>{weekDay}</Text>}
            </View>
            {item.isToday && (
              <View style={styles.todayPill}>
                <Text style={styles.todayLabel}>Сегодня</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          nestedScrollEnabled={true}
          directionalLockEnabled={true}
          keyboardShouldPersistTaps='handled'
        >
          {item.teams && item.teams.length > 0 ? (
            item.teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                expandedContract={expandedContract}
                commentText={commentText}
                addingComment={addingComment}
                replyingToComment={replyingToComment}
                deletingTeam={deletingTeam}
                deletingContract={deletingContract}
                deletingComment={deletingComment}
                onDeleteTeam={onDeleteTeam}
                onAddContract={onAddContract}
                onDeleteContract={onDeleteContract}
                onDeleteContractDirect={onDeleteContractDirect}
                onToggleChat={onToggleChat}
                onCommentChange={onCommentChange}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onEditComment={onEditComment}
                onReplyComment={onReplyComment}
                onToggleReaction={onToggleReaction}
                onCancelReply={onCancelReply}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={44} color={theme.textMuted} />
              <Text style={styles.emptyText}>На этот день бригад нет</Text>
            </View>
          )}
        </ScrollView>

        <Can permission="mobile-app-can-create-team:site">
          <SwipeBlocker>
            <TouchableOpacity
              style={styles.addTeamButton}
              onPress={() => onAddTeam(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color={theme.onAccent} />
              <Text style={styles.addTeamButtonText}>Добавить бригаду</Text>
            </TouchableOpacity>
          </SwipeBlocker>
        </Can>
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
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    flexGrow: 1,
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
  addTeamButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: 14,
    minHeight: 48,
    marginHorizontal: 12,
    marginBottom: 10,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTeamButtonText: {
    color: theme.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
});
