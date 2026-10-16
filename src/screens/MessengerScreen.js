import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TabBar } from '../components/TabBar';
import ChatsTab from './Messenger/ChatsTab';
import CallHistoryTab from './Messenger/CallHistoryTab';

/** Вкладки «Чаты» и «Звонки»: какая открыта — задаёт параметр маршрута tab */
export default function MessengerScreen({ route }) {
  const theme = useTheme();
  const tab = route?.params?.tab === 'calls' ? 'calls' : 'chats';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {tab === 'calls' ? <CallHistoryTab /> : <ChatsTab />}
      <TabBar active={tab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
