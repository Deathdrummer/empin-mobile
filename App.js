import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import TimesheetScreen from './src/screens/TimesheetScreen';
import MessengerScreen from './src/screens/MessengerScreen';
import ChatScreen from './src/screens/Messenger/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChatInfoScreen from './src/screens/Messenger/ChatInfoScreen';
import { clearDrafts, DRAFTS_STORAGE_KEY } from './src/services/drafts';
import { authAPI, setUnauthorizedCallback, checkApiAvailability } from './src/services/api';
import { disconnectPusher } from './src/services/pusher';
import { useAppStatePermissions } from './src/hooks/useAppStatePermissions';
import { requestCallPermissions } from './src/utils/requestCallPermissions';
import apiBlockEmitter from './src/utils/apiBlockEmitter';
import { ApiBlockModal } from './src/components/ApiBlockModal';
import { CallProvider } from './src/contexts/CallContext';
import { useMessengerSync } from './src/hooks/useMessengerSync';
import { navigationRef } from './src/services/navigationRef';
import { GlobalCallModal } from './src/components/messenger/GlobalCallModal';
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from './src/services/pushNotifications';
import { disableIosVoip, unregisterIosVoipToken } from './src/services/iosVoip';
import { useTheme } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isApiBlocked, setIsApiBlocked] = useState(false);
  const theme = useTheme();

  // Фон и цвета навигации из темы: без белых вспышек при переходах в тёмной теме
  const navigationTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.accent,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.separator,
        notification: theme.accent,
      },
    };
  }, [theme]);

  // Автоматическое обновление прав при возврате в приложение
  useAppStatePermissions();
  // Непрочитанные сообщения и открытие чата по уведомлению
  useMessengerSync(isLoggedIn);

  const clearSession = useCallback(async ({ notifyServer = false } = {}) => {
    try {
      if (notifyServer) {
        await Promise.allSettled([
          unregisterPushNotifications(),
          unregisterIosVoipToken(),
        ]);
        await authAPI.logout();
      }
    } finally {
      await Promise.allSettled([
        disconnectPusher(),
        disableIosVoip(),
        AsyncStorage.multiRemove(['token', 'user', 'permissions', '@pendingCall', DRAFTS_STORAGE_KEY]),
      ]);
      clearDrafts();
      setIsLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
    requestCallPermissions();
  }, []);

  useEffect(() => {
    checkAuth();

    // Устанавливаем callback для принудительного выхода при 401
    setUnauthorizedCallback(() => clearSession());

    // Подписываемся на события блокировки API
    const unsubscribe = apiBlockEmitter.subscribe((isBlocked) => {
      setIsApiBlocked(isBlocked);
    });

    return () => {
      setUnauthorizedCallback(null);
      unsubscribe();
    };
  }, [clearSession]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const loggedIn = !!token;
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        registerPushNotifications();
      }
    } catch (error) {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    registerPushNotifications();
  };

  const handleLogout = async () => {
    await clearSession({ notifyServer: true });
  };

  const handleRetryApi = async () => {
    await checkApiAvailability();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.appContainer}>
        <ActionSheetProvider>
          <CallProvider isLoggedIn={isLoggedIn}>
            <>
              <StatusBar hidden={true} />
              <View style={[styles.appContainer, { backgroundColor: theme.background }]}>
                {isLoggedIn ? (
                  <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                    <Stack.Navigator screenOptions={{ headerShown: false }}>
                      {/* Вкладки переключаются без анимации, как в мессенджерах */}
                      <Stack.Screen name="Timesheet" options={{ animation: 'none' }}>
                        {props => <TimesheetScreen {...props} onLogout={handleLogout} />}
                      </Stack.Screen>
                      <Stack.Screen name="Messenger" options={{ animation: 'none' }}>
                        {props => <MessengerScreen {...props} onLogout={handleLogout} />}
                      </Stack.Screen>
                      <Stack.Screen name="Profile" options={{ animation: 'none' }}>
                        {props => <ProfileScreen {...props} onLogout={handleLogout} />}
                      </Stack.Screen>
                      <Stack.Screen name="Chat">
                        {props => <ChatScreen {...props} onLogout={handleLogout} />}
                      </Stack.Screen>
                      <Stack.Screen name="ChatInfo" component={ChatInfoScreen} />
                    </Stack.Navigator>
                  </NavigationContainer>
                ) : (
                  <LoginScreen onLoginSuccess={handleLoginSuccess} />
                )}
                <Toast />
                <ApiBlockModal visible={isApiBlocked} onRetry={handleRetryApi} />
                {isLoggedIn && <GlobalCallModal />}
              </View>
            </>
          </CallProvider>
        </ActionSheetProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
