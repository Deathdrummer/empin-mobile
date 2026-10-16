import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemedStyles } from '../../theme';

/**
 * Диалог по центру экрана в стиле приложения: заголовок, текст, содержимое и кнопки.
 * keyboard — окно с полем ввода: поднимается над клавиатурой (и не перекрывает строку состояния на Android).
 */
export const Dialog = ({ visible, onClose, icon, title, message, children, buttons, keyboard = false, wide = false }) => {
  const s = useThemedStyles(makeStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={!keyboard}
    >
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={s.overlay}
        enabled={keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[s.card, wide && s.cardWide]}>
          {icon ? <View style={s.icon}>{icon}</View> : null}
          {title ? <Text style={s.title}>{title}</Text> : null}
          {message ? <Text style={s.message}>{message}</Text> : null}
          {children}
          {buttons ? <View style={s.buttons}>{buttons}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Кнопка диалога: secondary — нейтральная, primary — акцентная, danger — удаление */
export const DialogButton = ({ title, onPress, variant = 'secondary', disabled = false, loading = false }) => {
  const s = useThemedStyles(makeStyles);
  const textStyle = variant === 'secondary' ? s.secondaryText : s.filledText;
  return (
    <TouchableOpacity
      style={[s.button, s[variant], disabled && !loading && s.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={textStyle.color} />
      ) : (
        <Text style={[s.buttonText, textStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.overlay,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.sheet,
    borderRadius: 20,
    padding: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: theme.dark ? 0.5 : 0.2,
    shadowRadius: 20,
  },
  cardWide: {
    maxWidth: 520,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: theme.inputBackground,
  },
  primary: {
    backgroundColor: theme.accent,
  },
  danger: {
    backgroundColor: theme.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: theme.text,
  },
  filledText: {
    color: theme.onAccent,
  },
});
