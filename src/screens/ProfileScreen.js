import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { setThemePreference, useTheme } from '../theme';
import { Avatar } from '../components/chat/Avatar';
import { TabBar, useTabBarHeight } from '../components/TabBar';

const Row = ({ theme, icon, iconColor, title, subtitle, destructive, onPress, last, accessory }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfacePressed }]}
    accessibilityRole="button"
  >
    <View style={[styles.rowIcon, { backgroundColor: iconColor }]}>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </View>
    <View style={[styles.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: destructive ? theme.danger : theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {accessory ?? (!destructive ? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} /> : null)}
    </View>
  </Pressable>
);

export default function ProfileScreen({ onLogout }) {
  const theme = useTheme();
  const tabBarHeight = useTabBarHeight();
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => setUser(raw ? JSON.parse(raw) : null))
      .catch(() => {});
  }, []);

  const nameParts = (user?.full_name || '').trim().split(/\s+/);
  const person = { sname: nameParts[0], fname: nameParts[1] };

  const toggleTheme = () => setThemePreference(theme.dark ? 'light' : 'dark');

  const confirmLogout = () => {
    Alert.alert('Выйти из аккаунта?', 'Звонки и сообщения перестанут приходить на этот телефон.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? theme.background : theme.surfaceAlt }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Профиль</Text>

        <View style={[styles.card, styles.profileCard, { backgroundColor: theme.surface }]}>
          <Avatar person={person} id={user?.staff_id} size={64} />
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{user?.full_name || 'Сотрудник'}</Text>
            {user?.email ? <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>{user.email}</Text> : null}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Row
            theme={theme}
            icon={theme.dark ? 'moon' : 'sunny'}
            iconColor={theme.dark ? '#5B6B8C' : '#F2A20C'}
            title="Тёмная тема"
            onPress={toggleTheme}
            accessory={(
              <Switch
                value={theme.dark}
                onValueChange={toggleTheme}
                trackColor={{ true: theme.accent, false: theme.separator }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Тёмная тема"
              />
            )}
          />
          <Row
            theme={theme}
            icon="notifications"
            iconColor={theme.accent}
            title="Уведомления"
            subtitle="Звонки и сообщения — в настройках телефона"
            onPress={() => Linking.openSettings()}
            last
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Row theme={theme} icon="log-out-outline" iconColor="#8A8D94" title="Выйти" destructive onPress={confirmLogout} last />
        </View>

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Эмпин PRO · версия {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>
      <TabBar active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 30, fontWeight: '700', marginTop: -4 },
  card: { borderRadius: 14, overflow: 'hidden' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  profileText: { flex: 1 },
  name: { fontSize: 19, fontWeight: '600' },
  email: { fontSize: 14, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingVertical: 12, paddingRight: 14, minHeight: 52 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 8 },
});
