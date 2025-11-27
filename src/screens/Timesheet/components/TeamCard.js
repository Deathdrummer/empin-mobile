import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableHighlight } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Can } from '../../../components/Can';
import { ContractCard } from './ContractCard';
import { formatShortName } from '../../../utils/formatName';

export const TeamCard = ({
  team,
  expandedContract,
  commentText,
  addingComment,
  replyingToComment,
  onDeleteTeam,
  onAddContract,
  onDeleteContract,
  onToggleChat,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onReplyComment,
  onToggleReaction,
  onCancelReply,
}) => {
  const masterName = formatShortName(team.master);

  return (
    <TouchableOpacity
      style={styles.team}
      activeOpacity={0.7}
      onLongPress={() => {
        console.log('[Haptics] Heavy impact triggered');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onDeleteTeam(team.id, masterName);
      }}
    >
      <View style={styles.teamHeader}>
        <Text style={styles.masterName}>
          {masterName}
        </Text>
        <Can permission="mobile-app-can-create-contract:site">
          <TouchableHighlight
            style={styles.addButton}
            onPress={() => onAddContract(team.id)}
            underlayColor="#7a7a7a"
          >
            <View style={styles.addButtonContent}>
              <Text style={styles.addButtonText}>Добавить объект</Text>
              <Text style={styles.addButtonIcon}>+</Text>
            </View>
          </TouchableHighlight>
        </Can>
      </View>

      {team.contracts && team.contracts.length > 0 && (
        team.contracts.map((contract) => (
          <ContractCard
            key={contract.timesheet_contract_id}
            contract={contract}
            expandedContract={expandedContract}
            commentText={commentText}
            addingComment={addingComment}
            replyingToComment={replyingToComment}
            onToggleChat={() => onToggleChat(contract.timesheet_contract_id)}
            onDeleteContract={onDeleteContract}
            onCommentChange={onCommentChange}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onEditComment={onEditComment}
            onReplyComment={onReplyComment}
            onToggleReaction={onToggleReaction}
            onCancelReply={onCancelReply}
          />
        ))
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  team: {
    marginBottom: 32,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  masterName: {
    fontSize: 22,
	lineHeight: 20,
    fontWeight: 'bold',
    color: '#555',
    flex: 1,
  },
  addButton: {
    borderRadius: 8,
    backgroundColor: '#999999',
    marginLeft: 10,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
	lineHeight: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  addButtonIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 20,
  },
  addButtonCompact: {
    borderWidth: 2,
    borderColor: '#b5bcc8',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  addButtonCompactText: {
    color: '#b5bcc8',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
  emptyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
});
