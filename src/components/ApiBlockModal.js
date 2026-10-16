import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dialog, DialogButton } from './ui/Dialog';
import { useTheme } from '../theme';

/**
 * Модальное окно блокировки приложения при недоступности API
 */
export const ApiBlockModal = ({ visible, onRetry }) => {
  const theme = useTheme();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <Dialog
      visible={visible}
      // Окно не закрывается, пока сервер недоступен
      onClose={() => {}}
      title="Нет связи с сервером"
      message="Проверьте подключение к интернету и попробуйте ещё раз."
      icon={(
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="cloud-offline-outline" size={34} color={theme.accent} />
        </View>
      )}
      buttons={<DialogButton title="Повторить" variant="primary" onPress={handleRetry} loading={retrying} />}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
