import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { messengerAPI } from '../services/api';
import { setTotalUnread } from '../services/messengerStore';
import { getChatSounds, setChatSounds } from '../services/chatSounds';
import { pickAvatarPhoto } from '../services/profileMedia';
import { setOpenChatsOnStart } from '../services/startScreen';
import { avatarColor, palettes, setPalettePreference, setThemePreference, useTheme } from '../theme';
import { getUserFacingError } from '../utils/userFacingError';
import { Avatar } from '../components/chat/Avatar';
import { ChatBackground } from '../components/chat/ChatBackground';
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

/** Как выглядит переписка в выбранном оформлении: фон с узором и два сообщения (имя условное) */
const ThemePreview = ({ theme }) => (
  <View style={[styles.preview, { borderColor: theme.separator }]}>
    <ChatBackground />
    <View style={[styles.previewBubble, styles.previewIn, { backgroundColor: theme.bubbleIn }]}>
      <Text style={[styles.previewAuthor, { color: avatarColor(2) }]}>Иванов И.</Text>
      <Text style={[styles.previewText, { color: theme.bubbleInText }]}>Щит смонтирован, можно подключать ⚡</Text>
    </View>
    <View style={[styles.previewBubble, styles.previewOut, { backgroundColor: theme.bubbleOut }]}>
      <Text style={[styles.previewText, { color: theme.bubbleOutText }]}>Отлично, выезжаю</Text>
      <View style={styles.previewMeta}>
        <Text style={[styles.previewTime, { color: theme.bubbleOutMeta }]}>12:40</Text>
        <Ionicons name="checkmark-done" size={14} color={theme.bubbleOutAccent} />
      </View>
    </View>
  </View>
);

export default function ProfileScreen({ onLogout }) {
  const theme = useTheme();
  const tabBarHeight = useTabBarHeight();
  const [user, setUser] = useState(null);
  // null — настройки ещё не загружены (или сервер их не знает): переключатель неактивен
  const [muteObjects, setMuteObjects] = useState(null);
  const [chatSounds, setChatSoundsState] = useState(getChatSounds());
  const [openChats, setOpenChats] = useState(null);
  const [avatar, setAvatar] = useState(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const { showActionSheetWithOptions } = useActionSheet();

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((raw) => setUser(raw ? JSON.parse(raw) : null))
      .catch(() => {});
  }, []);

  // Настройка общая для всех устройств — при каждом открытии берём с сервера
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    messengerAPI.getSettings()
      .then((data) => {
        if (cancelled) return;
        setMuteObjects(Boolean(data?.mute_objects));
        setOpenChats(Boolean(data?.open_chats_on_start));
        setOpenChatsOnStart(Boolean(data?.open_chats_on_start));
        setAvatar(data?.avatar ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []));

  const nameParts = (user?.full_name || '').trim().split(/\s+/);
  const person = { sname: nameParts[0], fname: nameParts[1], avatar: avatar ?? user?.avatar };

  // Своя аватарка видна сразу и в профиле после перезапуска (до ответа сервера)
  const saveAvatar = (value) => {
    setAvatar(value);
    setUser((current) => {
      const next = current ? { ...current, avatar: value } : current;
      if (next) AsyncStorage.setItem('user', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const uploadAvatar = async (source) => {
    try {
      const uri = await pickAvatarPhoto(source);
      if (!uri) return;
      setAvatarBusy(true);
      const data = await messengerAPI.uploadAvatar(uri);
      saveAvatar(data.avatar);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось сохранить фото', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await messengerAPI.deleteAvatar();
      saveAvatar(null);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Не удалось удалить фото', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const editAvatar = () => {
    const hasPhoto = Boolean(person.avatar);
    const options = ['Выбрать из галереи', 'Сделать фото', ...(hasPhoto ? ['Удалить фото'] : []), 'Отмена'];
    showActionSheetWithOptions({
      title: 'Фото профиля',
      options,
      cancelButtonIndex: options.length - 1,
      destructiveButtonIndex: hasPhoto ? 2 : undefined,
    }, (index) => {
      if (index === 0) uploadAvatar('library');
      else if (index === 1) uploadAvatar('camera');
      else if (hasPhoto && index === 2) removeAvatar();
    });
  };

  const toggleTheme = () => setThemePreference(theme.dark ? 'light' : 'dark');

  const choosePalette = (key) => {
    if (key === theme.palette) return;
    Haptics.selectionAsync().catch(() => {});
    setPalettePreference(key);
  };

  const toggleChatSounds = (value) => {
    setChatSoundsState(value);
    setChatSounds(value);
  };

  const toggleOpenChats = async (value) => {
    setOpenChats(value);
    setOpenChatsOnStart(value);
    try {
      await messengerAPI.updateSettings({ open_chats_on_start: value });
    } catch (error) {
      setOpenChats(!value);
      setOpenChatsOnStart(!value);
      Toast.show({ type: 'error', text1: 'Не удалось сохранить', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    }
  };

  const toggleMuteObjects = async (value) => {
    setMuteObjects(value);
    try {
      const data = await messengerAPI.updateSettings({ mute_objects: value });
      setTotalUnread(data.total_unread);
    } catch (error) {
      setMuteObjects(!value);
      Toast.show({ type: 'error', text1: 'Не удалось изменить звук', text2: getUserFacingError(error, 'Попробуйте ещё раз.'), position: 'top' });
    }
  };

  const confirmLogout = () => {
    Alert.alert('Выйти из аккаунта?', 'Звонки и сообщения перестанут приходить на этот телефон.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  const currentPalette = palettes.find((item) => item.key === theme.palette) ?? palettes[0];
  const switchColors = { true: theme.accent, false: theme.separator };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? theme.background : theme.surfaceAlt }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Профиль</Text>

        <View style={[styles.card, styles.profileCard, { backgroundColor: theme.surface }]}>
          <Pressable onPress={editAvatar} disabled={avatarBusy} accessibilityRole="button" accessibilityLabel="Изменить фото профиля">
            <Avatar person={person} id={user?.staff_id} size={64} />
            <View style={[styles.avatarBadge, { backgroundColor: theme.accent, borderColor: theme.surface }]}>
              {avatarBusy ? <ActivityIndicator size="small" color={theme.onAccent} /> : <Ionicons name="camera" size={13} color={theme.onAccent} />}
            </View>
          </Pressable>
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{user?.full_name || 'Сотрудник'}</Text>
            {user?.email ? <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>{user.email}</Text> : null}
          </View>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Оформление</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.appearance}>
              <ThemePreview theme={theme} />
              <View style={styles.swatches}>
                {palettes.map((item) => {
                  const selected = item.key === currentPalette.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => choosePalette(item.key)}
                      hitSlop={4}
                      style={[styles.swatch, { borderColor: selected ? item.swatch.accent : 'transparent' }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Оформление: ${item.label}`}
                    >
                      <View style={[styles.swatchFill, { backgroundColor: item.swatch.accent }]}>
                        <View style={[styles.swatchBubble, { backgroundColor: item.swatch.bubbleOut }]} />
                        {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" style={styles.swatchCheck} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.paletteName, { color: theme.textSecondary }]}>{currentPalette.label}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.separator }]} />
            <Row
              theme={theme}
              icon={theme.dark ? 'moon' : 'sunny'}
              iconColor={theme.dark ? '#5B6B8C' : '#F2A20C'}
              title="Тёмная тема"
              onPress={toggleTheme}
              last
              accessory={(
                <Switch
                  value={theme.dark}
                  onValueChange={toggleTheme}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Тёмная тема"
                />
              )}
            />
          </View>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Уведомления</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Row
              theme={theme}
              icon="flash"
              iconColor="#C46A1B"
              title="Чаты объектов без звука"
              subtitle="Автоматически добавляемые чаты объектов — сразу без звука. Остальные чаты со звуком"
              onPress={muteObjects === null ? undefined : () => toggleMuteObjects(!muteObjects)}
              accessory={(
                <Switch
                  value={Boolean(muteObjects)}
                  disabled={muteObjects === null}
                  onValueChange={toggleMuteObjects}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Чаты объектов без звука"
                />
              )}
            />
            <Row
              theme={theme}
              icon="volume-high"
              iconColor="#2F8A6C"
              title="Звуки в чате"
              subtitle="Короткий звук, когда сообщение отправлено"
              onPress={() => toggleChatSounds(!chatSounds)}
              accessory={(
                <Switch
                  value={chatSounds}
                  onValueChange={toggleChatSounds}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Звуки в чате"
                />
              )}
            />
            <Row
              theme={theme}
              icon="notifications"
              iconColor={theme.accent}
              title="Уведомления телефона"
              subtitle="Звонки и сообщения — в настройках телефона"
              onPress={() => Linking.openSettings()}
              last
            />
          </View>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Общие</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Row
              theme={theme}
              icon="chatbubbles"
              iconColor="#1F7FA8"
              title="При открытии показывать чаты"
              subtitle="Иначе приложение открывается на табеле"
              onPress={openChats === null ? undefined : () => toggleOpenChats(!openChats)}
              last
              accessory={(
                <Switch
                  value={Boolean(openChats)}
                  disabled={openChats === null}
                  onValueChange={toggleOpenChats}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="При открытии показывать чаты"
                />
              )}
            />
          </View>
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
  content: { padding: 16, gap: 18 },
  title: { fontSize: 30, fontWeight: '700', marginTop: -4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  profileText: { flex: 1 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 19, fontWeight: '600' },
  email: { fontSize: 14, marginTop: 3 },
  appearance: { padding: 12, gap: 14 },
  preview: { height: 150, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  previewBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  previewIn: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  previewOut: { alignSelf: 'flex-end', borderBottomRightRadius: 5, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  previewAuthor: { fontSize: 12, fontWeight: '600', marginBottom: 1 },
  previewText: { fontSize: 14, lineHeight: 19 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  previewTime: { fontSize: 11 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  swatch: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, padding: 3 },
  swatchFill: { flex: 1, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  // Уголок цвета «своего» сообщения — видно, как оформление выглядит в переписке
  swatchBubble: { position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: 11 },
  swatchCheck: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 2 },
  paletteName: { textAlign: 'center', fontSize: 13, marginTop: -4 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingVertical: 12, paddingRight: 14, minHeight: 52, gap: 10 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 8 },
});
