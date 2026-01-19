import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BottomMenu({
  section, // 'timesheet' | 'messenger'
  onLogout,
  onCalendarPress,
  onFilterPress,
  hasActiveFilters,
  onClearFilters,
  onNavigateToMessenger,
  onNavigateToTimesheet,
  onNavigateToChats,
  onNavigateToCallHistory,
  currentScreen
}) {
  // Левая кнопка: "три точки" (фиксированная для всех разделов)
  const renderLeftButton = () => {
    return (
      <TouchableOpacity style={styles.menuItem} onPress={() => {}} activeOpacity={0.7}>
        <Ionicons name="ellipsis-vertical" size={28} color="#999999" />
      </TouchableOpacity>
    );
  };

  // Правая кнопка: переключение раздела (фиксированная для всех разделов)
  const renderRightButton = () => {
    // Иконка меняется в зависимости от текущего раздела:
    // - если активен timesheet → показываем иконку messenger
    // - если активен messenger → показываем иконку timesheet
    const icon = section === 'timesheet' ? 'chatbubbles-outline' : 'calendar-outline';

    return (
      <TouchableOpacity style={styles.menuItem} onPress={() => {}} activeOpacity={0.7}>
        <Ionicons name={icon} size={28} color="#999999" />
      </TouchableOpacity>
    );
  };

  // Средние кнопки: динамические в зависимости от раздела
  const renderMiddleButtons = () => {
    if (section === 'timesheet') {
      // План-график работ: календарь + фильтр
      return (
        <>
          <TouchableOpacity style={styles.menuItem} onPress={onCalendarPress} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={28} color="#999999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onFilterPress} activeOpacity={0.7}>
            <View style={styles.filterIconContainer}>
              <Ionicons name="funnel-outline" size={28} color="#999999" />
              {hasActiveFilters && (
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={onClearFilters}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={20} color="#555555" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </>
      );
    } else if (section === 'messenger') {
      // Мессенджер: чаты + звонки
      return (
        <>
          <TouchableOpacity style={styles.menuItem} onPress={onNavigateToChats} activeOpacity={0.7}>
            <View style={[
              styles.iconWrapper,
              currentScreen === 'Chats' && styles.iconWrapperActive
            ]}>
              <Ionicons
                name="chatbubble-outline"
                size={24}
                color={currentScreen === 'Chats' ? "#2c2c2c" : "#999999"}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onNavigateToCallHistory} activeOpacity={0.7}>
            <View style={[
              styles.iconWrapper,
              currentScreen === 'CallHistory' && styles.iconWrapperActive
            ]}>
              <Ionicons
                name="call-outline"
                size={24}
                color={currentScreen === 'CallHistory' ? "#2c2c2c" : "#999999"}
              />
            </View>
          </TouchableOpacity>
        </>
      );
    }

    // Заглушка для неизвестного раздела
    return (
      <>
        <View style={styles.menuItem} />
        <View style={styles.menuItem} />
      </>
    );
  };

  return (
    <View style={styles.container}>
      {renderLeftButton()}
      {renderMiddleButtons()}
      {renderRightButton()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2dde7',
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearFilterButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 8,
  },
  iconWrapperActive: {
    backgroundColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
	 borderRadius: 10,
  },
});
