/**
 * @deprecated для Messenger/ChatScreen
 * Для мессенджера используйте ChatMessageList + ChatInputPanel
 * Этот компонент используется только в Timesheet (ContractCard)
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { isPermissionError, showPermissionSettingsAlert } from '../../../utils/permissionSettingsAlert';

// Маппинг эмоджи на иконки MaterialCommunityIcons
const EMOJI_TO_ICON = {
  '👍': { icon: 'thumb-up', color: '#757575' },
  '👎': { icon: 'thumb-down', color: '#757575' },
  '❤️': { icon: 'heart', color: '#757575' },
  '🔥': { icon: 'fire', color: '#757575' },
  '👀': { icon: 'eye', color: '#757575' },
};

// Константы для расчета позиции меню
const EMOJI_PICKER_HEIGHT = 60; // Высота блока реакций
const CONTEXT_MENU_HEIGHT = 240; // Приблизительная высота контекстного меню
const SCREEN_PADDING = 20; // Отступ от края экрана
const EMOJI_OFFSET = 60; // EmojiPicker находится на 60px выше комментария
const MENU_OFFSET = 10; // CommentContextMenu находится на 10px ниже комментария

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

// Функция форматирования времени редактирования (с датой если день отличается)
const formatEditTime = (createdAt, updatedAt) => {
  if (!updatedAt) return '';

  const updated = new Date(updatedAt);
  if (isNaN(updated.getTime())) return '';

  const hours = String(updated.getHours()).padStart(2, '0');
  const minutes = String(updated.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  // Если есть created_at, проверяем, в один ли день было создание и редактирование
  if (createdAt) {
    const created = new Date(createdAt);
    if (!isNaN(created.getTime())) {
      // Сравниваем даты (без времени)
      const createdDate = created.toDateString();
      const updatedDate = updated.toDateString();

      // Если дни отличаются, добавляем дату
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
                {/* Хвостик */}
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
                {comment.reactions && comment.reactions.length > 0 && (
                  <View style={styles.reactionsContainer}>
                    {groupReactions(comment.reactions, currentUserId).map((reaction) => {
                      const iconData = EMOJI_TO_ICON[reaction.emoji];
                      if (!iconData) return null;

                      return (
                        <TouchableOpacity
                          key={reaction.emoji}
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

      <Can permission="mobile-app-can-create-comment:site">
        {replyingToComment && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerTitle}>Ответ на комментарий:</Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {formatShortName(replyingToComment.from)}
                {replyingToComment.message && replyingToComment.message.trim()
                  ? `: ${replyingToComment.message}`
                  : ': [медиа]'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancelReply} style={styles.replyBannerClose}>
              <Text style={styles.replyBannerCloseText}>✕</Text>
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
            >
              <MaterialCommunityIcons
                name="paperclip"
                size={22}
                color="#999999"
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
            placeholderTextColor={isRecording ? "#f00" : "#999"}
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
              style={styles.chatSendButton}
              onPress={handleSendComment}
              activeOpacity={0.7}
            >
              <Text style={styles.chatSendButtonIcon}>➤</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.chatSendButton}
              onPressIn={handleStartRecording}
              onPressOut={handleStopRecording}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={isRecording ? "microphone" : "microphone-outline"}
                size={22}
                color={isRecording ? "#E53935" : "#999999"}
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
	backgroundColor: '#E5E9F0', // мой коммент
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
	borderBottomColor: '#E5E9F0', // мой коммент
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
    paddingLeft: 45,
    paddingRight: 45,
    fontSize: 14,
    minHeight: 40,
    backgroundColor: '#fff',
  },
  chatTextInputFocused: {
    borderColor: '#999999',
  },
  chatTextInputError: {
    borderColor: '#FF4444',
  },
  chatTextInputRecording: {
    backgroundColor: '#fcc',
    borderColor: '#E53935',
    paddingLeft: 10,
  },
  chatSendButton: {
    position: 'absolute',
    right: 5,
    bottom: 5,
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
  chatAttachButton: {
    position: 'absolute',
    left: 5,
    bottom: 7,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    flex: 1,
    position: 'relative',
  },
  replyBanner: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#999999',
    marginBottom: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyBannerContent: {
    flex: 1,
    marginRight: 8,
  },
  replyBannerTitle: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  replyBannerText: {
    fontSize: 12,
    color: '#333',
  },
  replyBannerClose: {
    padding: 4,
  },
  replyBannerCloseText: {
    fontSize: 18,
    color: '#999',
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
    // Стиль для реакции, которую поставил текущий пользователь
  },
  reactionCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#4A90E2',
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
