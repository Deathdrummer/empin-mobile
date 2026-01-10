import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { authAPI } from '../services/api';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Валидация полей
    if (!email || !password) {
      if (!email) setEmailError(true);
      if (!password) setPasswordError(true);

      Toast.show({
        type: 'error',
        text1: 'Ошибка',
        text2: 'Заполните все поля',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.login(email, password);

      // Проверяем, что токен действительно сохранен
      if (data.token) {
        // authAPI.login уже включает задержку для сохранения
        onLoginSuccess(data.user);
        setLoading(false);
      } else {
        throw new Error('Токен не получен от сервера');
      }
    } catch (error) {
      setLoading(false);

      // Подсвечиваем оба поля красным при ошибке авторизации (только если они еще не красные)
      if (!emailError) setEmailError(true);
      if (!passwordError) setPasswordError(true);

      // Определяем тип ошибки
      let errorMessage = 'Неверный логин или пароль';

      if (error.response) {
        // Ошибка от сервера
        if (error.response.status === 422) {
          // Ошибка валидации
          errorMessage = error.response.data?.message || 'Неверные данные для входа';
        } else if (error.response.status === 401) {
          errorMessage = 'Неверный логин или пароль';
        } else {
          errorMessage = error.response.data?.message || 'Ошибка сервера';
        }
      } else if (error.request) {
        // Запрос был отправлен, но ответа не было
        errorMessage = 'Нет связи с сервером';
      } else {
        // Ошибка при настройке запроса
        errorMessage = error.message || 'Неизвестная ошибка';
      }

      Toast.show({
        type: 'error',
        text1: 'Ошибка авторизации',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>план-график работ</Text>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              { borderColor: emailError ? '#ff4444' : '#e2dde7' },
            ]}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError(false);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { borderColor: passwordError ? '#ff4444' : '#e2dde7' },
              ]}
              placeholder="Пароль"
              placeholderTextColor="#999"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(false);
              }}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#999"
              />
            </TouchableOpacity>
          </View>

          <TouchableHighlight
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            underlayColor="#7a7a7a"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Войти</Text>
              </View>
            )}
          </TouchableHighlight>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logo: {
    width: '100%',
    height: 80,
    marginBottom: 25,
  },
  subtitle: {
    fontSize: 24,
    color: '#555',
    textAlign: 'center',
    marginBottom: 50,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 2,
    color: '#000',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 0,
    marginTop: 12,
    padding: 5,
  },
  button: {
    backgroundColor: '#999999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonIcon: {
    marginTop: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
