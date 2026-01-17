import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import TimesheetScreen from './src/screens/TimesheetScreen';
import { setUnauthorizedCallback, checkApiAvailability } from './src/services/api';
import { useAppStatePermissions } from './src/hooks/useAppStatePermissions';
import apiBlockEmitter from './src/utils/apiBlockEmitter';
import { ApiBlockModal } from './src/components/ApiBlockModal';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isApiBlocked, setIsApiBlocked] = useState(false);

  // Автоматическое обновление прав при возврате в приложение
  useAppStatePermissions();

  useEffect(() => {
    checkAuth();

    // Устанавливаем callback для принудительного выхода при 401
    setUnauthorizedCallback(() => {
      setIsLoggedIn(false);
    });

    // Подписываемся на события блокировки API
    const unsubscribe = apiBlockEmitter.subscribe((isBlocked) => {
      setIsApiBlocked(isBlocked);
    });

    return unsubscribe;
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
    } catch (error) {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      setIsLoggedIn(false);
    } catch (error) {
      // Игнорируем ошибку
    }
  };

  const handleRetryApi = async () => {
    await checkApiAvailability();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9588a5" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.appContainer}>
      <ActionSheetProvider>
        <>
          <StatusBar hidden={true} />
          <View style={styles.appContainer}>
            {isLoggedIn ? (
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Timesheet">
                    {props => <TimesheetScreen {...props} onLogout={handleLogout} />}
                  </Stack.Screen>
                </Stack.Navigator>
              </NavigationContainer>
            ) : (
              <LoginScreen onLoginSuccess={handleLoginSuccess} />
            )}
            <Toast />
            <ApiBlockModal visible={isApiBlocked} onRetry={handleRetryApi} />
          </View>
        </>
      </ActionSheetProvider>
    </GestureHandlerRootView>
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
    backgroundColor: '#f3eff6',
  },
});
