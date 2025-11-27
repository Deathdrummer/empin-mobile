import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';
import { refreshPermissions } from '../../../utils/permissions';

export const useCommentActions = (loadDays, minIndex, maxIndex) => {
  const [expandedContract, setExpandedContract] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [updatingComment, setUpdatingComment] = useState(false);
  const [addingComment, setAddingComment] = useState(null);
  const [replyingToComment, setReplyingToComment] = useState(null);

  const handleAddComment = async (timesheetContractId) => {
    if (!commentText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Введите текст комментария',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }

    setAddingComment(timesheetContractId);
    try {
      const permissions = await refreshPermissions();
      const canCreate = permissions.includes('mobile-app-can-create-comment:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        setAddingComment(null);
        return;
      }

      await timesheetAPI.addComment(timesheetContractId, commentText.trim());
      setCommentText('');
      await loadDays(minIndex, maxIndex, true);
      setAddingComment(null);
    } catch (error) {
      setAddingComment(null);
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось добавить комментарий',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const permissions = await refreshPermissions();
      const canDelete = permissions.includes('mobile-app-can-delete-comment:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Удаляем комментарий сразу без подтверждения
      await timesheetAPI.removeComment(commentId);
      await loadDays(minIndex, maxIndex, true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось удалить комментарий',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment);
  };

  const handleUpdateComment = async (newMessage) => {
    if (!editingComment || !newMessage) return;

    setUpdatingComment(true);
    try {
      const permissions = await refreshPermissions();
      const canUpdate = permissions.includes('mobile-app-can-edit-comment:site');

      if (!canUpdate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для редактирования комментария',
          position: 'top',
          visibilityTime: 3000,
        });
        setUpdatingComment(false);
        return;
      }

      await timesheetAPI.updateComment(editingComment.id, newMessage);
      setEditingComment(null);
      await loadDays(minIndex, maxIndex, true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось обновить комментарий',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setUpdatingComment(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
  };

  const handleReplyComment = (comment) => {
    // Если комментарий уже является ответом (имеет reply_to_id), то игнорируем
    if (comment.reply_to_id) {
      Toast.show({
        type: 'info',
        text1: 'Информация',
        text2: 'Нельзя ответить на ответ',
        position: 'top',
        visibilityTime: 2000,
      });
      return;
    }
    setReplyingToComment(comment);
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
  };

  return {
    expandedContract,
    setExpandedContract,
    commentText,
    setCommentText,
    editingComment,
    updatingComment,
    addingComment,
    replyingToComment,
    handleAddComment,
    handleDeleteComment,
    handleEditComment,
    handleUpdateComment,
    handleCancelEdit,
    handleReplyComment,
    handleCancelReply,
  };
};
