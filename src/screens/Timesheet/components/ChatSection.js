/**
 * Комментарии к объекту в табеле (ContractCard): пузыри, ответы и реакции в стиле мессенджера.
 * Чаты мессенджера — в src/components/chat.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, ActivityIndicator, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../../../services/api';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { isCallAudioActive } from '../../../services/callAudioState';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Can } from '../../../components/Can';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatShortName } from '../../../utils/formatName';
import { EmojiPicker } from './EmojiPicker';
import { CommentContextMenu } from './CommentContextMenu';
import { MediaCollage } from './MediaCollage';
import { DocumentList } from './DocumentList';
import { AudioPlayer } from './AudioPlayer';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { isPermissionError, showPermissionSettingsAlert } from '../../../utils/permissionSettingsAlert';
import { formatDateTime, formatEditTime } from '../../../utils/dateTime';
import { useTheme, useThemedStyles } from '../../../theme';

// Константы для расчета позиции меню
const EMOJI_PICKER_HEIGHT = 60; // Высота блока реакций
const CONTEXT_MENU_HEIGHT = 240; // Приблизительная высота контекстного меню
const SCREEN_PADDING = 20; // Отступ от края экрана
const EMOJI_OFFSET = 60; // EmojiPicker находится на 60px выше комментария
const MENU_OFFSET = 10; // CommentContextMenu находится на 10px ниже комментария

// Функция проверки, был ли комментарий отредактирован
const isCommentEdited = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;

  const created = new Date(createdAt);
  const updated = new Date(updatedAt);

  // Проверяем валидность дат
  if (isNaN(created.getTime()) || isNaN(updated.getTime())) return false;

  // Сравниваем временные метки (разница больше 1 секунды = редактирование)
  return Math.abs(updated.getTime() - created.getTime()) > 1000;
};

// Функция группировки реакций по emoji и подсчета количества
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

// Функция для определения типа медиа (изображение/видео или документ)
const isMediaFile = (media) => {
  if (!media) return false;

  // Проверяем по mimeType
  if (media.mimeType) {
    // НЕ считаем аудио файлы как media, даже если mimeType неправильный
    if (media.mimeType.startsWith('audio/') || media.mimeType === 'application/ogg') {
      return false;
    }
    return media.mimeType.startsWith('image/') || media.mimeType.startsWith('video/');
  }

  // Fallback: проверяем по расширению файла
  if (media.uri || media.name) {
    const fileName = (media.uri || media.name).toLowerCase();

    // Сначала проверяем аудио расширения - исключаем их из media
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

  // Проверяем по mimeType
  if (media.mimeType) {
    if (media.mimeType.startsWith('audio/') || media.mimeType === 'application/ogg') {
      return true;
    }
  }

  // Fallback: проверяем по расширению файла (приоритет name, потом uri)
  if (media.name || media.uri) {
    const fileName = (media.name || media.uri).toLowerCase();
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.wma', '.webm', '.amr', '.3gp'];
    return audioExtensions.some(ext => fileName.endsWith(ext));
  }

  return false;
};

// Функция для разделения массива на медиа (изображения/видео), аудио и документы
const separateMediaAndDocuments = (array) => {
  if (!array || array.length === 0) {
    return { media: [], audio: [], documents: [] };
  }

  // Сначала проверяем аудио (приоритет), потом медиа, потом документы
  const audio = array.filter(item => isAudioFile(item));
  const media = array.filter(item => !isAudioFile(item) && isMediaFile(item));
  const documents = array.filter(item => !isAudioFile(item) && !isMediaFile(item));

  return { media, audio, documents };
};

export const ChatSection = ({
  chat,
  commentText,
  replyingToComment,
  deletingComment,
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
  const [lastTap, setLastTap] = React.useState(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });
  const [selectedComment, setSelectedComment] = React.useState(null);
  const [currentUserId, setCurrentUserId] = React.useState(null);
  const [selectedMediaArray, setSelectedMediaArray] = React.useState([]);
  const [hasValidationError, setHasValidationError] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const { can } = usePermissions();
  const { showActionSheetWithOptions } = useActionSheet();
  const inputRef = React.useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingTimerRef = React.useRef(null);

  // Функция для поиска родительского комментария
  const findParentComment = (replyToId) => {
    if (!chat || !replyToId) return null;
    return chat.find(comment => comment.id === replyToId);
  };

  // Эффект для очистки таймера при размонтировании
  React.useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

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

  // Автофокус на поле ввода при выборе ответа
  React.useEffect(() => {
    if (replyingToComment && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingToComment]);

  // Функция отправки комментария с медиа
  const handleSendComment = async () => {
    // Валидация: должен быть текст или медиа
    if (!commentText.trim() && selectedMediaArray.length === 0) {
      setHasValidationError(true);
      Toast.show({
        type: 'error',
        text1: 'Ошибка валидации',
        text2: 'Введите текст комментария или прикрепите медиа',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      await onAddComment(commentText, selectedMediaArray);
      // Очищаем выбранное медиа только после успешной отправки
      setSelectedMediaArray([]);
      setHasValidationError(false);
    } catch (error) {
      // Ошибка уже обработана в onAddComment, медиа не очищаем
      console.error('Failed to send comment', { error: error.message });
    }
  };

  // Функция для выбора изображения из галереи
  const pickImageFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      // Принудительно скрываем StatusBar после закрытия системного диалога
      StatusBar.setHidden(true);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Добавляем все выбранные медиа к существующим
        setSelectedMediaArray(prev => [...prev, ...result.assets]);
        // Сбрасываем ошибку валидации, так как теперь есть медиа
        if (hasValidationError) {
          setHasValidationError(false);
        }
      }
    } catch (error) {
      console.error('Error picking image from library', { error: error.message });

      if (isPermissionError(error)) {
        showPermissionSettingsAlert(
          'Доступ к галерее',
          'Разрешите доступ к фото и видео в настройках устройства, чтобы выбрать медиа.'
        );
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось выбрать медиа из галереи',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Функция для съемки фото
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        showPermissionSettingsAlert(
          'Доступ к камере',
          'Разрешите доступ к камере в настройках устройства, чтобы сделать фото.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      // Принудительно скрываем StatusBar после закрытия камеры
      StatusBar.setHidden(true);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const media = result.assets[0];
        setSelectedMediaArray(prev => [...prev, media]);
        if (hasValidationError) {
          setHasValidationError(false);
        }
      }
    } catch (error) {
      console.error('Error taking photo', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось сделать фото',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Функция для съемки видео
  const takeVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        showPermissionSettingsAlert(
          'Доступ к камере',
          'Разрешите доступ к камере в настройках устройства, чтобы снять видео.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
      });

      // Принудительно скрываем StatusBar после закрытия камеры
      StatusBar.setHidden(true);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const media = result.assets[0];
        setSelectedMediaArray(prev => [...prev, media]);
        if (hasValidationError) {
          setHasValidationError(false);
        }
      }
    } catch (error) {
      console.error('Error taking video', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось снять видео',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Функция для выбора документов
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // все типы файлов
        multiple: true,
        copyToCacheDirectory: true,
      });

      // Принудительно скрываем StatusBar после закрытия системного диалога
      StatusBar.setHidden(true);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Добавляем выбранные документы к массиву медиа
        setSelectedMediaArray(prev => [...prev, ...result.assets]);
        // Сбрасываем ошибку валидации, так как теперь есть медиа
        if (hasValidationError) {
          setHasValidationError(false);
        }
      }
    } catch (error) {
      console.error('Error picking document', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось выбрать документ',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Функция для показа Action Sheet с выбором медиа
  const showMediaOptions = () => {
    const options = ['Выбрать из галереи', 'Снять фото', 'Снять видео', 'Выбрать документ', 'Отмена'];
    const cancelButtonIndex = 4;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: 'Добавить вложение',
        userInterfaceStyle: theme.dark ? 'dark' : 'light',
        containerStyle: { backgroundColor: theme.sheet },
        textStyle: { color: theme.text },
        titleTextStyle: { color: theme.textSecondary },
      },
      (buttonIndex) => {
        if (buttonIndex === 0) {
          pickImageFromLibrary();
        } else if (buttonIndex === 1) {
          takePhoto();
        } else if (buttonIndex === 2) {
          takeVideo();
        } else if (buttonIndex === 3) {
          pickDocument();
        }
      }
    );
  };

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

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onEditComment(comment);
    } else {
      setLastTap(now);
    }
  };

  const handleCommentLongPress = (comment, event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Получаем позицию нажатия
    event.target.measure((x, y, width, height, pageX, pageY) => {
      const screenHeight = Dimensions.get('window').height;

      // Вычисляем нижнюю границу контекстного меню
      const menuBottomPosition = pageY + MENU_OFFSET + CONTEXT_MENU_HEIGHT;

      let adjustedTop = pageY;

      // Проверяем, выходит ли меню за нижнюю границу экрана
      if (menuBottomPosition > screenHeight - SCREEN_PADDING) {
        // Вычисляем новую позицию, чтобы меню полностью влезло на экран
        // Меню должно заканчиваться на screenHeight - SCREEN_PADDING
        adjustedTop = screenHeight - SCREEN_PADDING - CONTEXT_MENU_HEIGHT - MENU_OFFSET;

        // Также проверяем, чтобы блок реакций не выходил за верхнюю границу
        const emojiTopPosition = adjustedTop - EMOJI_OFFSET;
        if (emojiTopPosition < SCREEN_PADDING) {
          // Если блок реакций выходит за верхнюю границу, корректируем позицию
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

  // Функция начала записи аудио
  const handleStartRecording = async () => {
    try {
      // Проверяем, что запись не идёт
      if (audioRecorder.isRecording) {
        return;
      }

      // Запись перенастраивает аудиосессию и отняла бы микрофон у разговора
      if (isCallAudioActive()) {
        Toast.show({
          type: 'info',
          text1: 'Идёт звонок',
          text2: 'Голосовое сообщение можно записать после звонка',
          position: 'top',
          visibilityTime: 2500,
        });
        return;
      }

      // Запрашиваем разрешение на микрофон
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        showPermissionSettingsAlert(
          'Доступ к микрофону',
          'Разрешите доступ к микрофону в настройках устройства, чтобы записывать голосовые сообщения.'
        );
        return;
      }

      // Подготавливаем и запускаем запись
      // На iOS без этого режима expo-audio отказывается записывать (RecordingDisabledException)
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      // Запускаем таймер для отображения длительности
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to start recording', { error: error.message });
      setIsRecording(false);
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось начать запись',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  // Функция остановки записи и автоотправки
  const handleStopRecording = async () => {
    try {
      // Сохраняем длительность для проверки перед сбросом
      const duration = recordingDuration;

      // Останавливаем таймер
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Проверяем, что запись действительно идёт
      if (!audioRecorder.isRecording) {
        setIsRecording(false);
        setRecordingDuration(0);
        return;
      }

      // Останавливаем запись с защитой от IllegalStateException
      try {
        await audioRecorder.stop();
      } catch (stopError) {
        // Игнорируем IllegalStateException, если запись уже остановлена
        if (stopError.message?.includes('IllegalStateException')) {
          // known expo-audio bug on Android — ignore
        } else {
          throw stopError;
        }
      }
      // Обратно в режим воспроизведения: иначе голосовые играли бы в слуховой динамик
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

      setIsRecording(false);
      setRecordingDuration(0);

      // Проверка минимальной длительности записи
      if (duration < 1) {
        Toast.show({
          type: 'info',
          text1: 'Слишком короткая запись',
          text2: 'Удерживайте кнопку минимум 1 секунду',
          position: 'top',
          visibilityTime: 2500,
        });
        return;
      }

      // Получаем URI записанного файла
      const audioUri = audioRecorder.uri;

      if (!audioUri) {
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Не удалось получить аудиофайл',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Создаем объект аудиофайла
      const audioFile = {
        uri: audioUri,
        name: 'Голосовое сообщение.m4a',
        mimeType: 'audio/mp4',
      };

      // Автоматически отправляем аудио
      await onAddComment([audioFile]);

    } catch (error) {
      console.error('Failed to stop recording', { error: error.message });
      setIsRecording(false);
      setRecordingDuration(0);
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось сохранить запись',
        position: 'top',
        visibilityTime: 3000,
      });
    }
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
    <View style={styles.chatContainer}>
      {chat && chat.length > 0 && chat.map((comment) => (
            <View key={comment.id} style={styles.commentWrapper}>
              {deletingComment === comment.id && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.chatMessage,
                  comment.self && styles.chatMessageSelf,
                  comment.media && comment.media.length > 0 && styles.chatMessageWide,
                ]}
                onPress={() => handleDoubleTap(comment)}
                onLongPress={(event) => handleCommentLongPress(comment, event)}
                activeOpacity={0.7}
              >
                {!comment.self && (
                  <Text style={styles.chatAuthor} numberOfLines={1}>
                    {formatShortName(comment.from)}
                  </Text>
                )}
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
                      <Text style={[styles.replyQuoteAuthor, comment.self && styles.replyQuoteAuthorSelf]} numberOfLines={1}>
                        {formatShortName(parentComment.from)}
                      </Text>
                      <Text style={[styles.replyQuoteText, comment.self && styles.replyQuoteTextSelf]} numberOfLines={1}>
                        {hasText ? parentComment.message : 'Вложение'}
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
                          {audio.map((audioFile) => (
                            <SwipeBlocker key={audioFile.uri}>
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
                <View style={styles.chatFooter}>
                  {comment.reactions && comment.reactions.length > 0 && (
                    <View style={styles.reactionsContainer}>
                      {groupReactions(comment.reactions, currentUserId).map((reaction) => (
                        <TouchableOpacity
                          key={reaction.emoji}
                          style={[
                            styles.reactionBubble,
                            reaction.hasCurrentUserReacted && styles.reactionBubbleActive
                          ]}
                          onPress={() => onToggleReaction(comment.id, reaction.emoji, reaction.hasCurrentUserReacted)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                          <Text style={[
                            styles.reactionCount,
                            reaction.hasCurrentUserReacted && styles.reactionCountActive
                          ]}>{reaction.count}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={[styles.chatMeta, comment.self && styles.chatMetaSelf]}>
                    {isCommentEdited(comment.created_at, comment.updated_at)
                      ? `изм. ${formatEditTime(comment.created_at, comment.updated_at)} · `
                      : ''}
                    {formatDateTime(comment.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
        ))}

      <Can permission="mobile-app-can-create-comment:site">
        {replyingToComment && (
          <View style={styles.replyBanner}>
            <Ionicons name="arrow-undo" size={18} color={theme.accent} />
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerTitle} numberOfLines={1}>
                Ответ: {formatShortName(replyingToComment.from)}
              </Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyingToComment.message && replyingToComment.message.trim()
                  ? replyingToComment.message
                  : 'Вложение'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onCancelReply}
              style={styles.replyBannerClose}
              hitSlop={8}
              accessibilityLabel="Отменить ответ"
            >
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        {selectedMediaArray.length > 0 && (() => {
          const { media, audio, documents } = separateMediaAndDocuments(selectedMediaArray);

          return (
            <View>
              {media.length > 0 && (
                <SwipeBlocker>
                  <MediaCollage
                    mediaArray={media}
                    onRemove={(index) => {
                      // Находим глобальный индекс в selectedMediaArray
                      const mediaItem = media[index];
                      const globalIndex = selectedMediaArray.findIndex(item => item === mediaItem);
                      if (globalIndex !== -1) {
                        setSelectedMediaArray(prev => prev.filter((_, i) => i !== globalIndex));
                      }
                    }}
                    showControls={true}
                  />
                </SwipeBlocker>
              )}
              {audio.length > 0 && (
                <View style={styles.audioListContainer}>
                  {audio.map((audioFile) => (
                    <View key={audioFile.uri} style={styles.audioItemContainer}>
                      <SwipeBlocker style={{ flex: 1 }}>
                        <AudioPlayer
                          audioUri={audioFile.uri}
                          fileName={audioFile.name}
                        />
                      </SwipeBlocker>
                      <TouchableOpacity
                        style={styles.audioRemoveButton}
                        onPress={() => {
                          const globalIndex = selectedMediaArray.findIndex(item => item === audioFile);
                          if (globalIndex !== -1) {
                            setSelectedMediaArray(prev => prev.filter((_, i) => i !== globalIndex));
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {documents.length > 0 && (
                <DocumentList
                  documents={documents}
                  onRemove={(index) => {
                    // Находим глобальный индекс в selectedMediaArray
                    const documentItem = documents[index];
                    const globalIndex = selectedMediaArray.findIndex(item => item === documentItem);
                    if (globalIndex !== -1) {
                      setSelectedMediaArray(prev => prev.filter((_, i) => i !== globalIndex));
                    }
                  }}
                  showControls={true}
                />
              )}
            </View>
          );
        })()}
        <View style={styles.chatInputWrapper}>
          {!isRecording && (
            <TouchableOpacity
              style={styles.chatAttachButton}
              onPress={showMediaOptions}
              activeOpacity={0.7}
              accessibilityLabel="Прикрепить файл"
            >
              <Ionicons
                name="attach"
                size={26}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
          <TextInput
            ref={inputRef}
            style={[
              styles.chatTextInput,
              isFocused && styles.chatTextInputFocused,
              hasValidationError && styles.chatTextInputError,
              isRecording && styles.chatTextInputRecording
            ]}
            placeholder={isRecording
              ? `Запись... ${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`
              : replyingToComment ? "Ваш ответ..." : "Ваш комментарий..."}
            placeholderTextColor={isRecording ? theme.danger : theme.textMuted}
            value={commentText}
            onChangeText={(text) => {
              onCommentChange(text);
              if (hasValidationError) {
                setHasValidationError(false);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline
            editable={!isRecording}
          />
          {commentText.trim() || selectedMediaArray.length > 0 ? (
            <TouchableOpacity
              style={[styles.chatSendButton, styles.chatSendButtonActive]}
              onPress={handleSendComment}
              activeOpacity={0.7}
              accessibilityLabel="Отправить"
            >
              <Ionicons name="arrow-up" size={22} color={theme.onAccent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.chatSendButton, isRecording && styles.chatSendButtonActive]}
              onPressIn={handleStartRecording}
              onPressOut={handleStopRecording}
              activeOpacity={0.7}
              accessibilityLabel="Удерживайте, чтобы записать голосовое"
            >
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={24}
                color={isRecording ? theme.onAccent : theme.textSecondary}
              />
            </TouchableOpacity>
          )}
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
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  chatContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.separator,
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
    backgroundColor: theme.veil,
    borderRadius: 16,
    zIndex: 10,
  },
  chatMessage: {
    marginBottom: 6,
    maxWidth: '88%',
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceAlt,
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    paddingTop: 6,
    paddingBottom: 5,
    paddingHorizontal: 10,
  },
  chatMessageSelf: {
    alignSelf: 'flex-end',
    backgroundColor: theme.bubbleOut,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 6,
  },
  // Сетка фото и плееры занимают ширину пузыря в процентах — ему нужна явная ширина
  chatMessageWide: {
    width: '88%',
  },
  chatAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accentText,
    marginBottom: 2,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.text,
  },
  chatTextSelf: {
    textAlign: 'left',
    color: theme.bubbleOutText,
  },
  chatFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 3,
  },
  chatMeta: {
    marginLeft: 'auto',
    paddingLeft: 8,
    fontSize: 11,
    color: theme.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chatMetaSelf: {
    color: theme.bubbleOutMeta,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  chatTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.inputBackground,
  },
  chatTextInputFocused: {
    borderColor: theme.separator,
  },
  chatTextInputError: {
    borderColor: theme.danger,
  },
  chatTextInputRecording: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accent,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonActive: {
    backgroundColor: theme.accent,
  },
  chatAttachButton: {
    width: 34,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
  },
  menuContainer: {
    flex: 1,
    position: 'relative',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.quoteBackground,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  replyBannerContent: {
    flex: 1,
  },
  replyBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accentText,
  },
  replyBannerText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 1,
  },
  replyBannerClose: {
    padding: 2,
  },
  replyQuote: {
    backgroundColor: theme.quoteBackground,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  replyQuoteSelf: {
    borderLeftColor: theme.bubbleOutAccent,
  },
  replyQuoteAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.accentText,
  },
  replyQuoteAuthorSelf: {
    color: theme.bubbleOutAccent,
  },
  replyQuoteText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  replyQuoteTextSelf: {
    color: theme.bubbleOutMeta,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: theme.reactionBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.reactionBorder,
  },
  reactionBubbleActive: {
    backgroundColor: theme.reactionMine,
    borderColor: theme.accent,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  reactionCountActive: {
    color: theme.accentText,
  },
  audioListContainer: {
    position: 'relative',
  },
  audioItemContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  audioRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
