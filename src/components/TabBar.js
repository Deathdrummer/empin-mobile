import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { useTotalUnread } from '../services/messengerStore';
import { GlassView } from './ui/GlassView';

const TABS = [
  { key: 'timesheet', label: 'Табель', icon: 'calendar', route: 'Timesheet' },
  { key: 'chats', label: 'Чаты', icon: 'chatbubbles', route: 'Messenger', params: { tab: 'chats' } },
  { key: 'calls', label: 'Звонки', icon: 'call', route: 'Messenger', params: { tab: 'calls' } },
  { key: 'profile', label: 'Профиль', icon: 'person-circle', route: 'Profile' },
];

const BAR_HEIGHT = 62;
const MIN_BOTTOM_GAP = 8;

/** Отступ капсулы снизу: над системными кнопками Android и полоской «домой» iPhone */
const bottomGap = (insets) => Math.max(insets.bottom, MIN_BOTTOM_GAP);

/** Высота панели вкладок: контент экрана прокручивается под ней, отступ снизу — на эту высоту */
export const useTabBarHeight = () => {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + bottomGap(insets);
};

/**
 * Нижние вкладки приложения — плавающая полупрозрачная капсула поверх контента, как в Telegram.
 * Системные кнопки Android и полоска «домой» iPhone всегда ниже неё.
 * Переключение заменяет экран (как вкладки мессенджеров):
 * «назад» на Android с главного экрана закрывает приложение, а не листает историю вкладок.
 */
export const TabBar = ({ active }) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const unread = useTotalUnread();

  const open = (tab) => {
    if (tab.key === active) return;
    Haptics.selectionAsync().catch(() => {});
    if (tab.route === route.name) {
      navigation.setParams(tab.params ?? {});
    } else {
      navigation.replace(tab.route, tab.params);
    }
  };

  return (
    <GlassView lite style={[styles.bar, { bottom: bottomGap(insets) }]}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? theme.accent : theme.textMuted;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, selected && { backgroundColor: theme.surfacePressed }]}
            onPress={() => open(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.key === 'chats' && unread ? `${tab.label}, непрочитанных ${unread}` : tab.label}
          >
            <View>
              <Ionicons name={selected ? tab.icon : `${tab.icon}-outline`} size={25} color={color} />
              {tab.key === 'chats' && unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.surface }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </GlassView>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: (BAR_HEIGHT - 8) / 2 },
  label: { fontSize: 11, fontWeight: '500' },
  labelSelected: { fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
