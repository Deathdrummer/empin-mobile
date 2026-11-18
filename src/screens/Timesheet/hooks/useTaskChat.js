import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { cachedChat, saveChat } from '../../../services/production';
import {
  discardTaskMessage, enqueueTaskMessage, retryTaskMessage, subscribeTaskMessageSent, taskChatAPI, useTaskOutbox,
} from '../../../services/taskChat';
import { needsPreparation, prepareMediaForUpload } from '../../../services/mediaPrepare';
import { getUserFacingError } from '../../../utils/userFacingError';
import { isOfflineError } from '../../../utils/tasks';

/** Неотправленное из очереди — в ленту переписки, с пометкой «ждёт связи» или причиной отказа */
const pendingAsComment = (item) => ({
  id: `local-${item.uuid}`,
  _uuid: item.uuid,
  _status: item.status,
  _error: item.error,
  self: true,
  message: item.message,
  reply_to_id: item.replyToId,
  media: item.files?.length ? item.files.map((file) => ({ path: file.uri, name: file.name, mime_type: file.mimeType, size: file.size })) : null,
  reactions: [],
  created_at: item.createdAt,
});

/** Мини-чат задания в карточке плана-графика (п. 6.4): одно раскрытое задание за раз, как в прежнем «Табеле» */
export const useTaskChat = (meStaffId) => {
  // Сотрудник — из «кто я»; без связи при первом запуске «кто я» ещё нет — из сохранённой учётной записи
  const [storedStaffId, setStoredStaffId] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => setStoredStaffId(raw ? JSON.parse(raw)?.staff_id ?? null : null))
      .catch(() => {});
  }, []);
  const staffId = meStaffId ?? storedStaffId;
  const [expandedTask, setExpandedTask] = useState(null);
  const [chats, setChats] = useState({});
  const [commentText, setCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [updatingComment, setUpdatingComment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingComment, setDeletingComment] = useState(null);
  const [addingComment, setAddingComment] = useState(null);
  const outbox = useTaskOutbox(expandedTask, staffId);
  const expandedRef = useRef(expandedTask);
  expandedRef.current = expandedTask;

  const load = useCallback(async (taskId) => {
    try {
      const data = await taskChatAPI.list(taskId);
      setChats((prev) => ({ ...prev, [taskId]: { items: data.items || [], canWrite: data.can_write !== false } }));
      saveChat(taskId, data.items || []);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) {
        // Доступа к заданию больше нет (П-ЗД-24) — переписку не показываем
        setChats((prev) => ({ ...prev, [taskId]: { items: [], canWrite: false, gone: true } }));
        return;
      }
      const saved = await cachedChat(taskId);
      setChats((prev) => ({ ...prev, [taskId]: { items: saved?.items || prev[taskId]?.items || [], canWrite: true, offline: isOfflineError(error) } }));
    }
  }, []);

  const toggle = useCallback((taskId) => {
    setReplyingToComment(null);
    if (expandedRef.current === taskId) {
      setExpandedTask(null);
      return;
    }
    setExpandedTask(taskId);
    load(taskId);
  }, [load]);

  // Сообщение из очереди дошло до сервера — сразу в ленту (без мигания) и обновить переписку, если она открыта
  useEffect(() => subscribeTaskMessageSent((taskId, saved) => {
    if (saved?.id) {
      setChats((prev) => {
        const entry = prev[taskId];
        if (!entry || entry.items.some((item) => item.id === saved.id)) return prev;
        return { ...prev, [taskId]: { ...entry, items: [...entry.items, saved] } };
      });
    }
    if (Number(taskId) === Number(expandedRef.current)) load(taskId);
  }), [load]);

  const handleAddComment = useCallback(async (taskId, mediaArray = []) => {
    const message = commentText.trim();
    if (!message && !mediaArray.length) return;
    setAddingComment(taskId);
    try {
      // Видео сжимается, большие фото уменьшаются — до очереди, чтобы без связи хранилось уже сжатое
      const files = needsPreparation(mediaArray) ? await prepareMediaForUpload(mediaArray) : mediaArray;
      await enqueueTaskMessage({ taskId, staffId, message, replyToId: replyingToComment?.id ?? null, files });
      setCommentText('');
      setReplyingToComment(null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось подготовить сообщение', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setAddingComment(null);
    }
  }, [commentText, replyingToComment, staffId]);

  const showError = (title, error, offlineText) => Toast.show({
    type: 'error',
    text1: title,
    text2: isOfflineError(error) ? offlineText : getUserFacingError(error, 'Попробуйте ещё раз.'),
    position: 'top',
  });

  const handleUpdateComment = async (newMessage) => {
    if (!editingComment || !expandedTask) return;
    setUpdatingComment(true);
    try {
      await taskChatAPI.update(expandedTask, editingComment.id, newMessage);
      setEditingComment(null);
      load(expandedTask);
    } catch (error) {
      showError('Не удалось изменить', error, 'Изменить сообщение можно при связи');
    } finally {
      setUpdatingComment(false);
    }
  };

  const confirmDeleteComment = async () => {
    const commentId = deleteTarget;
    setDeleteTarget(null);
    if (!commentId || !expandedTask) return;
    setDeletingComment(commentId);
    try {
      await taskChatAPI.remove(expandedTask, commentId);
      load(expandedTask);
    } catch (error) {
      showError('Не удалось удалить', error, 'Удалить сообщение можно при связи');
    } finally {
      setDeletingComment(null);
    }
  };

  const handleToggleReaction = async (commentId, emoji) => {
    if (!expandedTask || String(commentId).startsWith('local-')) return;
    try {
      await taskChatAPI.react(expandedTask, commentId, emoji);
      load(expandedTask);
    } catch (error) {
      showError('Реакция не поставлена', error, 'Реакции — при связи');
    }
  };

  /** Лента задания: с сервера (или сохранённая) и неотправленное из очереди */
  const itemsFor = (taskId) => {
    const server = chats[taskId]?.items || [];
    if (Number(taskId) !== Number(expandedTask)) return server;
    return [...server, ...outbox.map(pendingAsComment)];
  };

  return {
    expandedTask,
    toggle,
    reload: load,
    chatState: (taskId) => chats[taskId] || null,
    itemsFor,
    pendingCount: outbox.length,
    commentText,
    setCommentText,
    replyingToComment,
    addingComment,
    deletingComment,
    editingComment,
    updatingComment,
    deleteTarget,
    handleAddComment,
    handleReplyComment: setReplyingToComment,
    handleCancelReply: () => setReplyingToComment(null),
    handleEditComment: setEditingComment,
    handleCancelEdit: () => setEditingComment(null),
    handleUpdateComment,
    handleDeleteComment: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDeleteComment,
    handleToggleReaction,
    retryPending: (comment) => retryTaskMessage(comment._uuid),
    discardPending: (comment) => discardTaskMessage(comment._uuid),
  };
};
