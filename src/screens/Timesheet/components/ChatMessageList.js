import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../../../services/api';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatShortName } from '../../../utils/formatName';
import { EmojiPicker } from './EmojiPicker';
import { CommentContextMenu } from './CommentContextMenu';
import { MediaCollage } from './MediaCollage';
import { DocumentList } from './DocumentList';
import { AudioPlayer } from './AudioPlayer';
import { SwipeBlocker } from '../../../components/SwipeBlocker';

// Маппинг эмоджи на иконки MaterialCommunityIcons
const EMOJI_TO_ICON = {
  '👍': { icon: 'thumb-up', color: '#757575' },
  '👎': { icon: 'thumb-down', color: '#757575' },
  '❤️': { icon: 'heart', color: '#757575' },
  '🔥': { icon: 'fire', color: '#757575' },
  '👀': { icon: 'eye', color: '#757575' },
};

// Константы для расчета позиции меню
const EMOJI_PICKER_HEIGHT = 60;
const CONTEXT_MENU_HEIGHT = 240;
const SCREEN_PADDING = 20;
const EMOJI_OFFSET = 60;
const MENU_OFFSET = 10;

// Функция форматирования даты в формат "20:41 10.11.25"
const formatDateTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return dateString;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${day}.${month}.${year}`;
};

// Функция форматирования времени редактирования
const formatEditTime = (createdAt, updatedAt) => {
  if (!updatedAt) return '';

  const updated = new Date(updatedAt);
  if (isNaN(updated.getTime())) return '';

  const hours = String(updated.getHours()).padStart(2, '0');
  const minutes = String(updated.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (createdAt) {
    const created = new Date(createdAt);
    if (!isNaN(created.getTime())) {
      const createdDate = created.toDateString();
      const updatedDate = updated.toDateString();

      if (createdDate !== updatedDate) {
        const day = String(updated.getDate()).padStart(2, '0');
        const month = String(updated.getMonth() + 1).padStart(2, '0');
        return `${timeStr} ${day}.${month}`;
      }
    }
  }

  return timeStr;
};

// Функция проверки, был ли комментарий отредактирован
const isCommentEdited = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;

  const created = new Date(createdAt);
  const updated = new Date(updatedAt);

  if (isNaN(created.getTime()) || isNaN(updated.getTime())) return false;

  return Math.abs(updated.getTime() - created.getTime()) > 1000;
};

// Функция группировки реакций
const groupReactions = (reactions, currentUserId) => {
  if (!reactions || !Array.isArray(reactions)) return [];

  const grouped = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = {
        emoji,
        count: 0,
        hasCurrentUserReacted: false,
      };
    }
    acc[emoji].count++;
    if (reaction.user_id === currentUserId) {
      acc[emoji].hasCurrentUserReacted = true;
    }
    return acc;
  }, {});

  return Object.values(grouped);
};

// Функция для определения типа медиа
const isMediaFile = (media) => {
  if (!media) return false;

  if (media.mimeType) {
    if (media.mimeType.startsWith('audio/') || media.mimeType === 'application/ogg') {
      return false;
    }
    return media.mimeType.startsWith('image/') || media.mimeType.startsWith('video/');
  }

  if (media.uri || media.name) {
    const fileName = (media.uri || media.name).toLowerCase();

    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.wma', '.webm', '.amr', '.3gp'];
    if (audioExtensions.some(ext => fileName.endsWith(ext))) {
      return false;
    }

    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.mov', '.avi', '.mkv'];
    return mediaExtensions.some(ext => fileName.endsWith(ext));
  }

  return false;
};

// Функция для определения типа аудио
const isAudioFile = (media) => {
  if (!media) return false;

  if (media.mimeType) {
    if (media.mimeType.startsWith('audio/') || media.mimeType === 'application/ogg') {
      return true;
    }
  }

  if (media.name || media.uri) {
    const fileName = (media.name || media.uri).toLowerCase();
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.wma', '.webm', '.amr', '.3gp'];
    return audioExtensions.some(ext => fileName.endsWith(ext));
  }

  return false;
};

// Функция для разделения массива на медиа, аудио и документы
const separateMediaAndDocuments = (array) => {
  if (!array || array.length === 0) {
    return { media: [], audio: [], documents: [] };
  }

  const audio = array.filter(item => isAudioFile(item));
  const media = array.filter(item => !isAudioFile(item) && isMediaFile(item));
  const documents = array.filter(item => !isAudioFile(item) && !isMediaFile(item));

  return { media, audio, documents };
};

export const ChatMessageList = ({
  chat,
  currentUserId: propsCurrentUserId,
  deletingComment,
  onEditComment,
  onDeleteComment,
  onReplyComment,
  onToggleReaction,
  onDownloadDocument,
}) => {
  const [lastTap, setLastTap] = React.useState(null);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });
  const [selectedComment, setSelectedComment] = React.useState(null);
  const [currentUserId, setCurrentUserId] = React.useState(propsCurrentUserId || null);
  const { can } = usePermissions();

  // Функция для поиска родительского комментария
  const findParentComment = (replyToId) => {
    if (!chat || !replyToId) return null;
    return chat.find(comment => comment.id === replyToId);
  };

  React.useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error('Failed to load current user', { error: error.message });
      }
    };
    loadCurrentUser();
  }, []);

  const handleDoubleTap = (comment) => {
    if (!comment.self) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      setLastTap(null);

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
    console.log('[Haptics] Heavy impact triggered');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    event.target.measure((x, y, width, height, pageX, pageY) => {
      const screenHeight = Dimensions.get('window').height;

      const menuBottomPosition = pageY + MENU_OFFSET + CONTEXT_MENU_HEIGHT;

      let adjustedTop = pageY;

      if (menuBottomPosition > screenHeight - SCREEN_PADDING) {
        adjustedTop = screenHeight - SCREEN_PADDING - CONTEXT_MENU_HEIGHT - MENU_OFFSET;

        const emojiTopPosition = adjustedTop - EMOJI_OFFSET;
        if (emojiTopPosition < SCREEN_PADDING) {
          adjustedTop = SCREEN_PADDING + EMOJI_OFFSET;
        }
      }

      setMenuPosition({ top: adjustedTop, left: pageX });
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

  const handleMenuReply = () => {
    handleCloseMenu();
    if (selectedComment) {
      onReplyComment(selectedComment);
    }
  };

  const handleMenuCopy = async () => {
    handleCloseMenu();
    if (selectedComment) {
      try {
        await Clipboard.setStringAsync(selectedComment.message);
        Toast.show({
          type: 'success',
          text1: 'Скопировано',
          text2: 'Текст комментария скопирован в буфер обмена',
          position: 'top',
          visibilityTime: 2000,
        });
      } catch (error) {
        console.error('Failed to copy comment', { error: error.message });
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Не удалось скопировать текст',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    }
  };

  const handleEmojiSelect = (emoji) => {
    if (selectedComment) {
      onToggleReaction(selectedComment.id, emoji);
    }
    handleCloseMenu();
  };

  // Функция скачивания документа
  const handleDownloadDocument = async (document) => {
    try {
      const fileName = document.name || document.uri.split('/').pop();

      Toast.show({
        type: 'info',
        text1: 'Скачивание',
        text2: `Загрузка файла ${fileName}...`,
        position: 'top',
        visibilityTime: 2000,
      });

      // Создаем директорию для загрузок (если не существует)
      const downloadDir = new Directory(Paths.cache, 'downloads');
      if (!downloadDir.exists) {
        downloadDir.create();
      }

      // Создаем целевой файл с нужным именем
      const outputFile = new File(downloadDir, fileName);

      // Скачиваем файл (новый API v54)
      const downloadedFile = await File.downloadFileAsync(document.uri, outputFile);

      // Проверяем доступность шаринга
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (isSharingAvailable) {
        // Открываем диалог шаринга (позволяет сохранить или открыть файл)
        await Sharing.shareAsync(downloadedFile.uri);

        Toast.show({
          type: 'success',
          text1: 'Готово',
          text2: 'Файл загружен',
          position: 'top',
          visibilityTime: 2000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Шаринг недоступен на этом устройстве',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error downloading document', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось скачать документ',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  return (
    <>
      <View style={styles.chatContainer}>
        {chat && chat.length > 0 && chat.map((comment) => (
          <View key={comment.id} style={styles.commentWrapper}>
            {deletingComment === comment.id && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#999999" />
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.chatMessage,
                comment.self && styles.chatMessageSelf,
              ]}
              onPress={() => handleDoubleTap(comment)}
              onLongPress={(event) => handleCommentLongPress(comment, event)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.chatTail,
                comment.self && styles.chatTailSelf
              ]} />
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <Text style={styles.chatAuthor}>
                    {formatShortName(comment.from)}
                  </Text>
                  <Text style={styles.chatDateTime}>{formatDateTime(comment.created_at)}</Text>
                </View>
                {isCommentEdited(comment.created_at, comment.updated_at) && (
                  <Text style={styles.chatEdited}>изменено {formatEditTime(comment.created_at, comment.updated_at)}</Text>
                )}
              </View>
              {comment.reply_to_id && (() => {
                const parentComment = findParentComment(comment.reply_to_id);
                if (!parentComment) return null;

                const hasText = parentComment.message && parentComment.message.trim();
                const hasMedia = parentComment.media && parentComment.media.length > 0;

                if (!hasText && !hasMedia) return null;

                return (
                  <View style={[
                    styles.replyQuote,
                    comment.self && styles.replyQuoteSelf
                  ]}>
                    <Text style={styles.replyQuoteText} numberOfLines={2}>
                      <Text style={styles.replyQuoteAuthor}>{formatShortName(parentComment.from)}</Text>
                      {hasText ? `: ${parentComment.message}` : ': [медиа]'}
                    </Text>
                  </View>
                );
              })()}
              {comment.message && comment.message.trim() && (
                <Text style={[
                  styles.chatText,
                  comment.self && styles.chatTextSelf
                ]}>{comment.message}</Text>
              )}
              {comment.media && comment.media.length > 0 && (() => {
                const mappedMedia = comment.media.map(m => ({
                  uri: `${SERVER_URL}${m.path}`,
                  path: m.path,
                  name: m.name,
                  mimeType: m.mime_type,
                  size: m.size
                }));

                const { media, audio, documents } = separateMediaAndDocuments(mappedMedia);

                return (
                  <>
                    {media.length > 0 && (
                      <SwipeBlocker>
                        <MediaCollage
                          mediaArray={media}
                          showControls={false}
                        />
                      </SwipeBlocker>
                    )}
                    {audio.length > 0 && (
                      <>
                        {audio.map((audioFile, index) => (
                          <SwipeBlocker key={index}>
                            <AudioPlayer
                              audioUri={audioFile.uri}
                              fileName={audioFile.name}
                            />
                          </SwipeBlocker>
                        ))}
                      </>
                    )}
                    {documents.length > 0 && (
                      <DocumentList
                        documents={documents}
                        showControls={false}
                        onDownload={handleDownloadDocument}
                      />
                    )}
                  </>
                );
              })()}
              {comment.reactions && comment.reactions.length > 0 && (
                <View style={styles.reactionsContainer}>
                  {groupReactions(comment.reactions, currentUserId).map((reaction, index) => {
                    const iconData = EMOJI_TO_ICON[reaction.emoji];
                    if (!iconData) return null;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.reactionBubble,
                          reaction.hasCurrentUserReacted && styles.reactionBubbleActive
                        ]}
                        onPress={() => onToggleReaction(comment.id, reaction.emoji, reaction.hasCurrentUserReacted)}
                        activeOpacity={0.6}
                      >
                        <MaterialCommunityIcons
                          name={iconData.icon}
                          size={14}
                          color={reaction.hasCurrentUserReacted ? '#4A90E2' : iconData.color}
                        />
                        <Text style={[
                          styles.reactionCount,
                          reaction.hasCurrentUserReacted && styles.reactionCountActive
                        ]}>{reaction.count}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

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
                  onReply={handleMenuReply}
                  onEdit={handleMenuEdit}
                  onDelete={handleMenuDelete}
                  onCopy={handleMenuCopy}
                  isSelf={selectedComment?.self}
                />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    marginTop: 15,
  },
  commentWrapper: {
    position: 'relative',
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
    borderRadius: 4,
    zIndex: 10,
  },
  chatMessage: {
    marginBottom: 8,
    marginLeft: 8,
    width: '90%',
    alignSelf: 'flex-start',
    backgroundColor: '#F0F3F7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    position: 'relative',
  },
  chatMessageSelf: {
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 8,
    backgroundColor: '#E5E9F0',
  },
  chatTail: {
    position: 'absolute',
    left: -6,
    bottom: 0,
    width: 0,
    height: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 12,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F0F3F7',
    borderLeftColor: 'transparent',
  },
  chatTailSelf: {
    left: 'auto',
    right: -6,
    borderRightWidth: 12,
    borderLeftWidth: 0,
    borderBottomColor: '#E5E9F0',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 0,
    justifyContent: 'space-between',
    width: '100%',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  chatAuthor: {
    fontSize: 12,
    fontWeight: '300',
    color: '#888',
  },
  chatDateTime: {
    fontSize: 10,
    lineHeight: 10,
    color: '#aaa',
    position: 'relative',
    top: -2
  },
  chatEdited: {
    fontSize: 10,
    lineHeight: 10,
    color: '#999',
    fontStyle: 'italic',
    position: 'relative',
    top: -4
  },
  chatText: {
    fontSize: 13,
    color: '#555',
  },
  chatTextSelf: {
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    flex: 1,
    position: 'relative',
  },
  replyQuote: {
    backgroundColor: '#F8F8F8',
    borderLeftWidth: 2,
    borderLeftColor: '#CDCDCD',
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  replyQuoteSelf: {
    alignSelf: 'flex-end',
  },
  replyQuoteText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 14,
  },
  replyQuoteAuthor: {
    color: '#999',
    fontSize: 10,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionBubbleActive: {
  },
  reactionCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#4A90E2',
  },
});
