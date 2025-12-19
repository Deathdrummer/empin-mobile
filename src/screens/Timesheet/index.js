import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeviceMotion } from 'expo-sensors';
import { timesheetAPI } from '../../services/api';
import BottomMenu from '../../components/BottomMenu';
import { DayCard } from './components/DayCard';
import { StaffModal } from './components/modals/StaffModal';
import { ContractModal } from './components/modals/ContractModal';
import { CalendarModal } from './components/modals/CalendarModal';
import { LogoutModal } from './components/modals/LogoutModal';
import { FilterModal } from './components/modals/FilterModal';
import { EditCommentModal } from './components/modals/EditCommentModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { ActiveFilterTags } from './components/ActiveFilterTags';
import { useTimesheetData } from './hooks/useTimesheetData';
import { useTeamActions } from './hooks/useTeamActions';
import { useContractActions } from './hooks/useContractActions';
import { useCommentActions } from './hooks/useCommentActions';
import { useFilterData } from './hooks/useFilterData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TimesheetScreen({ onLogout }) {
  const {
    filters,
    allTeams,
    allContracts,
    loading: filterDataLoading,
    applyFilters,
    removeTeamFilter,
    removeContractFilter,
    getActiveFilterTags,
    refreshFilterOptions,
  } = useFilterData();

  const {
    days,
    loading,
    refreshing,
    filterLoading,
    currentIndex,
    setCurrentIndex,
    flatListRef,
    minIndex,
    maxIndex,
    loadDays,
    onRefresh,
    loadMoreForward,
    loadMoreBackward,
    handleDateSelect,
    handleContentSizeChange,
    LOAD_MORE_THRESHOLD,
    loadingMore,
    isPrepending,
    dataVersion,
    initialScrollIndex,
  } = useTimesheetData(onLogout, filters, isPrependingRef);

  const {
    staffModalVisible,
    setStaffModalVisible,
    staffList,
    openAddTeamModal,
    handleAddTeam,
    handleDeleteTeam,
    deleteConfirmVisible: teamDeleteConfirmVisible,
    setDeleteConfirmVisible: setTeamDeleteConfirmVisible,
    deleteData: teamDeleteData,
    confirmDeleteTeam,
    deletingTeam,
  } = useTeamActions(loadDays, minIndex, maxIndex);

  const {
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
    deleteConfirmVisible: contractDeleteConfirmVisible,
    setDeleteConfirmVisible: setContractDeleteConfirmVisible,
    deleteData: contractDeleteData,
    confirmDeleteContract,
    deletingContract,
  } = useContractActions(loadDays, minIndex, maxIndex);

  const {
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
    deleteConfirmVisible: commentDeleteConfirmVisible,
    setDeleteConfirmVisible: setCommentDeleteConfirmVisible,
    deleteData: commentDeleteData,
    deletingComment,
    handleEditComment,
    handleUpdateComment,
    handleCancelEdit,
    handleReplyComment,
    handleCancelReply,
    handleToggleReaction,
  } = useCommentActions(loadDays, minIndex, maxIndex);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const scrollStartX = useRef(0);
  const isScrolling = useRef(false);
  const lastScrollTime = useRef(0);
  const isPrependingRef = useRef(false);

  // Shake detection
  useEffect(() => {
    let lastUpdate = 0;
    let lastShake = 0;
    const SHAKE_THRESHOLD = 800;
    const SHAKE_COOLDOWN = 2000; // 2 секунды между встряхиваниями

    const subscription = DeviceMotion.addListener((data) => {
      const { acceleration } = data;

      if (!acceleration || typeof acceleration.x !== 'number') {
        return;
      }

      const curTime = new Date().getTime();

      // Проверка cooldown для избежания множественных срабатываний
      if ((curTime - lastShake) < SHAKE_COOLDOWN) {
        return;
      }

      if ((curTime - lastUpdate) > 100) {
        const diffTime = curTime - lastUpdate;
        lastUpdate = curTime;

        const speed = Math.abs(acceleration.x + acceleration.y + acceleration.z - 0) / diffTime * 10000;

        if (speed > SHAKE_THRESHOLD && !refreshing) {
          lastShake = curTime;
          onRefresh();
        }
      }
    });

    DeviceMotion.setUpdateInterval(100);

    return () => {
      subscription && subscription.remove();
    };
  }, [onRefresh, refreshing]);

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await timesheetAPI.logout();
      onLogout();
    } catch (error) {
      onLogout();
    }
  };

  const handleCalendarPress = () => {
    setCalendarModalVisible(true);
  };

  const handleFilterPress = () => {
    setFilterModalVisible(true);
  };

  const handleApplyFilters = (newFilters) => {
    applyFilters(newFilters);
    setFilterModalVisible(false);
  };

  const handleClearFilters = () => {
    applyFilters({
      teams: [],
      contracts: [],
    });
  };

  const hasActiveFilters = filters.teams.length > 0 || filters.contracts.length > 0;
  const activeFilterTags = getActiveFilterTags();

  const handleRemoveFilterTag = (type, itemId) => {
    if (type === 'team') {
      removeTeamFilter(itemId);
    } else if (type === 'contract') {
      removeContractFilter(itemId);
    }
  };

  const onDateSelect = (date) => {
    setCalendarModalVisible(false);
    handleDateSelect(date);
  };

  // Вычисляем текущую выбранную дату на основе индекса
  const getCurrentSelectedDate = () => {
    if (days.length === 0 || currentIndex >= days.length) return new Date();
    const dayIndex = days[currentIndex]?.index || 0;
    const today = new Date();
    const selectedDate = new Date(today);
    selectedDate.setDate(today.getDate() + dayIndex);
    return selectedDate;
  };

  const toggleChat = (contractId) => {
    setExpandedContract(
      expandedContract === contractId ? null : contractId
    );
  };

  const renderDay = ({ item }) => (
    <DayCard
      item={item}
      expandedContract={expandedContract}
      commentText={commentText}
      addingComment={addingComment}
      replyingToComment={replyingToComment}
      deletingTeam={deletingTeam}
      deletingContract={deletingContract}
      deletingComment={deletingComment}
      onAddTeam={openAddTeamModal}
      onDeleteTeam={handleDeleteTeam}
      onAddContract={openAddContractModal}
      onDeleteContract={handleDeleteContract}
      onDeleteContractDirect={handleDeleteContractDirect}
      onToggleChat={toggleChat}
      onCommentChange={setCommentText}
      onAddComment={handleAddComment}
      onDeleteComment={handleDeleteComment}
      onEditComment={handleEditComment}
      onReplyComment={handleReplyComment}
      onToggleReaction={handleToggleReaction}
      onCancelReply={handleCancelReply}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#999999" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {filterLoading && (
        <View style={styles.filterLoadingOverlay}>
          <ActivityIndicator size="large" color="#999999" />
        </View>
      )}

      {isPrepending && (
        <View style={styles.prependingOverlay}>
          <ActivityIndicator size="large" color="#999999" />
        </View>
      )}

      <CalendarModal
        visible={calendarModalVisible}
        selectedDate={getCurrentSelectedDate()}
        onClose={() => setCalendarModalVisible(false)}
        onDateSelect={onDateSelect}
      />

      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
      />

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
        allTeams={allTeams}
        allContracts={allContracts}
        loading={filterDataLoading}
        onRefresh={refreshFilterOptions}
      />

      <StaffModal
        visible={staffModalVisible}
        staffList={staffList}
        onClose={() => setStaffModalVisible(false)}
        onSelectStaff={handleAddTeam}
      />

      <ContractModal
        visible={contractModalVisible}
        contractSearch={contractSearch}
        contractsList={contractsList}
        loading={addingContract}
        onClose={() => setContractModalVisible(false)}
        onSearchChange={searchContracts}
        onSelectContract={handleAddContract}
      />

      <EditCommentModal
        visible={!!editingComment}
        comment={editingComment}
        onClose={handleCancelEdit}
        onSave={handleUpdateComment}
        loading={updatingComment}
      />

      <DeleteConfirmModal
        visible={teamDeleteConfirmVisible}
        title="Удалить бригаду?"
        message={`Вы уверены, что хотите удалить бригаду "${teamDeleteData.name}"?`}
        onCancel={() => setTeamDeleteConfirmVisible(false)}
        onConfirm={confirmDeleteTeam}
      />

      <DeleteConfirmModal
        visible={contractDeleteConfirmVisible}
        title="Удалить договор?"
        message={`Вы уверены, что хотите удалить договор "${contractDeleteData.name}"?`}
        onCancel={() => setContractDeleteConfirmVisible(false)}
        onConfirm={confirmDeleteContract}
      />

      <DeleteConfirmModal
        visible={commentDeleteConfirmVisible}
        title="Удалить комментарий?"
        message="Вы уверены, что хотите удалить этот комментарий?"
        onCancel={() => setCommentDeleteConfirmVisible(false)}
        onConfirm={confirmDeleteComment}
      />

      <FlatList
        key={`timesheet-${dataVersion}`}
        ref={flatListRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.index.toString()}
        initialScrollIndex={initialScrollIndex}
        horizontal
        pagingEnabled={false}
        scrollEnabled={true}
        directionalLockEnabled={true}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        keyboardShouldPersistTaps='handled'
        onContentSizeChange={handleContentSizeChange}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onScrollBeginDrag={(event) => {
          scrollStartX.current = event.nativeEvent.contentOffset.x;
          isScrolling.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          const now = Date.now();
          const timeSinceLastScroll = now - lastScrollTime.current;

          // КРИТИЧНО: блокируем все scroll events во время prepending
          if (isPrependingRef.current) {
            return;
          }

          // Игнорируем scroll events в течение 200ms после предыдущего
          // для предотвращения множественных срабатываний
          if (timeSinceLastScroll < 200) {
            return;
          }

          if (loadingMore) {
            return;
          }

          lastScrollTime.current = now;

          const currentOffsetX = event.nativeEvent.contentOffset.x;
          const newIndex = Math.round(currentOffsetX / SCREEN_WIDTH);

          if (newIndex === currentIndex) {
            return;
          }

          setCurrentIndex(newIndex);
          isScrolling.current = false;

          const currentDayData = days[newIndex];
          const currentDayIndex = currentDayData?.index;

          // Проверяем расстояние до границ ДИАПАЗОНА (а не массива записей)
          // Это важно для корректной работы с фильтрами
          const distanceToMinBoundary = currentDayIndex - minIndex;
          const distanceToMaxBoundary = maxIndex - currentDayIndex;

          console.log('📊 [SCROLL] Позиция:', {
            arrayIndex: newIndex,
            dayIndex: currentDayIndex,
            date: currentDayData?.date,
            totalDays: days.length,
            loadedRange: `${minIndex} .. ${maxIndex}`,
            distanceToMinBoundary,
            distanceToMaxBoundary,
            threshold: LOAD_MORE_THRESHOLD,
          });

          if (distanceToMinBoundary <= LOAD_MORE_THRESHOLD) {
            console.log('⬅️ [LOAD] Подгрузка НАЗАД (близко к minIndex)');
            loadMoreBackward(newIndex);
          } else if (distanceToMaxBoundary <= LOAD_MORE_THRESHOLD) {
            console.log('➡️ [LOAD] Подгрузка ВПЕРЕД (близко к maxIndex)');
            loadMoreForward();
          } else {
            console.log('✅ [SCROLL] Подгрузка не требуется');
          }
        }}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            if (flatListRef.current && info.index < days.length) {
              flatListRef.current.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }
          }, 100);
        }}
      />
      <ActiveFilterTags
        tags={activeFilterTags}
        onRemoveTag={handleRemoveFilterTag}
      />
      <BottomMenu
        onLogout={handleLogout}
        onCalendarPress={handleCalendarPress}
        onFilterPress={handleFilterPress}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9ECF1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3eff6',
  },
  filterLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  prependingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
