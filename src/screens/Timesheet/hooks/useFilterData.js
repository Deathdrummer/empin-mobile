import { useState, useEffect, useRef, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';

export const useFilterData = () => {
  const [filters, setFilters] = useState({
    teams: [],
    contracts: [],
  });
  const [allTeams, setAllTeams] = useState([]);
  const [allContracts, setAllContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const dataLoadedRef = useRef(false);

  const loadFilterOptions = useCallback(async () => {
    if (dataLoadedRef.current) return;

    setLoading(true);
    try {
      console.log('Loading filter options...');
      const data = await timesheetAPI.getFilterOptions();
      console.log('Filter options loaded:', {
        teams: data.teams?.length || 0,
        contracts: data.contracts?.length || 0,
      });

      if (!data || (!data.teams && !data.contracts)) {
        throw new Error('Пустой ответ от сервера');
      }

      setAllTeams(data.teams || []);
      setAllContracts(data.contracts || []);
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading filter options:', error);
      Toast.show({
        type: 'error',
        text1: 'Ошибка загрузки фильтров',
        text2: error.response?.data?.message || error.message || 'Не удалось загрузить данные для фильтров',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем данные для фильтров при первом использовании
  useEffect(() => {
    if (!dataLoadedRef.current) {
      loadFilterOptions();
    }
  }, [loadFilterOptions]);

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const removeTeamFilter = (teamId) => {
    setFilters(prev => ({
      ...prev,
      teams: prev.teams.filter(id => id !== teamId),
    }));
  };

  const removeContractFilter = (contractId) => {
    setFilters(prev => ({
      ...prev,
      contracts: prev.contracts.filter(id => id !== contractId),
    }));
  };

  // Форматирование имени в формат "Фамилия И.О."
  const formatName = (fullName) => {
    if (!fullName) return '';

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
      // Только фамилия
      return parts[0];
    } else if (parts.length === 2) {
      // Фамилия Имя
      return `${parts[0]} ${parts[1][0]}.`;
    } else if (parts.length >= 3) {
      // Фамилия Имя Отчество
      return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
    }

    return fullName;
  };

  // Получить активные фильтры с их названиями для отображения в виде тегов
  const getActiveFilterTags = () => {
    const tags = [];

    // Добавляем теги для команд с форматированием имени
    filters.teams.forEach(teamId => {
      const team = allTeams.find(t => t.id === teamId);
      if (team) {
        tags.push({
          id: `team-${teamId}`,
          type: 'team',
          itemId: teamId,
          label: formatName(team.name),
        });
      }
    });

    // Добавляем теги для контрактов (отображаем номер объекта)
    filters.contracts.forEach(contractId => {
      const contract = allContracts.find(c => c.id === contractId);
      if (contract) {
        tags.push({
          id: `contract-${contractId}`,
          type: 'contract',
          itemId: contractId,
          label: contract.object_number || contract.name,
        });
      }
    });

    return tags;
  };

  const refreshFilterOptions = () => {
    dataLoadedRef.current = false;
    loadFilterOptions();
  };

  return {
    filters,
    allTeams,
    allContracts,
    loading,
    applyFilters,
    removeTeamFilter,
    removeContractFilter,
    getActiveFilterTags,
    loadFilterOptions,
    refreshFilterOptions,
  };
};
