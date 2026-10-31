import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import ChatsTab from './ChatsTab';

/** «Архив» — чаты, убранные из основного списка (открывается строкой «Архив» над списком чатов) */
export default function ChatArchiveScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ChatsTab archive />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
