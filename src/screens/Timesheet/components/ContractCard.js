import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { ChatSection } from './ChatSection';
import { CommentsIcon } from './CommentsIcon';
import { ContractContextMenu } from './ContractContextMenu';
import { useTheme, useThemedStyles } from '../../../theme';

export const ContractCard = ({
  contract,
  expandedContract,
  commentText,
  addingComment,
  replyingToComment,
  deletingContract,
  deletingComment,
  onToggleChat,
  onDeleteContract,
  onDeleteContractDirect,
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
  const isExpanded = expandedContract === contract.timesheet_contract_id;
  const isAddingComment = addingComment === contract.timesheet_contract_id;
  const isDeletingThisContract = deletingContract === contract.timesheet_contract_id;

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const contractRef = useRef(null);

  const handleLongPress = (event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (contractRef.current) {
      contractRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuPosition({ top: pageY, left: pageX });
        setMenuVisible(true);
      });
    }
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
  };

  const handleDelete = () => {
    onDeleteContract(
      contract.timesheet_contract_id,
      `${contract.object_number} - ${contract.title}`
    );
    setTimeout(() => handleCloseMenu(), 100);
  };

  const handleCopyNumber = async () => {
    await Clipboard.setStringAsync(contract.object_number);
    handleCloseMenu();
  };

  const handleCopyTitle = async () => {
    await Clipboard.setStringAsync(contract.title);
    handleCloseMenu();
  };

  const handleCopyTitul = async () => {
    const titulText = contract.titul || '';
    await Clipboard.setStringAsync(titulText);
    handleCloseMenu();
  };

  const handleCopyAllData = async () => {
    const allData = [
      contract.object_number,
      contract.title,
      contract.titul || '[ПУСТО]'
    ].join('\n');
    await Clipboard.setStringAsync(allData);
    handleCloseMenu();
  };

  return (
    <>
      <Shadow
        distance={6}
        startColor={theme.shadow}
        disabled={theme.dark}
        offset={[0, 1]}
        containerStyle={styles.shadowContainer}
        style={styles.shadowStyle}
      >
        <Pressable
          onPress={onToggleChat}
          onLongPress={handleLongPress}
          ref={contractRef}
          style={({ pressed }) => [
            styles.contractWrapper,
            isExpanded && styles.contractExpanded,
            pressed && styles.contractPressed
          ]}
        >
          {(isAddingComment || isDeletingThisContract) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          )}
          <View style={styles.contract}>
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
          </View>

          {isExpanded && (
            <ChatSection
              chat={contract.chat}
              commentText={commentText}
              replyingToComment={replyingToComment}
              deletingComment={deletingComment}
              onCommentChange={onCommentChange}
              onAddComment={async (text, selectedMedia) => {
                // ИСПРАВЛЕНИЕ: если selectedMedia undefined, значит text содержит массив медиа (голосовое сообщение)
                const mediaArray = selectedMedia !== undefined ? selectedMedia : (Array.isArray(text) ? text : []);
                await onAddComment(contract.timesheet_contract_id, mediaArray);
              }}
              onDeleteComment={onDeleteComment}
              onEditComment={onEditComment}
              onReplyComment={onReplyComment}
              onToggleReaction={onToggleReaction}
              onCancelReply={onCancelReply}
            />
          )}
        </Pressable>
    </Shadow>

    <Modal
      visible={menuVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseMenu}
    >
      <Pressable style={styles.modalOverlay} onPress={handleCloseMenu}>
        <View style={styles.menuContainer}>
          {menuVisible && (
            <ContractContextMenu
              position={menuPosition}
              isExpanded={isExpanded}
              onDelete={handleDelete}
              onCopyNumber={handleCopyNumber}
              onCopyTitle={handleCopyTitle}
              onCopyTitul={handleCopyTitul}
              onCopyAllData={handleCopyAllData}
            />
          )}
        </View>
      </Pressable>
    </Modal>
    </>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  shadowContainer: {
    marginTop: 10,
  },
  shadowStyle: {
    width: '100%',
    borderRadius: 14,
  },
  contractWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.dark ? theme.separator : theme.surface,
  },
  contractExpanded: {
    borderColor: theme.accentSoft,
  },
  contractPressed: {
    backgroundColor: theme.surfacePressed,
  },
  contract: {
  },
  contractRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  col1: {
    width: 44,
    flexShrink: 0,
    position: 'relative',
  },
  col2: {
    width: 84,
    flexShrink: 0,
  },
  col3: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  contractNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    flexShrink: 1,
  },
  contractTitle: {
    fontSize: 12,
    color: theme.text,
    flexShrink: 1,
  },
  contractTitul: {
    fontSize: 12,
    color: theme.textSecondary,
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
    backgroundColor: theme.veil,
    borderRadius: 14,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
  },
  menuContainer: {
    flex: 1,
    position: 'relative',
  },
});
