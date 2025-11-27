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
import { EditCommentModal } from './components/modals/EditCommentModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { useTimesheetData } from './hooks/useTimesheetData';
import { useTeamActions } from './hooks/useTeamActions';
import { useContractActions } from './hooks/useContractActions';
import { useCommentActions } from './hooks/useCommentActions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TimesheetScreen({ onLogout }) {
  const {
    days,
    loading,
    refreshing,
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
    LOAD_MORE_THRESHOLD,
    loadingMore,
  } = useTimesheetData(onLogout);

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
    deleteConfirmVisible: contractDeleteConfirmVisible,
    setDeleteConfirmVisible: setContractDeleteConfirmVisible,
    deleteData: contractDeleteData,
    confirmDeleteContract,
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
    handleEditComment,
    handleUpdateComment,
    handleCancelEdit,
    handleReplyComment,
    handleCancelReply,
  } = useCommentActions(loadDays, minIndex, maxIndex);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const scrollStartX = useRef(0);
  const isScrolling = useRef(false);

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
      onAddTeam={openAddTeamModal}
      onDeleteTeam={handleDeleteTeam}
      onAddContract={openAddContractModal}
      onDeleteContract={handleDeleteContract}
      onToggleChat={toggleChat}
      onCommentChange={setCommentText}
      onAddComment={handleAddComment}
      onDeleteComment={handleDeleteComment}
      onEditComment={handleEditComment}
      onReplyComment={handleReplyComment}
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

      <FlatList
        ref={flatListRef}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.index.toString()}
        horizontal
        pagingEnabled={false}
        scrollEnabled={true}
        directionalLockEnabled={true}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        keyboardShouldPersistTaps='handled'
        initialScrollIndex={currentIndex}
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
          // Игнорируем изменения во время подгрузки данных
          if (loadingMore) return;

          const currentOffsetX = event.nativeEvent.contentOffset.x;
          const scrollDistance = Math.abs(currentOffsetX - scrollStartX.current);
          const minSwipeDistance = SCREEN_WIDTH * 0.3;
          const minUserScrollDistance = 50;

          const newIndex = Math.round(currentOffsetX / SCREEN_WIDTH);

          // Игнорируем программные скроллы (scrollDistance близко к 0)
          if (scrollDistance < minUserScrollDistance) {
            return;
          }

          // Если свайп меньше 30%, возвращаем на текущую страницу
          if (scrollDistance < minSwipeDistance && newIndex !== currentIndex) {
            if (flatListRef.current) {
              flatListRef.current.scrollToIndex({
                index: currentIndex,
                animated: true,
              });
            }
            return;
          }

          setCurrentIndex(newIndex);
          isScrolling.current = false;

          const daysFromEnd = days.length - 1 - newIndex;
          const daysFromStart = newIndex;

          if (daysFromEnd <= LOAD_MORE_THRESHOLD) {
            loadMoreForward();
          }

          if (daysFromStart <= LOAD_MORE_THRESHOLD) {
            loadMoreBackward();
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
      <BottomMenu onLogout={handleLogout} onCalendarPress={handleCalendarPress} />
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
});
