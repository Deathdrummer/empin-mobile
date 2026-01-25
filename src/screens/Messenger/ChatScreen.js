import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import BottomMenu from '../../components/BottomMenu';
import { LogoutModal } from '../Timesheet/components/modals/LogoutModal';
import { timesheetAPI, messengerAPI } from '../../services/api';
import { ChatMessageList } from '../Timesheet/components/ChatMessageList';
import { ChatInputPanel } from '../Timesheet/components/ChatInputPanel';
import { SwipeControlProvider } from '../../contexts/SwipeControlContext';
import { AudioPlayerProvider } from '../../contexts/AudioPlayerContext';

export default function ChatScreen({ navigation, route }) {
  const { staffId, staffName = 'Собеседник', onLogout } = route.params || {};
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [deletingComment, setDeletingComment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const scrollViewRef = React.useRef(null);

  // Загрузка текущего пользователя
  useEffect(() => {
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

  // Инициализация чата при монтировании
  useEffect(() => {
    const initializeChat = async () => {
      if (!staffId) {
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Не указан ID собеседника',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      try {
        setLoading(true);
        // Получаем или создаем чат
        const chatData = await messengerAPI.getOrCreateChat(staffId);
        setChatId(chatData.chat_id);

        // Загружаем сообщения
        const messagesData = await messengerAPI.getMessages(chatData.chat_id);
        setMessages(messagesData.messages || []);
      } catch (error) {
        console.error('Failed to initialize chat', { error: error.message });
        Toast.show({
          type: 'error',
          text1: 'Ошибка загрузки',
          text2: 'Не удалось загрузить чат',
          position: 'top',
          visibilityTime: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [staffId]);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Обновление сообщений (pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    if (!chatId) return;

    try {
      setRefreshing(true);
      const messagesData = await messengerAPI.getMessages(chatId);
      setMessages(messagesData.messages || []);
    } catch (error) {
      console.error('Failed to refresh messages', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка обновления',
        text2: 'Не удалось обновить сообщения',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setRefreshing(false);
    }
  }, [chatId]);

  // Отправка сообщения
  const handleAddMessage = useCallback(async (text, mediaArray) => {
    if (!chatId) return;

    try {
      const replyToId = replyingToComment?.id || null;
      const newMessage = await messengerAPI.addMessage(chatId, text, replyToId, mediaArray);

      setMessages(prev => [...prev, newMessage]);
      setCommentText('');
      setReplyingToComment(null);
    } catch (error) {
      console.error('Failed to add message', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка отправки',
        text2: 'Не удалось отправить сообщение',
        position: 'top',
        visibilityTime: 3000,
      });
      throw error;
    }
  }, [chatId, replyingToComment]);

  // Удаление сообщения
  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      setDeletingComment(messageId);
      await messengerAPI.removeMessage(messageId);

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка удаления',
        text2: 'Не удалось удалить сообщение',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setDeletingComment(null);
    }
  }, []);

  // Редактирование сообщения
  const handleEditMessage = useCallback(async (message) => {
    if (editingComment) {
      // Сохраняем изменения
      try {
        await messengerAPI.updateMessage(editingComment.id, commentText);

        setMessages(prev => prev.map(msg =>
          msg.id === editingComment.id
            ? { ...msg, message: commentText, updated_at: new Date().toISOString() }
            : msg
        ));
        setEditingComment(null);
        setCommentText('');

        Toast.show({
          type: 'success',
          text1: 'Готово',
          text2: 'Сообщение отредактировано',
          position: 'top',
          visibilityTime: 2000,
        });
      } catch (error) {
        console.error('Failed to edit message', { error: error.message });
        Toast.show({
          type: 'error',
          text1: 'Ошибка редактирования',
          text2: 'Не удалось отредактировать сообщение',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } else {
      // Начинаем редактирование
      setEditingComment(message);
      setCommentText(message.message || '');
    }
  }, [editingComment, commentText]);

  // Ответ на сообщение
  const handleReplyMessage = useCallback((message) => {
    setReplyingToComment(message);
  }, []);

  // Переключение реакции
  const handleToggleReaction = useCallback(async (messageId, emoji, hasReacted) => {
    if (!chatId || !currentUserId) return;

    try {
      if (hasReacted) {
        await messengerAPI.removeReaction(messageId, emoji);
      } else {
        await messengerAPI.addReaction(messageId, emoji);
      }

      // Обновляем список сообщений
      const messagesData = await messengerAPI.getMessages(chatId);
      setMessages(messagesData.messages || []);
    } catch (error) {
      console.error('Failed to toggle reaction', { error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось изменить реакцию',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, [chatId, currentUserId]);

  // Изменение текста комментария
  const handleCommentChange = useCallback((text) => {
    setCommentText(text);
  }, []);

  // Отмена ответа
  const handleCancelReply = useCallback(() => {
    setReplyingToComment(null);
  }, []);

  // Скачивание документа
  const handleDownloadDocument = useCallback(async (document) => {
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
  }, []);

  const handleNavigateToTimesheet = () => {
    navigation.navigate('Timesheet');
  };

  const handleNavigateToChats = () => {
    navigation.goBack();
  };

  const handleNavigateToCallHistory = () => {
    navigation.navigate('Messenger');
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await timesheetAPI.logout();
      if (onLogout) onLogout();
    } catch (error) {
      if (onLogout) onLogout();
    }
  };

  return (
    <AudioPlayerProvider>
      <SwipeControlProvider>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <View style={styles.backArrow} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{staffName}</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.contentContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              keyboardShouldPersistTaps='handled'
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                />
              }
            >
              <ChatMessageList
                chat={messages}
                currentUserId={currentUserId}
                deletingComment={deletingComment}
                onEditComment={handleEditMessage}
                onDeleteComment={handleDeleteMessage}
                onReplyComment={handleReplyMessage}
                onToggleReaction={handleToggleReaction}
                onDownloadDocument={handleDownloadDocument}
              />
            </ScrollView>

            <ChatInputPanel
              commentText={commentText}
              replyingToComment={replyingToComment}
              onCommentChange={handleCommentChange}
              onAddComment={handleAddMessage}
              onCancelReply={handleCancelReply}
            />
          </View>

          <LogoutModal
            visible={logoutModalVisible}
            onClose={() => setLogoutModalVisible(false)}
            onConfirm={confirmLogout}
          />
          <BottomMenu
            section="messenger"
            onLogout={handleLogout}
            onNavigateToTimesheet={handleNavigateToTimesheet}
            onNavigateToChats={handleNavigateToChats}
            onNavigateToCallHistory={handleNavigateToCallHistory}
            currentScreen="Chats"
          />
        </SafeAreaView>
      </SwipeControlProvider>
    </AudioPlayerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3eff6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#777',
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
