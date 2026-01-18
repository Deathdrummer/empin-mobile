import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BottomMenu from '../components/BottomMenu';
import { LogoutModal } from './Timesheet/components/modals/LogoutModal';
import { timesheetAPI } from '../services/api';

export default function CallHistoryScreen({ onLogout }) {
  const navigation = useNavigation();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleNavigateToTimesheet = () => {
    navigation.navigate('Timesheet');
  };

  const handleNavigateToChats = () => {
    navigation.navigate('Chats');
  };

  const handleNavigateToMessenger = () => {
    navigation.navigate('Messenger');
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleNavigateToChats}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={28} color="#999999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleNavigateToMessenger}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#999999" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>История звонков</Text>
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
        onNavigateToMessenger={handleNavigateToMessenger}
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
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2dde7',
  },
  headerButton: {
    marginRight: 16,
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
