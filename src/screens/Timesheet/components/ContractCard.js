import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import * as Haptics from 'expo-haptics';
import { ChatSection } from './ChatSection';
import { CommentsIcon } from './CommentsIcon';

export const ContractCard = ({
  contract,
  expandedContract,
  commentText,
  addingComment,
  onToggleChat,
  onDeleteContract,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onEditComment,
}) => {
  const isExpanded = expandedContract === contract.timesheet_contract_id;
  const isAddingComment = addingComment === contract.timesheet_contract_id;

  return (
    <Shadow
      distance={10}
      startColor={'#a2a2a233'}
      offset={[0, 0]}
      containerStyle={styles.shadowContainer}
      style={styles.shadowStyle}
    >
      <View style={styles.contractWrapper}>
      {isAddingComment && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#999999" />
        </View>
      )}
      <TouchableOpacity
        style={styles.contract}
        activeOpacity={0.7}
        onPress={onToggleChat}
        onLongPress={() => {
          console.log('[Haptics] Heavy impact triggered');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onDeleteContract(
            contract.timesheet_contract_id,
            `${contract.object_number} - ${contract.title}`
          );
        }}
      >
        <View style={styles.contractRow}>
          <View style={styles.col1}>
            <Text style={styles.contractNumber}>{contract.object_number}</Text>
            {contract.chat && contract.chat.length > 0 && (
              <CommentsIcon count={contract.chat.length} />
            )}
          </View>
          <View style={styles.col2}>
            <Text style={styles.contractTitle}>{contract.title}</Text>
          </View>
          <View style={styles.col3}>
            <Text style={styles.contractTitul}>{contract.titul || '[ПУСТО]'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <ChatSection
          chat={contract.chat}
          commentText={commentText}
          onCommentChange={onCommentChange}
          onAddComment={() => onAddComment(contract.timesheet_contract_id)}
          onDeleteComment={onDeleteComment}
          onEditComment={onEditComment}
        />
      )}
    </View>
    </Shadow>
  );
};

const styles = StyleSheet.create({
  shadowContainer: {
    marginTop: 16,
  },
  shadowStyle: {
    width: '100%',
  },
  contractWrapper: {
    position: 'relative',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  contract: {
	//display: 'none'
  },
  contractRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  col1: {
    width: 40,
    flexShrink: 0,
    position: 'relative',
  },
  col2: {
    width: 80,
    flexShrink: 0,
  },
  col3: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  contractNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4A4A4A',
    flexShrink: 1,
  },
  contractTitle: {
    fontSize: 11,
    color: '#4A4A4A',
    flexShrink: 1,
  },
  contractTitul: {
    fontSize: 11,
    color: '#4A4A4A',
    flexShrink: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    zIndex: 10,
  },
});
