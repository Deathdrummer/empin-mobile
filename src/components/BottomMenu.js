import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActionSheet } from '@expo/react-native-action-sheet';

export default function BottomMenu({
  onLogout,
  onCalendarPress,
  onFilterPress,
  hasActiveFilters,
  onClearFilters,
  onNavigateToMessenger,
  onNavigateToTimesheet,
  onNavigateToChats,
  onNavigateToCallHistory,
  currentScreen,
  showCalendar = true,
  showFilter = true
}) {
  const { showActionSheetWithOptions } = useActionSheet();
  const handleFilterIconPress = () => {
    if (hasActiveFilters && onClearFilters) {
      onClearFilters();
    } else {
      onFilterPress();
    }
  };

  const handleAccountPress = () => {
    const isTimesheet = currentScreen === 'Timesheet';
    const isMessenger = currentScreen === 'Messenger';

    const options = [
      'План-график работ',
      'Мессенджер',
      'Выйти'
    ];

    const icons = [
      <Ionicons name="calendar-outline" size={22} color="#666666" />,
      <Ionicons name="chatbubble-outline" size={22} color="#666666" />,
      <Ionicons name="log-out-outline" size={22} color="#666666" />
    ];

    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      {
        options,
        icons,
        title: 'Меню аккаунта',
        textStyle: { paddingLeft: 0, marginLeft: -22 },
        cancelButtonIndex,
      },
      (selectedIndex) => {
        if (selectedIndex === cancelButtonIndex) {
          return; // Отмена
        }

        switch (selectedIndex) {
          case 0:
            // Переход на экран План-график работ
            if (!isTimesheet && onNavigateToTimesheet) {
              onNavigateToTimesheet();
            }
            break;
          case 1:
            // Переход в Мессенджер
            if (!isMessenger && onNavigateToMessenger) {
              onNavigateToMessenger();
            }
            break;
          case 2:
            // Выход
            if (onLogout) {
              onLogout();
            }
            break;
        }
      }
    );
  };

  const isMessengerSection = ['Messenger', 'Chats', 'CallHistory'].includes(currentScreen);

  return (
    <View style={styles.container}>
      {showCalendar ? (
        <TouchableOpacity style={styles.menuItem} onPress={onCalendarPress} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={28} color="#999999" />
        </TouchableOpacity>
      ) : isMessengerSection && onNavigateToChats ? (
        <TouchableOpacity style={styles.menuItem} onPress={onNavigateToChats} activeOpacity={0.7}>
          <Ionicons
            name="chatbubble-outline"
            size={28}
            color={currentScreen === 'Chats' ? "#6c5ce7" : "#999999"}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.menuItem} />
      )}

      {showFilter ? (
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
      ) : isMessengerSection && onNavigateToCallHistory ? (
        <TouchableOpacity style={styles.menuItem} onPress={onNavigateToCallHistory} activeOpacity={0.7}>
          <Ionicons
            name="call-outline"
            size={28}
            color={currentScreen === 'CallHistory' ? "#6c5ce7" : "#999999"}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.menuItem} />
      )}

      <TouchableOpacity style={styles.menuItem} onPress={() => {}} activeOpacity={0.7}>
        {/* Пустая секция 3 */}
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={handleAccountPress} activeOpacity={0.7}>
        <Ionicons name="person-circle-outline" size={28} color="#999999" />
      </TouchableOpacity>
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
});
