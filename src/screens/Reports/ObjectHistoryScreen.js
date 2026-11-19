import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useToday } from '../../services/production';
import { reportsAPI } from '../../services/reports';
import { describeObjectEntry } from '../../utils/reports';
import { executorTitle, formatDayShort, formatStamp } from '../../utils/tasks';

/**
 * История выполнения объекта из шкалы готовности в карточке задания (П-ФК-34): изменения процента с источником и
 * согласованные отчёты по видимым заданиям
 */
export default function ObjectHistoryScreen({ navigation, route }) {
  const { task } = route.params || {};
  const theme = useTheme();
  const s = styles(theme);
  const today = useToday();
  const [items, setItems] = useState(null);
  const [state, setState] = useState('loading');

  const load = useCallback(async () => {
    try {
      setItems((await reportsAPI.objectHistory(task.id)).items || []);
      setState('ready');
    } catch {
      setState('offline');
    }
  }, [task?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={28} color={theme.accent} />
        </Pressable>
        <Text style={s.topTitle}>История объекта</Text>
        <View style={s.back} />
      </View>
      <View style={s.hero}>
        {task?.object?.number ? <Text style={s.heroNumber}>{task.object.number}</Text> : null}
        <Text style={s.heroTitle}>{task?.object?.title || 'Объект'}</Text>
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
          keyExtractor={(item, index) => `${item.type}-${item.task_id || ''}-${item.at}-${index}`}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.stubText}>Нет изменений</Text>}
          renderItem={({ item }) => {
            const entry = describeObjectEntry(item);
            return (
              <View style={s.card}>
                <Text style={s.title}>{entry.title}</Text>
                {item.type === 'report' ? <Text style={s.sub}>{`${formatDayShort(item.date, today)} · ${executorTitle(item.executor)}`}</Text> : null}
                {entry.details.map((line) => <Text key={line} style={s.detail}>{line}</Text>)}
                <Text style={s.sub}>{[entry.actor, formatStamp(item.at)].filter(Boolean).join(', ')}</Text>
              </View>
            );
          }}
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
  hero: { alignItems: 'center', paddingBottom: 12, gap: 2, paddingHorizontal: 16 },
  heroNumber: { fontSize: 15, fontWeight: '700', color: theme.accentText },
  heroTitle: { fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' },
  loader: { marginTop: 80 },
  stub: { alignItems: 'center', gap: 12, paddingHorizontal: 32, marginTop: 60 },
  stubText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', marginTop: 40 },
  retry: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.accentSoft },
  retryText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  card: { backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: theme.text },
  detail: { fontSize: 14, color: theme.text },
  sub: { fontSize: 13, color: theme.textSecondary },
});
