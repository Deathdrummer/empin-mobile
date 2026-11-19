import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useToday } from '../../services/production';
import { reportsAPI } from '../../services/reports';
import { reportStatusTitle } from '../../utils/reports';
import { dayLabelWithDate, executorTitle } from '../../utils/tasks';

/**
 * На согласование (п. 8.4): отправленные отчёты и черновики по заданиям, которые сотрудник создал, и в области права
 * «Согласовывать чужие отчёты»; сначала отправленные. Список — при связи
 */
export default function ApprovalsScreen({ navigation }) {
  const theme = useTheme();
  const s = styles(theme);
  const today = useToday();
  const [items, setItems] = useState(null);
  const [state, setState] = useState('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await reportsAPI.pending()).items || []);
      setState('ready');
    } catch {
      setState('offline');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={28} color={theme.accent} />
        </Pressable>
        <Text style={s.topTitle}>На согласование</Text>
        <View style={s.back} />
      </View>
      {items === null ? (
        state === 'loading' ? <ActivityIndicator style={s.loader} size="large" color={theme.accent} /> : (
          <View style={s.stub}>
            <Ionicons name="cloud-offline-outline" size={44} color={theme.textMuted} />
            <Text style={s.stubText}>Нет связи</Text>
            <TouchableOpacity onPress={() => { setState('loading'); load(); }} style={s.retry}>
              <Text style={s.retryText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.accent} colors={[theme.accent]} />}
          ListEmptyComponent={(
            <View style={s.stub}>
              <Ionicons name="checkmark-done-outline" size={44} color={theme.textMuted} />
              <Text style={s.stubText}>Нет отчётов</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.card, pressed && { backgroundColor: theme.surfacePressed }]}
              onPress={() => navigation.navigate('Report', { task: item })}
            >
              <View style={s.cardHead}>
                <Text style={s.number}>{item.object?.number || '—'}</Text>
                <View style={[s.pill, { backgroundColor: item.report?.status === 'submitted' ? theme.accent : theme.fill }]}>
                  <Text style={[s.pillText, { color: item.report?.status === 'submitted' ? theme.onAccent : theme.textSecondary }]}>
                    {reportStatusTitle(item.report?.status)}
                  </Text>
                </View>
              </View>
              <Text style={s.title}>{item.object?.title || 'Объект'}</Text>
              <Text style={s.sub}>{`${dayLabelWithDate(item.date, today)} · ${executorTitle(item.executor)}`}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark ? theme.background : theme.surfaceAlt },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, height: 50 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  loader: { marginTop: 80 },
  stub: { alignItems: 'center', gap: 12, paddingHorizontal: 32, marginTop: 80 },
  stubText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  retry: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.accentSoft },
  retryText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { fontSize: 15, fontWeight: '700', color: theme.accentText },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 16, color: theme.text },
  sub: { fontSize: 13, color: theme.textSecondary },
});
