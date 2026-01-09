import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableHighlight, TouchableOpacity, Modal, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { timesheetAPI } from '../../../../services/api';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Фильтры</Text>

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
                <ActivityIndicator size="large" color="#999999" />
              </View>
            ) : (
              <>
                {activeTab === 'teams' && (
                  <>
                    <View style={styles.searchContainer}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Поиск бригады (мин. 2 символа)"
                        placeholderTextColor="#aaa"
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
                          <Text style={styles.clearButtonText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {searchLoadingTeams ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#999999" />
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
                        placeholderTextColor="#aaa"
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
                          <Text style={styles.clearButtonText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {searchLoadingContracts ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#999999" />
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

          <View style={styles.modalButtons}>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonReset]}
              onPress={onClose}
              underlayColor="#e8e8e8"
            >
              <Text style={styles.modalButtonTextReset}>Отмена</Text>
            </TouchableHighlight>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={handleReset}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.modalButtonTextCancel}>Сбросить</Text>
            </TouchableHighlight>
            <TouchableHighlight
              style={[styles.modalButton, styles.modalButtonApply]}
              onPress={handleApply}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.modalButtonTextApply}>Применить</Text>
            </TouchableHighlight>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: SCREEN_WIDTH - 30,
    maxHeight: '90%',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.23,
    shadowRadius: 11.78,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'center',
    paddingTop: 20,
    paddingBottom: 15,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  tabActive: {
    borderBottomColor: '#999999',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#aaa',
  },
  tabTextActive: {
    color: '#555',
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#999999',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    height: SCREEN_HEIGHT * 0.6,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  listItemSelected: {
    backgroundColor: '#e8e8e8',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#999999',
    borderColor: '#999999',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  listItemText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  listItemTextSelected: {
    fontWeight: '600',
    color: '#333',
  },
  contractInfo: {
    flex: 1,
  },
  objectNumber: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  objectNumberSelected: {
    color: '#777',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#999999',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  modalButtonReset: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonCancel: {
    backgroundColor: '#d0d0d0',
  },
  modalButtonApply: {
    backgroundColor: '#999999',
  },
  modalButtonTextReset: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonTextCancel: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonTextApply: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Стили для disabled объектов (не присутствующих в бригадах)
  listItemDisabled: {
    opacity: 0.6,
  },
  checkboxDisabled: {
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  listItemTextDisabled: {
    color: '#bbb',
  },
  objectNumberDisabled: {
    color: '#d0d0d0',
  },
});
