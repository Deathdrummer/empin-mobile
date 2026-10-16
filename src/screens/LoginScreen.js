import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { authAPI } from '../services/api';
import { getUserFacingError } from '../utils/userFacingError';
import { useTheme, useThemedStyles } from '../theme';

export default function LoginScreen({ onLoginSuccess }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Пробелы по краям адреса — частый след автоподстановки; пароль не трогаем: пробел может быть его частью
    const trimmedEmail = email.trim();

    // Валидация полей
    if (!trimmedEmail || !password) {
      if (!trimmedEmail) setEmailError(true);
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
      const data = await authAPI.login(trimmedEmail, password);

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

      const errorMessage = error.response?.status === 401
        ? 'Неверный логин или пароль'
        : getUserFacingError(error, 'Не удалось войти. Попробуйте ещё раз.');

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
        <View style={styles.brand}>
          <Image
            source={require('../../assets/logo-mark.png')}
            style={styles.logo}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.title}>Эмпин PRO</Text>
          <Text style={styles.subtitle}>План-график работ, чаты и звонки</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.field, emailError && styles.fieldError]}>
            <Ionicons name="mail-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={[styles.field, passwordError && styles.fieldError]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(false);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
              hitSlop={8}
              accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    gap: 12,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: theme.inputBackground,
  },
  fieldError: {
    borderColor: theme.danger,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.onAccent,
    fontSize: 17,
    fontWeight: '700',
  },
});
