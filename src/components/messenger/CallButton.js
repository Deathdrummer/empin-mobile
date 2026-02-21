import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Кнопка инициации звонка
 * @param {number} userId - ID пользователя для звонка
 * @param {Function} onPress - Callback при нажатии
 */
export const CallButton = ({ userId, onPress }) => {
  const handlePress = () => {
    if (onPress) {
      onPress(userId);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      <MaterialIcons name="phone" size={24} color="#10B981" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
