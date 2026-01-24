import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomMenu from '../../components/BottomMenu';
import { LogoutModal } from '../Timesheet/components/modals/LogoutModal';
import { timesheetAPI } from '../../services/api';

export default function ChatScreen({ navigation, route }) {
  const { staffName = 'Собеседник', onLogout } = route.params || {};
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleNavigateToTimesheet = () => {
    navigation.navigate('Timesheet');
  };

  const handleNavigateToChats = () => {
    navigation.goBack();
  };

  const handleNavigateToCallHistory = () => {
    navigation.navigate('Messenger');
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await timesheetAPI.logout();
      if (onLogout) onLogout();
    } catch (error) {
      if (onLogout) onLogout();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <View style={styles.backArrow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{staffName}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.stubText}>Чат с {staffName}</Text>
        <Text style={styles.stubSubtext}>Скоро здесь будут сообщения</Text>
      </View>
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
        currentScreen="Chats"
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#777',
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stubText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  stubSubtext: {
    fontSize: 14,
    color: '#999',
  },
});
