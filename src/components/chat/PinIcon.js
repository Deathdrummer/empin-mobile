import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Кнопка наклонена, как в Telegram: шляпка справа вверху, игла влево вниз
const TILT = { transform: [{ rotate: '45deg' }] };

/**
 * Значок закрепления — канцелярская кнопка, как в Telegram.
 * variant: 'pin' — закреплено / «Закрепить», 'outline' — контур, 'off' — «Открепить».
 */
export const PinIcon = ({ variant = 'pin', size = 18, color, style }) => {
  const name = { pin: 'pin', outline: 'pin-outline', off: 'pin-off-outline' }[variant] ?? 'pin';
  return <MaterialCommunityIcons name={name} size={size} color={color} style={[TILT, style]} />;
};
