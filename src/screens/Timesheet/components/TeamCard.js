import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../theme';
import { Can } from '../../../components/Can';
import { ContractCard } from './ContractCard';
import { formatShortName } from '../../../utils/formatName';
import { SwipeBlocker } from '../../../components/SwipeBlocker';

export const TeamCard = ({
  team,
  expandedContract,
  commentText,
  addingComment,
  replyingToComment,
  deletingTeam,
  deletingContract,
  deletingComment,
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
  const masterName = formatShortName(team.master);
  const isDeletingThisTeam = deletingTeam === team.id;

  return (
    <View style={styles.teamWrapper}>
      {isDeletingThisTeam && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}
      <TouchableOpacity
        style={styles.team}
        activeOpacity={0.7}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onDeleteTeam(team.id, masterName);
        }}
      >
        <View style={styles.teamHeader}>
        <Ionicons name="people" size={18} color={theme.textSecondary} />
        <Text style={styles.masterName} numberOfLines={2}>
          {masterName}
        </Text>
        <Can permission="mobile-app-can-create-contract:site">
          <SwipeBlocker>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onAddContract(team.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Добавить объект: ${masterName}`}
            >
              <Ionicons name="add" size={18} color={theme.accentText} />
              <Text style={styles.addButtonText}>Объект</Text>
            </TouchableOpacity>
          </SwipeBlocker>
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
            deletingContract={deletingContract}
            deletingComment={deletingComment}
            onToggleChat={() => onToggleChat(contract.timesheet_contract_id)}
            onDeleteContract={onDeleteContract}
            onDeleteContractDirect={onDeleteContractDirect}
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
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  teamWrapper: {
    position: 'relative',
    marginBottom: 22,
  },
  team: {
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.veil,
    borderRadius: 14,
    zIndex: 10,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  masterName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 16,
    backgroundColor: theme.accentSoft,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: theme.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
});
