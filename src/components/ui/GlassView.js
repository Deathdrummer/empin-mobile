import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';

// Android 12+ размывает через RenderEffect на GPU; на старых версиях размытие идёт через
// RenderScript и тормозит на слабых телефонах — там остаётся плотный полупрозрачный фон
const CAN_BLUR = Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 31);

/**
 * Полупрозрачная панель с размытием контента под ней, как у Telegram и iOS 26.
 * edge — тонкая граница со стороны контента: 'top' | 'bottom'.
 * Содержимое может выходить за край (увеличенный микрофон при записи, замок над ним) — без обрезки.
 *
 * lite — отдельный «стеклянный» элемент (кнопка, капсула): на iPhone размытие (системное, дешёвое),
 * на Android — плотный полупрозрачный фон без размытия: таких элементов на экране много,
 * а каждое размытие на Android перерисовывает всё под собой. Скругление задаётся в style.
 */
export const GlassView = ({ style, children, edge, intensity = 80, lite = false, ...rest }) => {
  const theme = useTheme();
  const border = edge
    ? { [edge === 'top' ? 'borderTopWidth' : 'borderBottomWidth']: StyleSheet.hairlineWidth, [edge === 'top' ? 'borderTopColor' : 'borderBottomColor']: theme.glassBorder }
    : null;
  // Отдельный элемент: тонкая обводка по кругу и обрезка размытия по скруглению
  const element = lite ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, overflow: 'hidden' } : null;

  if (CAN_BLUR && !(lite && Platform.OS === 'android')) {
    return (
      <BlurView
        tint={theme.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        intensity={intensity}
        experimentalBlurMethod="dimezisBlurView"
        style={[border, element, style]}
        {...rest}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.glass }, border, element, style]} {...rest}>
      {children}
    </View>
  );
};
