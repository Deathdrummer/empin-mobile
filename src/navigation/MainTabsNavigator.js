import React from 'react';
import { Platform } from 'react-native';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { useTheme } from '../theme';
import { useTotalUnread } from '../services/messengerStore';
import TimesheetScreen from '../screens/TimesheetScreen';
import { ChatsScreen, CallsScreen } from '../screens/MessengerScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createNativeBottomTabNavigator();

const TAB_ICONS = {
  timesheet: {
    ios: { default: 'calendar', focused: 'calendar' },
    android: {
      default: require('../../assets/tabs/calendar-outline.png'),
      focused: require('../../assets/tabs/calendar.png'),
    },
  },
  chats: {
    ios: { default: 'bubble.left.and.bubble.right', focused: 'bubble.left.and.bubble.right.fill' },
    android: {
      default: require('../../assets/tabs/chatbubbles-outline.png'),
      focused: require('../../assets/tabs/chatbubbles.png'),
    },
  },
  calls: {
    ios: { default: 'phone', focused: 'phone.fill' },
    android: {
      default: require('../../assets/tabs/call-outline.png'),
      focused: require('../../assets/tabs/call.png'),
    },
  },
  profile: {
    ios: { default: 'person.circle', focused: 'person.circle.fill' },
    android: {
      default: require('../../assets/tabs/person-circle-outline.png'),
      focused: require('../../assets/tabs/person-circle.png'),
    },
  },
};

const iconFor = (key) => ({ focused }) => {
  const icons = TAB_ICONS[key];
  if (Platform.OS === 'ios') {
    return { sfSymbol: focused ? icons.ios.focused : icons.ios.default };
  }
  return focused ? icons.android.focused : icons.android.default;
};

/**
 * Корневой нативный навигатор вкладок:
 * — на iOS 26 использует системный UITabBar с Liquid Glass и SF Symbols;
 * — на Android использует системный BottomNavigationView;
 * — цвета вкладок всегда нейтральные (п. 2.3), бейдж непрочитанных — акцентный (п. 2.5);
 * — «назад» на Android закрывает/сворачивает приложение, а не листает историю вкладок.
 */
export const MainTabsNavigator = ({ initialRouteName = 'Timesheet', onLogout }) => {
  const theme = useTheme();
  const unread = useTotalUnread();
  const badge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined;

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      backBehavior="none"
      hapticFeedbackEnabled
      labeled
      tabBarActiveTintColor={theme.text}
      tabBarInactiveTintColor={theme.textMuted}
      tabBarStyle={Platform.OS === 'android' ? { backgroundColor: theme.surface } : undefined}
      activeIndicatorColor={Platform.OS === 'android' ? theme.surfaceAlt : undefined}
      rippleColor={Platform.OS === 'android' ? theme.surfacePressed : undefined}
    >
      <Tab.Screen
        name="Timesheet"
        options={{
          // План-график (ТЗ, п. 6.4) — прежний «Табель»; «Табель» в ТЗ — это ТУРВ, отдельный экран
          title: 'План-график',
          tabBarLabel: 'План-график',
          tabBarIcon: iconFor('timesheet'),
        }}
        component={TimesheetScreen}
      />

      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: 'Чаты',
          tabBarLabel: 'Чаты',
          tabBarIcon: iconFor('chats'),
          tabBarBadge: badge,
          tabBarBadgeBackgroundColor: theme.accent,
          tabBarBadgeTextColor: '#FFFFFF',
        }}
      />

      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{
          title: 'Звонки',
          tabBarLabel: 'Звонки',
          tabBarIcon: iconFor('calls'),
        }}
      />

      <Tab.Screen
        name="Profile"
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: iconFor('profile'),
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};
