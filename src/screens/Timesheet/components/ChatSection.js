import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { Can } from '../../../components/Can';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatShortName } from '../../../utils/formatName';
import { EmojiPicker } from './EmojiPicker';
import { CommentContextMenu } from './CommentContextMenu';

// Функция форматирования даты в формат "20:41 10.11.25"
const formatDateTime = (dateString) => {
  if (!dateString) return '';

  // Пробуем создать объект Date из строки
  const date = new Date(dateString);

  // Проверяем, является ли дата валидной
  if (isNaN(date.getTime())) {
    // Если не получилось распарсить, возвращаем оригинальную строку
    return dateString;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${day}.${month}.${year}`;
};

export const ChatSection = ({
  chat,
  commentText,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onEditComment
}) => {
  const [lastTap, setLastTap] = React.useState(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });
  const [selectedComment, setSelectedComment] = React.useState(null);
  const { can } = usePermissions();

  const handleDoubleTap = (comment) => {
    if (!comment.self) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      // Двойной тап - редактирование
      setLastTap(null); // Сброс чтобы следующий клик был первым

      // Проверяем права на редактирование
      if (!can('mobile-app-can-edit-comment:site')) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для редактирования комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      console.log('[Haptics] Medium impact triggered');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onEditComment(comment);
    } else {
      setLastTap(now);
    }
  };

  const handleCommentLongPress = (comment, event) => {
    if (!comment.self) return;

    console.log('[Haptics] Heavy impact triggered');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Получаем позицию нажатия
    event.target.measure((x, y, width, height, pageX, pageY) => {
      setMenuPosition({ top: pageY, left: pageX });
      setSelectedComment(comment);
      setMenuVisible(true);
    });
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
    setSelectedComment(null);
  };

  const handleMenuEdit = () => {
    handleCloseMenu();
    if (selectedComment) {
      onEditComment(selectedComment);
    }
  };

  const handleMenuDelete = () => {
    handleCloseMenu();
    if (selectedComment) {
      onDeleteComment(selectedComment.id);
    }
  };

  const handleEmojiSelect = (emoji) => {
    console.log('Selected emoji:', emoji);
    // TODO: Добавить логику реакции на комментарий
    handleCloseMenu();
  };

  return (
    <View style={styles.chatContainer}>
      {chat && chat.length > 0 && (
        chat.map((comment) => (
          <TouchableOpacity
            key={comment.id}
            style={[
              styles.chatMessage,
              comment.self && styles.chatMessageSelf,
            ]}
            onPress={() => handleDoubleTap(comment)}
            onLongPress={(event) => handleCommentLongPress(comment, event)}
            activeOpacity={0.7}
          >
            <View style={styles.chatHeader}>
              {comment.self ? (
                <>
                  <Text style={styles.chatDateTime}>{formatDateTime(comment.created_at)}</Text>
                  <Text style={styles.chatAuthor}>
                    {formatShortName(comment.from)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.chatAuthor}>
                    {formatShortName(comment.from)}
                  </Text>
                  <Text style={styles.chatDateTime}>{formatDateTime(comment.created_at)}</Text>
                </>
              )}
            </View>
            <Text style={[
              styles.chatText,
              comment.self && styles.chatTextSelf
            ]}>{comment.message}</Text>
          </TouchableOpacity>
        ))
      )}

      <Can permission="mobile-app-can-create-comment:site">
        <View style={styles.chatInputWrapper}>
          <TextInput
            style={[
              styles.chatTextInput,
              isFocused && styles.chatTextInputFocused
            ]}
            placeholder="Ваш комментарий..."
            value={commentText}
            onChangeText={onCommentChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline
          />
          <TouchableOpacity
            style={styles.chatSendButton}
            onPress={onAddComment}
            disabled={!commentText.trim()}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.chatSendButtonIcon,
              !commentText.trim() && styles.chatSendButtonIconDisabled
            ]}>➤</Text>
          </TouchableOpacity>
        </View>
      </Can>

      {/* Модальное окно с меню и эмоджи */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseMenu}>
          <View style={styles.menuContainer}>
            {menuVisible && (
              <>
                <EmojiPicker
                  position={menuPosition}
                  onEmojiSelect={handleEmojiSelect}
                />
                <CommentContextMenu
                  position={menuPosition}
                  onEdit={handleMenuEdit}
                  onDelete={handleMenuDelete}
                />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    marginTop: 15,
  },
  chatMessage: {
    marginBottom: 8,
	width: '95%',
	alignSelf: 'flex-end',
  },
  chatMessageSelf: {
    alignItems: 'flex-end',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 0,
    gap: 6,
  },
  chatAuthor: {
    fontSize: 12,
    fontWeight: '300',
    color: '#B0B0B0',
  },
  chatDateTime: {
    fontSize: 10,
	lineHeight: 10,
    color: '#CDCDCD',
	position: 'relative',
	top: -2
  },
  chatText: {
    fontSize: 13,
    color: '#333',
  },
  chatTextSelf: {
    textAlign: 'right',
  },
  chatInputWrapper: {
    position: 'relative',
    marginTop: 10,
  },
  chatTextInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    paddingRight: 45,
    fontSize: 14,
    minHeight: 40,
    backgroundColor: '#fff',
  },
  chatTextInputFocused: {
    borderColor: '#999999',
  },
  chatSendButton: {
    position: 'absolute',
    right: 5,
    top: '50%',
    transform: [{ translateY: -15 }],
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonIcon: {
    color: '#999999',
    fontSize: 20,
    marginTop: -3
  },
  chatSendButtonIconDisabled: {
    color: '#D0D0D0',
  },
  emptyText: {
    fontSize: 14,
    color: '#AEAEAE',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    flex: 1,
    position: 'relative',
  },
});
