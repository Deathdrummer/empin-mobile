import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { Can } from '../../../components/Can';
import { MediaCollage } from './MediaCollage';
import { DocumentList } from './DocumentList';
import { AudioPlayer } from './AudioPlayer';
import { SwipeBlocker } from '../../../components/SwipeBlocker';
import { formatShortName } from '../../../utils/formatName';

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

export const ChatInputPanel = ({
  commentText,
  replyingToComment,
  onCommentChange,
  onAddComment,
  onCancelReply,
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [selectedMediaArray, setSelectedMediaArray] = React.useState([]);
  const [hasValidationError, setHasValidationError] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const { showActionSheetWithOptions } = useActionSheet();
  const inputRef = React.useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingTimerRef = React.useRef(null);

  // Эффект для очистки таймера при размонтировании
  React.useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Доступ запрещен',
          text2: 'Необходим доступ к галерее для выбора медиа',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

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
        Toast.show({
          type: 'error',
          text1: 'Доступ запрещен',
          text2: 'Необходим доступ к камере для съемки',
          position: 'top',
          visibilityTime: 3000,
        });
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
        Toast.show({
          type: 'error',
          text1: 'Доступ запрещен',
          text2: 'Необходим доступ к камере для съемки',
          position: 'top',
          visibilityTime: 3000,
        });
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

  // Функция начала записи аудио
  const handleStartRecording = async () => {
    try {
      // Проверяем, что запись не идёт
      if (audioRecorder.isRecording) {
        console.log('[Audio] Recording already in progress');
        return;
      }

      // Запрашиваем разрешение на микрофон
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Toast.show({
          type: 'error',
          text1: 'Доступ запрещен',
          text2: 'Необходим доступ к микрофону для записи',
          position: 'top',
          visibilityTime: 3000,
        });
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
        console.log('[Audio] Recording already stopped');
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
          console.log('[Audio] IllegalStateException caught (known expo-audio bug on Android)', { error: stopError.message });
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Can permission="mobile-app-can-create-comment:site">
        <View style={styles.container}>
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
                    {audio.map((audioFile, index) => (
                      <View key={index} style={styles.audioItemContainer}>
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
            {commentText.trim() ? (
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
        </View>
      </Can>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3eff6',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
