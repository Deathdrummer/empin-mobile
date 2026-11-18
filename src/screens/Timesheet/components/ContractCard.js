import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, Pressable, Dimensions } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ChatSection } from './ChatSection';
import { CommentsIcon } from './CommentsIcon';
import { ContractContextMenu } from './ContractContextMenu';
import { useTheme, useThemedStyles } from '../../../theme';
import { messengerAPI } from '../../../services/api';
import { setTotalUnread } from '../../../services/messengerStore';
import { shortName, vehicleTitle } from '../../../utils/tasks';

const MENU_ITEM_HEIGHT = 50;

/**
 * Карточка объекта в плане-графике — это задание (п. 6.4): номер, название, титул, как в прежнем «Табеле», плюс
 * кратко содержание, техника и водитель
 */
export const ContractCard = ({ task, chat, onOpenTask, onEditTask, onCopyTask, onDeleteTask, deleting }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isExpanded = chat.expandedTask === task.id;
  const state = chat.chatState(task.id);
  const items = isExpanded ? chat.itemsFor(task.id) : null;
  const count = items ? items.length : task.comments_count || 0;
  const object = task.object || {};
  const abilities = task.abilities || {};

  // Переписку задания открыли в плане-графике — в «Чатах» объект больше не непрочитанный
  useEffect(() => {
    if (!isExpanded || !object.id) return;
    messengerAPI.markObjectRead(object.id)
      .then((data) => setTotalUnread(data.total_unread))
      .catch(() => {});
  }, [isExpanded, object.id, items?.length]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const cardRef = useRef(null);

  const closeMenu = () => setMenuVisible(false);
  const run = (action) => () => {
    closeMenu();
    setTimeout(action, 100);
  };
  const copy = (text) => run(() => Clipboard.setStringAsync(text || ''));

  const menuItems = [
    { key: 'open', label: 'Открыть задание', icon: 'clipboard-text-outline', onPress: run(() => onOpenTask(task)) },
    ...(abilities.edit ? [{ key: 'edit', label: 'Изменить', icon: 'pencil-outline', onPress: run(() => onEditTask(task)) }] : []),
    ...(abilities.copy ? [{ key: 'copy-task', label: 'Копировать задание', icon: 'content-duplicate', onPress: run(() => onCopyTask(task)) }] : []),
    ...(isExpanded
      ? [
        { key: 'number', label: 'Скопировать номер объекта', icon: 'content-copy', onPress: copy(object.number) },
        { key: 'title', label: 'Скопировать название объекта', icon: 'content-copy', onPress: copy(object.title) },
        { key: 'titul', label: 'Скопировать титул', icon: 'content-copy', onPress: copy(object.titul) },
      ]
      : [{ key: 'all', label: 'Скопировать данные договора', icon: 'content-copy', onPress: copy([object.number, object.title, object.titul || '[ПУСТО]'].join('\n')) }]),
    ...(abilities.delete ? [{ key: 'delete', label: 'Удалить', icon: 'delete-outline', danger: true, onPress: run(() => onDeleteTask(task)) }] : []),
  ];

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    cardRef.current?.measure((x, y, width, height, pageX, pageY) => {
      // Меню целиком на экране, даже у карточки внизу
      const menuHeight = menuItems.length * MENU_ITEM_HEIGHT + 8;
      const screenHeight = Dimensions.get('window').height;
      setMenuTop(Math.max(40, Math.min(pageY, screenHeight - menuHeight - 40)));
      setMenuVisible(true);
    });
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
          onPress={() => chat.toggle(task.id)}
          onLongPress={handleLongPress}
          ref={cardRef}
          style={({ pressed }) => [
            styles.contractWrapper,
            isExpanded && styles.contractExpanded,
            pressed && styles.contractPressed,
          ]}
        >
          {(chat.addingComment === task.id || deleting) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          )}
          <View style={styles.contractRow}>
            <View style={styles.col1}>
              <Text style={styles.contractNumber}>{object.number || '—'}</Text>
              {count > 0 && <CommentsIcon count={count} />}
            </View>
            <View style={styles.col2}>
              <Text style={styles.contractTitle}>{object.title || 'Объект'}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.contractTitul}>{object.titul || '[ПУСТО]'}</Text>
            </View>
          </View>

          {task.text ? (
            <Text style={styles.taskText} numberOfLines={isExpanded ? undefined : 2}>{task.text}</Text>
          ) : null}
          {task.vehicle ? (
            <View style={styles.vehicleRow}>
              <Ionicons name="car" size={14} color={theme.textSecondary} />
              <Text style={styles.vehicleText} numberOfLines={1}>
                {vehicleTitle(task.vehicle)}
                {task.driver?.name ? `  ·  ${shortName(task.driver.name)}` : '  ·  без водителя'}
              </Text>
            </View>
          ) : null}

          {isExpanded ? (
            <>
              {state?.offline ? (
                <Text style={styles.chatNotice}>Нет связи — показана сохранённая переписка</Text>
              ) : null}
              {state?.gone ? (
                <Text style={styles.chatNotice}>Доступа к заданию больше нет</Text>
              ) : (
                <ChatSection
                  chat={items}
                  canWrite={state ? state.canWrite !== false : true}
                  commentText={chat.commentText}
                  replyingToComment={chat.replyingToComment}
                  deletingComment={chat.deletingComment}
                  onCommentChange={chat.setCommentText}
                  onAddComment={async (text, selectedMedia) => {
                    // Голосовое приходит массивом первым аргументом — как в прежнем «Табеле»
                    const mediaArray = selectedMedia !== undefined ? selectedMedia : (Array.isArray(text) ? text : []);
                    await chat.handleAddComment(task.id, mediaArray);
                  }}
                  onDeleteComment={chat.handleDeleteComment}
                  onEditComment={chat.handleEditComment}
                  onReplyComment={chat.handleReplyComment}
                  onToggleReaction={chat.handleToggleReaction}
                  onCancelReply={chat.handleCancelReply}
                  onRetryPending={chat.retryPending}
                  onDiscardPending={chat.discardPending}
                />
              )}
            </>
          ) : null}
        </Pressable>
      </Shadow>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <View style={styles.menuContainer}>
            {menuVisible ? <ContractContextMenu position={{ top: menuTop }} items={menuItems} /> : null}
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
  taskText: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.text,
    marginTop: 10,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  vehicleText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
  },
  chatNotice: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 10,
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
