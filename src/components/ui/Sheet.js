import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../theme';

/**
 * Нижняя шторка со списком: заголовок, крестик, тап по затемнению закрывает.
 * keyboard — внутри есть поле ввода: шторка поднимается над клавиатурой.
 */
export const Sheet = ({ visible, onClose, title, children, keyboard = false }) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={!keyboard}
    >
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={s.root}
        enabled={keyboard && Platform.OS === 'ios'}
        behavior="padding"
      >
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.grabber} />
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={s.close} onPress={onClose} hitSlop={8} accessibilityLabel="Закрыть">
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.overlay,
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.separator,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 6,
  },
  title: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: theme.text,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.inputBackground,
  },
});
