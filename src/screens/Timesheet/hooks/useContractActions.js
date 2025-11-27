import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';
import { refreshPermissions } from '../../../utils/permissions';

export const useContractActions = (loadDays, minIndex, maxIndex) => {
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [contractsList, setContractsList] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [addingContract, setAddingContract] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteData, setDeleteData] = useState({ id: null, name: '' });
  const [deletingContract, setDeletingContract] = useState(null);

  const openAddContractModal = async (teamId) => {
    try {
      const permissions = await refreshPermissions();
      const canCreate = permissions.includes('mobile-app-can-create-contract:site');

      if (!canCreate) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для добавления договора',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      setSelectedTeamId(teamId);
      setContractModalVisible(true);
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

  const searchContracts = async (text) => {
    setContractSearch(text);
    if (text.length < 2) {
      setContractsList([]);
      return;
    }
    try {
      const contracts = await timesheetAPI.searchContracts(text);
      setContractsList(contracts);
    } catch (error) {
      // Игнорируем ошибки поиска
    }
  };

  const handleAddContract = async (contractId) => {
    setAddingContract(true);
    try {
      await timesheetAPI.addContract(contractId, selectedTeamId);
      setContractModalVisible(false);
      setContractSearch('');
      setContractsList([]);
      setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось добавить договор',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setAddingContract(false);
    }
  };

  const handleDeleteContract = async (contractId, contractName) => {
    try {
      const permissions = await refreshPermissions();
      const canDelete = permissions.includes('mobile-app-can-delete-contract:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления договора',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      setDeleteData({ id: contractId, name: contractName });
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

  const confirmDeleteContract = async () => {
    setDeleteConfirmVisible(false);
    setDeletingContract(deleteData.id);
    try {
      await timesheetAPI.removeContract(deleteData.id);
      setTimeout(() => {
        loadDays(minIndex, maxIndex, true);
        setDeletingContract(null);
      }, 300);
    } catch (error) {
      setDeletingContract(null);
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось удалить договор',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleDeleteContractDirect = async (contractId) => {
    try {
      const permissions = await refreshPermissions();
      const canDelete = permissions.includes('mobile-app-can-delete-contract:site');

      if (!canDelete) {
        Toast.show({
          type: 'error',
          text1: 'Нет прав',
          text2: 'У вас нет прав для удаления договора',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      await timesheetAPI.removeContract(contractId);
      setTimeout(() => loadDays(minIndex, maxIndex, true), 300);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Не удалось удалить договор',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  return {
    contractModalVisible,
    setContractModalVisible,
    contractSearch,
    contractsList,
    addingContract,
    openAddContractModal,
    searchContracts,
    handleAddContract,
    handleDeleteContract,
    handleDeleteContractDirect,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    deleteData,
    confirmDeleteContract,
    deletingContract,
  };
};
