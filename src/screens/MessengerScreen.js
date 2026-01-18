import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomMenu from '../components/BottomMenu';
import { LogoutModal } from './Timesheet/components/modals/LogoutModal';
import { timesheetAPI } from '../services/api';

export default function MessengerScreen({ onLogout }) {
  const navigation = useNavigation();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleNavigateToTimesheet = () => {
    navigation.replace('Timesheet');
  };

  const handleNavigateToChats = () => {
    navigation.replace('Chats');
  };

  const handleNavigateToCallHistory = () => {
    navigation.replace('CallHistory');
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Мессенджер</Text>
      </View>
      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
      />
      <BottomMenu
        showCalendar={false}
        showFilter={false}
        onLogout={handleLogout}
        onNavigateToTimesheet={handleNavigateToTimesheet}
        onNavigateToChats={handleNavigateToChats}
        onNavigateToCallHistory={handleNavigateToCallHistory}
        currentScreen="Messenger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3eff6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: '#999999',
    fontWeight: '500',
  },
});
