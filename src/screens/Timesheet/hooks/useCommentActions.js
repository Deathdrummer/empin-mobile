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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteData, setDeleteData] = useState({ id: null });
  const [deletingComment, setDeletingComment] = useState(null);

  const handleAddComment = async (timesheetContractId, selectedMediaArray = []) => {
    console.log('[useCommentActions] handleAddComment called:', { timesheetContractId, selectedMediaArray, commentText });
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

      const replyToId = replyingToComment ? replyingToComment.id : null;
      const messageText = commentText.trim();

      console.log('[useCommentActions] Calling timesheetAPI.addComment:', { timesheetContractId, messageText, replyToId, selectedMediaArray });

      await timesheetAPI.addComment(timesheetContractId, messageText, replyToId, selectedMediaArray);

      console.log('[useCommentActions] timesheetAPI.addComment completed');

      setCommentText('');
      setReplyingToComment(null);
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

      setDeleteData({ id: commentId });
      setDeleteConfirmVisible(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось проверить права',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const confirmDeleteComment = async () => {
    setDeleteConfirmVisible(false);
    setDeletingComment(deleteData.id);
    try {
      await timesheetAPI.removeComment(deleteData.id);
      await loadDays(minIndex, maxIndex, true);
      setDeletingComment(null);
    } catch (error) {
      setDeletingComment(null);
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
    setReplyingToComment(comment);
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
  };

  const handleToggleReaction = async (commentId, emoji, hasReacted = false) => {
    try {
      if (hasReacted) {
        await timesheetAPI.removeReaction(commentId, emoji);
      } else {
        await timesheetAPI.addReaction(commentId, emoji);
      }
      await loadDays(minIndex, maxIndex, true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.response?.data?.message || error.message || (hasReacted ? 'Не удалось удалить реакцию' : 'Не удалось добавить реакцию'),
        position: 'top',
        visibilityTime: 2000,
      });
    }
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
    confirmDeleteComment,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    deleteData,
    deletingComment,
    handleEditComment,
    handleUpdateComment,
    handleCancelEdit,
    handleReplyComment,
    handleCancelReply,
    handleToggleReaction,
  };
};
