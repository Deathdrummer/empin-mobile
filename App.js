import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import LoginScreen from './src/screens/LoginScreen';
import TimesheetScreen from './src/screens/TimesheetScreen';
import { setUnauthorizedCallback } from './src/services/api';
import { useAppStatePermissions } from './src/hooks/useAppStatePermissions';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Автоматическое обновление прав при возврате в приложение
  useAppStatePermissions();

  useEffect(() => {
    checkAuth();

    // Устанавливаем callback для принудительного выхода при 401
    setUnauthorizedCallback(() => {
      setIsLoggedIn(false);
    });
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Token from storage:', token);
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
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
      console.error('Ошибка при выходе:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9588a5" />
      </View>
    );
  }

  return (
    <View style={styles.appContainer}>
      {isLoggedIn ? (
        <TimesheetScreen onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      <StatusBar hidden={true} /* style="auto" */ />
      <Toast />
    </View>
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
