import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';
import { refreshPermissions } from '../../../utils/permissions';

export const useTeamActions = (loadDays, minIndex, maxIndex) => {
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteData, setDeleteData] = useState({ id: null, name: '' });
  const [deletingTeam, setDeletingTeam] = useState(null);

  const openAddTeamModal = async (day) => {
    try {
      const permissions = await refreshPermissions();
      const canCreate = permissions.includes('mobile-app-can-create-team:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      setSelectedDay(day);
      const staff = await timesheetAPI.getStaff();
      setStaffList(staff);
      setStaffModalVisible(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: error.message || 'Не удалось загрузить список сотрудников',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleAddTeam = async (staffId, staffName) => {
    try {
      await timesheetAPI.addTeam(staffId, selectedDay.day);
      setStaffModalVisible(false);
      setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
    } catch (error) {
      if (error.response?.status === 403) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: error.response?.data?.error || 'У вас нет прав для добавления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: 'Не удалось добавить бригаду',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    try {
      const permissions = await refreshPermissions();
      const canDelete = permissions.includes('mobile-app-can-delete-team:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления бригады',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      setDeleteData({ id: teamId, name: teamName });
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

  const confirmDeleteTeam = async () => {
    setDeleteConfirmVisible(false);
    setDeletingTeam(deleteData.id);
    try {
      await timesheetAPI.removeTeam(deleteData.id);
      setTimeout(() => {
        loadDays(minIndex, maxIndex, true);
        setDeletingTeam(null);
      }, 300);
    } catch (error) {
      setDeletingTeam(null);
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось удалить бригаду',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  return {
    staffModalVisible,
    setStaffModalVisible,
    staffList,
    openAddTeamModal,
    handleAddTeam,
    handleDeleteTeam,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    deleteData,
    confirmDeleteTeam,
    deletingTeam,
  };
};
