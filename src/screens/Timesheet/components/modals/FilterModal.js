import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { timesheetAPI } from '../../../../services/api';
import Toast from 'react-native-toast-message';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FilterModal = ({
  visible,
  onClose,
  onApply,
  currentFilters,
  allTeams,
  allContracts,
  loading,
  onRefresh,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' или 'contracts'
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedContracts, setSelectedContracts] = useState([]);

  // Поиск
  const [searchTeam, setSearchTeam] = useState('');
  const [searchContract, setSearchContract] = useState('');
  const [filteredTeams, setFilteredTeams] = useState(allTeams);
  const [filteredContracts, setFilteredContracts] = useState(allContracts);
  const [searchLoadingTeams, setSearchLoadingTeams] = useState(false);
  const [searchLoadingContracts, setSearchLoadingContracts] = useState(false);

  // Восстанавливаем текущие фильтры при открытии модала
  useEffect(() => {
    if (visible && currentFilters) {
      setSelectedTeams(currentFilters.teams || []);
      setSelectedContracts(currentFilters.contracts || []);
    }
  }, [visible, currentFilters]);

  // Инициализация списков при изменении данных
  useEffect(() => {
    setFilteredTeams(allTeams);
  }, [allTeams]);

  useEffect(() => {
    setFilteredContracts(allContracts);
  }, [allContracts]);

  // Debounce серверная фильтрация бригад (500мс, минимум 2 символа)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTeam.trim().length >= 2) {
        setSearchLoadingTeams(true);
        try {
          const results = await timesheetAPI.searchFilterTeams(searchTeam.trim());
          setFilteredTeams(results);
        } catch (error) {
          console.error('Error searching teams', { error: error.message });
          Toast.show({
            type: 'error',
            text1: 'Ошибка поиска',
            text2: 'Не удалось выполнить поиск бригад',
            position: 'top',
            visibilityTime: 3000,
          });
          setFilteredTeams(allTeams);
        } finally {
          setSearchLoadingTeams(false);
        }
      } else {
        // При пустом поиске показываем полный список
        setFilteredTeams(allTeams);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTeam, allTeams]);

  // Debounce серверная фильтрация объектов (500мс)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const searchTerm = searchContract.trim();

      if (searchTerm.length >= 2) {
        // При вводе в поиск (>= 2 символа) - показываем ВСЕ объекты (и добавленные, и не добавленные в бригады)
        setSearchLoadingContracts(true);
        try {
          const results = await timesheetAPI.searchAllFilterContracts(searchTerm);

          // Проверяем, что results - массив
          if (!Array.isArray(results)) {
            console.error('Results is not an array', { results });
            setFilteredContracts(allContracts);
            return;
          }

          // Разделяем на две группы и склеиваем (сохраняя сортировку по дате внутри групп)
          // Сначала объекты в бригадах (in_teams: true), затем остальные (in_teams: false)
          const inTeams = results.filter(c => c.in_teams);
          const notInTeams = results.filter(c => !c.in_teams);
          const sortedResults = [...inTeams, ...notInTeams];

          setFilteredContracts(sortedResults);
        } catch (error) {
          console.error('Error searching all contracts', { error: error.message });
          Toast.show({
            type: 'error',
            text1: 'Ошибка поиска',
            text2: 'Не удалось выполнить поиск объектов',
            position: 'top',
            visibilityTime: 3000,
          });
          setFilteredContracts(allContracts);
        } finally {
          setSearchLoadingContracts(false);
        }
      } else {
        // При пустом поиске - показываем ТОЛЬКО объекты, добавленные в бригады (из allContracts)
        // allContracts загружается из getFilterOptions, который возвращает только объекты в бригадах
        setFilteredContracts(allContracts);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchContract, allContracts]);

  const handleApply = () => {
    if (onApply) {
      onApply({
        teams: selectedTeams,
        contracts: selectedContracts,
      });
    }
    onClose();
  };

  const handleReset = () => {
    setSelectedTeams([]);
    setSelectedContracts([]);
  };

  const handleClearTeamSearch = () => {
    setSearchLoadingTeams(true);
    setSearchTeam('');
    setTimeout(() => {
      setFilteredTeams(allTeams);
      setSearchLoadingTeams(false);
    }, 100);
  };

  const handleClearContractSearch = () => {
    setSearchLoadingContracts(true);
    setSearchContract('');
    setTimeout(() => {
      setFilteredContracts(allContracts);
      setSearchLoadingContracts(false);
    }, 100);
  };

  const toggleTeam = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      }
      return [...prev, teamId];
    });
  };

  const toggleContract = (contractId, isDisabled) => {
    // Запрещаем выбор disabled объектов (не присутствующих в бригадах)
    if (isDisabled) {
      return;
    }

    setSelectedContracts(prev => {
      if (prev.includes(contractId)) {
        return prev.filter(id => id !== contractId);
      }
      return [...prev, contractId];
    });
  };

  const renderTeamItem = ({ item }) => {
    const isSelected = selectedTeams.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected]}
        onPress={() => toggleTeam(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={theme.onAccent} />}
        </View>
        <Text
          style={[styles.listItemText, isSelected && styles.listItemTextSelected]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContractItem = ({ item }) => {
    const isSelected = selectedContracts.includes(item.id);
    const isDisabled = !item.in_teams; // Объект не присутствует в бригадах

    return (
      <TouchableOpacity
        style={[
          styles.listItem,
          isSelected && styles.listItemSelected,
          isDisabled && styles.listItemDisabled,
        ]}
        onPress={() => toggleContract(item.id, isDisabled)}
        activeOpacity={isDisabled ? 1 : 0.7}
        disabled={isDisabled}
      >
        <View style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected,
          isDisabled && styles.checkboxDisabled,
        ]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={theme.onAccent} />}
        </View>
        <View style={styles.contractInfo}>
          <Text
            style={[
              styles.listItemText,
              isSelected && styles.listItemTextSelected,
              isDisabled && styles.listItemTextDisabled,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.object_number && (
            <Text
              style={[
                styles.objectNumber,
                isSelected && styles.objectNumberSelected,
                isDisabled && styles.objectNumberDisabled,
              ]}
              numberOfLines={1}
            >
              {item.object_number}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Фильтры"
      wide
      // В окне поиск по бригадам и объектам: окно поднимается над клавиатурой
      keyboard
      buttons={(
        <>
          <DialogButton title="Отмена" onPress={onClose} />
          <DialogButton title="Сбросить" onPress={handleReset} />
          <DialogButton title="Применить" variant="primary" onPress={handleApply} />
        </>
      )}
    >
      {/* Вкладки */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'teams' && styles.tabActive]}
          onPress={() => setActiveTab('teams')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.tabTextActive]}>
            Бригады
          </Text>
          {selectedTeams.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedTeams.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contracts' && styles.tabActive]}
          onPress={() => setActiveTab('contracts')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'contracts' && styles.tabTextActive]}>
            Объекты
          </Text>
          {selectedContracts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedContracts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Контент вкладок */}
      <View style={styles.filterContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <>
            {activeTab === 'teams' && (
              <>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск бригады (мин. 2 символа)"
                    placeholderTextColor={theme.textMuted}
                    value={searchTeam}
                    onChangeText={setSearchTeam}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchTeam.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={handleClearTeamSearch}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {searchLoadingTeams ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : (
                  <FlashList
                    data={filteredTeams}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderTeamItem}
                    estimatedItemSize={56}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          {searchTeam.trim().length >= 2
                            ? 'Ничего не найдено'
                            : 'Нет доступных бригад'
                          }
                        </Text>
                        {searchTeam.trim().length < 2 && (
                          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                            <Text style={styles.refreshButtonText}>Обновить</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    }
                    showsVerticalScrollIndicator={true}
                  />
                )}
              </>
            )}
            {activeTab === 'contracts' && (
              <>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск объекта (мин. 2 символа)"
                    placeholderTextColor={theme.textMuted}
                    value={searchContract}
                    onChangeText={setSearchContract}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchContract.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={handleClearContractSearch}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {searchLoadingContracts ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : (
                  <FlashList
                    data={filteredContracts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderContractItem}
                    estimatedItemSize={56}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          {searchContract.trim().length >= 2
                            ? 'Ничего не найдено'
                            : 'Нет доступных объектов'
                          }
                        </Text>
                        {searchContract.trim().length < 2 && (
                          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                            <Text style={styles.refreshButtonText}>Обновить</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    }
                    showsVerticalScrollIndicator={true}
                  />
                )}
              </>
            )}
          </>
        )}
      </View>

    </Dialog>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: theme.dark ? theme.surfaceAlt : theme.surface,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: theme.dark ? 0 : 0.08,
    shadowRadius: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  tabTextActive: {
    color: theme.text,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: theme.onAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  filterContainer: {
    paddingTop: 12,
    height: SCREEN_HEIGHT * 0.55,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingRight: 44,
    fontSize: 15,
    color: theme.text,
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: theme.fill,
  },
  listItemSelected: {
    backgroundColor: theme.accentSoft,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.textMuted,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  listItemText: {
    fontSize: 15,
    color: theme.text,
    flex: 1,
  },
  listItemTextSelected: {
    fontWeight: '600',
    color: theme.text,
  },
  contractInfo: {
    flex: 1,
  },
  objectNumber: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  objectNumberSelected: {
    color: theme.accentText,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 18,
  },
  refreshButtonText: {
    color: theme.accentText,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Объекты, которых нет в бригадах: видны в поиске, но выбрать нельзя
  listItemDisabled: {
    opacity: 0.5,
  },
  checkboxDisabled: {
    borderColor: theme.separator,
  },
  listItemTextDisabled: {
    color: theme.textMuted,
  },
  objectNumberDisabled: {
    color: theme.textMuted,
  },
});
