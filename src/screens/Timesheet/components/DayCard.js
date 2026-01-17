import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TouchableHighlight, Dimensions } from 'react-native';
import { Can } from '../../../components/Can';
import { TeamCard } from './TeamCard';
import { SwipeBlocker } from '../../../components/SwipeBlocker';

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
  const dateMatch = item.humanDate?.match(/(\d{4})/);
  const year = dateMatch ? dateMatch[1] : '';
  const dateWithoutYear = item.humanDate?.replace(/\s*\d{4}\s*г?\.?/, '').trim() || item.humanDate;

  return (
    <View style={styles.dayContainer}>
      <View style={[styles.card, item.isToday && styles.cardToday]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>{dateWithoutYear}</Text>
            <Text style={styles.weekDay}>{item.weekDay}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.yearText}>{year} г</Text>
            <View style={styles.spacer} />
            {item.isToday && <Text style={styles.todayLabel}>Сегодня</Text>}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
    //paddingBottom: 15,
    marginBottom: 4,
	padding: 15,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  spacer: {
    flex: 1,
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
