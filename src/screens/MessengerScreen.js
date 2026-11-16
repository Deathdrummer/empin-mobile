import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import ChatsTab from './Messenger/ChatsTab';
import CallHistoryTab from './Messenger/CallHistoryTab';

const MessengerTabFrame = ({ children }) => {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {children}
    </SafeAreaView>
  );
};

/** Вкладка «Чаты» корневого нативного навигатора вкладок */
export function ChatsScreen() {
  return (
    <MessengerTabFrame>
      <ChatsTab />
    </MessengerTabFrame>
  );
}

/** Вкладка «Звонки» корневого нативного навигатора вкладок */
export function CallsScreen() {
  return (
    <MessengerTabFrame>
      <CallHistoryTab />
    </MessengerTabFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
