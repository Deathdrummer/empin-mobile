import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';

/**
 * Полупрозрачная панель: на iOS — системное размытие, как у Telegram и iOS 26,
 * на Android — полупрозрачный фон (размытие там тяжёлое для слабых телефонов).
 * edge — тонкая граница со стороны контента: 'top' | 'bottom'.
 */
export const GlassView = ({ style, children, edge, intensity = 80, ...rest }) => {
  const theme = useTheme();
  const border = edge
    ? { [edge === 'top' ? 'borderTopWidth' : 'borderBottomWidth']: StyleSheet.hairlineWidth, [edge === 'top' ? 'borderTopColor' : 'borderBottomColor']: theme.glassBorder }
    : null;

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        tint={theme.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={intensity}
        style={[styles.ios, border, style]}
        {...rest}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.glass }, border, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  ios: { overflow: 'hidden' },
});
