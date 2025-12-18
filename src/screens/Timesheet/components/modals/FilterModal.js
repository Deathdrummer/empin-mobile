import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableHighlight, TouchableOpacity, Modal, FlatList, ActivityIndicator, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  // Восстанавливаем текущие фильтры при открытии модала
  useEffect(() => {
    if (visible && currentFilters) {
      setSelectedTeams(currentFilters.teams || []);
      setSelectedContracts(currentFilters.contracts || []);
    }
  }, [visible, currentFilters]);

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

  const toggleTeam = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      }
      return [...prev, teamId];
    });
  };

  const toggleContract = (contractId) => {
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
        <Text style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContractItem = ({ item }) => {
    const isSelected = selectedContracts.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected]}
        onPress={() => toggleContract(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.contractInfo}>
          <Text style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
            {item.name}
          </Text>
          {item.object_number && (
            <Text style={[styles.objectNumber, isSelected && styles.objectNumberSelected]}>
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
                  <FlatList
                    data={allTeams}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderTeamItem}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Нет доступных бригад</Text>
                        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                          <Text style={styles.refreshButtonText}>Обновить</Text>
                        </TouchableOpacity>
                      </View>
                    }
                    showsVerticalScrollIndicator={true}
                  />
                )}
                {activeTab === 'contracts' && (
                  <FlatList
                    data={allContracts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderContractItem}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Нет доступных объектов</Text>
                        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                          <Text style={styles.refreshButtonText}>Обновить</Text>
                        </TouchableOpacity>
                      </View>
                    }
                    showsVerticalScrollIndicator={true}
                  />
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
    minHeight: 200,
    maxHeight: 600,
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
});
