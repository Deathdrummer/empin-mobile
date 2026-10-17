import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

/**
 * Фон переписки с лёгким узором на тему электромонтажа: молния, вилка, лампа, ключ, розетка, провод.
 * Узор бледный и не мешает читать; цвет — из темы.
 */
const ChatBackgroundComponent = () => {
  const theme = useTheme();
  const stroke = theme.pattern;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="doodles" patternUnits="userSpaceOnUse" width="168" height="168">
            <G fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* Молния */}
              <Path d="M24 14 L15 32 H24 L19 48 L34 26 H25 L30 14 Z" />
              {/* Лампа */}
              <Path d="M110 18 a12 12 0 0 1 8 21 v6 h-16 v-6 a12 12 0 0 1 8 -21 z" />
              <Path d="M104 50 h12 M106 55 h8" />
              {/* Вилка */}
              <Path d="M60 92 h22 v12 a11 11 0 0 1 -22 0 z M66 92 v-9 M76 92 v-9 M71 115 v14" />
              {/* Розетка */}
              <Circle cx="140" cy="104" r="15" />
              <Circle cx="134" cy="104" r="2.2" />
              <Circle cx="146" cy="104" r="2.2" />
              {/* Ключ */}
              <Path d="M18 132 l22 -22 M44 104 a8 8 0 1 1 -6 14 l-4 -4 a8 8 0 0 1 10 -10 z" />
              {/* Провод */}
              <Path d="M92 150 c10 -14 22 6 32 -8 s20 6 30 -6" />
              {/* Искры */}
              <Path d="M62 30 l4 4 M70 26 v6 M78 30 l-4 4" />
              <Circle cx="150" cy="60" r="2.5" />
              <Circle cx="40" cy="78" r="2" />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={theme.chatBackground} />
        <Rect width="100%" height="100%" fill="url(#doodles)" />
      </Svg>
    </View>
  );
};

export const ChatBackground = memo(ChatBackgroundComponent);
