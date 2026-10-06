import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableHighlight, Dimensions } from 'react-native';
import { Can } from '../../../components/Can';
import { TeamCard } from './TeamCard';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { formatTimesheetDay } from '../../../utils/dateTime';

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
  const { dateText, weekDay, year } = formatTimesheetDay(item);

  return (
    <View style={styles.dayContainer}>
      <View style={[styles.card, item.isToday && styles.cardToday]}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.dateText}>{dateText}</Text>
              {!!weekDay && <Text style={styles.weekDay}>{weekDay}</Text>}
            </View>
            <View style={styles.headerRight}>
              {!!year && <Text style={styles.yearText}>{year} г</Text>}
              {item.isToday && <Text style={styles.todayLabel}>Сегодня</Text>}
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.content}
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
              <Text style={styles.emptyText}>Нет бригад</Text>
            </View>
          )}
        </ScrollView>

        <Can permission="mobile-app-can-create-team:site">
          <SwipeBlocker>
            <TouchableHighlight
              style={styles.addTeamButton}
              onPress={() => onAddTeam(item)}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.addTeamButtonText}>+ Добавить бригаду</Text>
            </TouchableHighlight>
          </SwipeBlocker>
        </Can>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dayContainer: {
    width: SCREEN_WIDTH,
    //padding: 15,
  },
  card: {
    flex: 1,
  },
  cardToday: {

  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    minHeight: 58,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 22,
    color: '#555',
    fontWeight: 'normal',
  },
  weekDay: {
    fontSize: 22,
    color: '#aaa',
    fontWeight: 'bold',
    marginTop: 2,
  },
  yearText: {
    fontSize: 16,
    color: '#555',
  },
  todayLabel: {
    fontSize: 22,
    color: '#555',
    fontWeight: 'bold',
    marginTop: 2,
  },
  content: {
    flex: 1,
	padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  addTeamButton: {
    backgroundColor: '#999999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  addTeamButtonText: {
    color: '#fff',
    fontSize: 16,
	lineHeight: 16,
    fontWeight: '700',
  },
});
