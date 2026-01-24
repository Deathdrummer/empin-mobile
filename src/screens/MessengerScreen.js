import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomMenu from '../components/BottomMenu';
import { LogoutModal } from './Timesheet/components/modals/LogoutModal';
import { timesheetAPI } from '../services/api';
import ChatsTab from './Messenger/ChatsTab';

export default function MessengerScreen({ onLogout }) {
  const navigation = useNavigation();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');

  const handleNavigateToTimesheet = () => {
    navigation.replace('Timesheet');
  };

  const handleNavigateToChats = () => {
    setActiveTab('chats');
  };

  const handleNavigateToCallHistory = () => {
    setActiveTab('callHistory');
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

  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return <ChatsTab />;
      case 'callHistory':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>История звонков</Text>
          </View>
        );
      default:
        return (
          <View style={styles.content}>
            <Text style={styles.title}>Мессенджер</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {renderContent()}
      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
      />
      <BottomMenu
        section="messenger"
        onLogout={handleLogout}
        onNavigateToTimesheet={handleNavigateToTimesheet}
        onNavigateToChats={handleNavigateToChats}
        onNavigateToCallHistory={handleNavigateToCallHistory}
        currentScreen={activeTab === 'chats' ? 'Chats' : activeTab === 'callHistory' ? 'CallHistory' : 'Messenger'}
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
