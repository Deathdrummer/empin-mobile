import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

// Окружность одним контуром — все значки узора собраны из Path
const circle = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;

// Шестерёнка: зубья-трапеции по окружности
const gear = (cx, cy, outer, inner, teeth) => {
  const step = (Math.PI * 2) / teeth;
  const point = (r, angle) => `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
  const points = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const start = tooth * step;
    points.push(point(inner, start), point(outer, start + step * 0.14), point(outer, start + step * 0.4), point(inner, start + step * 0.54));
  }
  return `M${points.join(' L')} Z`;
};

/**
 * Значки электромонтажа в сетке 24×24 (как у иконок): каждый — набор контуров.
 */
const ICONS = {
  bolt: ['M13.2 2 L4.5 13.6 H11.2 L10.2 22 L19.5 9.8 H12.8 Z'],
  bulb: [
    'M12 2.6 a6.4 6.4 0 0 0 -3.9 11.5 c0.6 0.5 0.9 1.2 0.9 2 V17 h6 v-0.9 c0 -0.8 0.3 -1.5 0.9 -2 A6.4 6.4 0 0 0 12 2.6 Z',
    'M9.2 19.2 h5.6 M9.9 21.4 h4.2',
    'M10.4 13.4 l0.8 -3.4 l0.8 1.6 l0.8 -1.6 l0.8 3.4',
  ],
  plug: [
    'M6.5 8.5 h11 v4.2 a5.5 5.5 0 0 1 -11 0 Z',
    'M9.5 8.5 V3.5 M14.5 8.5 V3.5',
    'M12 18.2 v1.6 c0 1.4 0.9 2.2 2.4 2.2 h3',
  ],
  socket: [
    'M5.5 3.5 h13 a2 2 0 0 1 2 2 v13 a2 2 0 0 1 -2 2 h-13 a2 2 0 0 1 -2 -2 v-13 a2 2 0 0 1 2 -2 Z',
    circle(12, 12, 5.4),
    circle(9.8, 12, 0.9),
    circle(14.2, 12, 0.9),
    'M12 6.6 v1.2 M12 16.2 v1.2',
  ],
  wrench: ['M14.8 6.2 a4.2 4.2 0 0 0 -5.6 5.4 L3.6 17.2 a1.9 1.9 0 0 0 2.7 2.7 l5.6 -5.6 a4.2 4.2 0 0 0 5.4 -5.6 l-2.7 2.7 l-2.5 -0.6 l-0.6 -2.5 Z'],
  screwdriver: [
    'M14.6 3.6 l5.8 5.8 a1.4 1.4 0 0 1 0 2 l-2.4 2.4 a1.4 1.4 0 0 1 -2 0 l-5.8 -5.8 a1.4 1.4 0 0 1 0 -2 l2.4 -2.4 a1.4 1.4 0 0 1 2 0 Z',
    'M16.4 6.2 l2.2 2.2',
    'M11.4 12.6 L4.2 19.8 M3.4 20.6 l0.8 -0.8',
  ],
  pliers: [
    'M9.3 2.8 l2.7 6.4 l2.7 -6.4',
    circle(12, 10.6, 1.6),
    'M10.9 11.9 c-1 2.6 -2.2 5.6 -3.3 9.3 M13.1 11.9 c1 2.6 2.2 5.6 3.3 9.3',
  ],
  helmet: [
    'M4.8 15.2 a7.2 7.2 0 0 1 14.4 0',
    'M3 15.2 h18 a1.1 1.1 0 0 1 0 2.2 h-18 a1.1 1.1 0 0 1 0 -2.2 Z',
    'M10.2 8.4 v4 M13.8 8.4 v4',
  ],
  pylon: [
    'M12 2.2 L6.6 21.8 M12 2.2 L17.4 21.8',
    'M3.6 6.8 h16.8 M5.8 11 h12.4',
    'M8.2 6.8 l7.4 4.2 M15.8 6.8 l-7.4 4.2',
    'M8.6 15.6 h6.8 M8.6 15.6 l7.8 6.2 M15.4 15.6 l-7.8 6.2',
    'M3.6 6.8 v2.4 M20.4 6.8 v2.4',
  ],
  transformer: [circle(9.4, 12, 4.6), circle(14.6, 12, 4.6), 'M1.8 12 h3 M19.2 12 h3'],
  resistor: ['M1.6 12 h4 l1.5 -3.2 l3 6.4 l3 -6.4 l3 6.4 l1.5 -3.2 h4.8'],
  ground: ['M12 3 v8 M5 11 h14 M7.6 14.6 h8.8 M10.2 18.2 h3.6'],
  capacitor: ['M2 12 h7.6 M9.6 5.6 v12.8 M14.4 5.6 v12.8 M14.4 12 h7.6'],
  battery: [
    'M3.4 7.6 h15.2 a1 1 0 0 1 1 1 v6.8 a1 1 0 0 1 -1 1 h-15.2 a1 1 0 0 1 -1 -1 v-6.8 a1 1 0 0 1 1 -1 Z',
    'M19.6 10.4 h1.6 v3.2 h-1.6',
    'M6.2 12 h3.4 M7.9 10.3 v3.4 M13 12 h3.4',
  ],
  meter: [
    'M6.4 2.4 h11.2 a1.6 1.6 0 0 1 1.6 1.6 v16 a1.6 1.6 0 0 1 -1.6 1.6 h-11.2 a1.6 1.6 0 0 1 -1.6 -1.6 v-16 a1.6 1.6 0 0 1 1.6 -1.6 Z',
    'M7.6 5 h8.8 v4.4 h-8.8 Z',
    circle(12, 15.2, 3),
    'M12 15.2 l1.9 -1.9',
    'M9.6 7.2 h2.4',
  ],
  reel: [
    circle(11, 12, 8.4),
    circle(11, 12, 2.8),
    'M5.4 7.6 a7.2 7.2 0 0 1 4.4 -3.4',
    'M19.4 12 c0 4.4 1.2 7.4 3.2 9.4',
  ],
  danger: [
    'M12 2.6 L21.8 19.8 a0.8 0.8 0 0 1 -0.7 1.2 H2.9 a0.8 0.8 0 0 1 -0.7 -1.2 Z',
    'M12.8 8.4 L9.8 13.8 h3 l-1.4 4.4 l3.8 -5.8 h-3 Z',
  ],
  switch: [
    'M6 3 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 v-14 a2 2 0 0 1 2 -2 Z',
    'M9.2 7 h5.6 v10 h-5.6 Z',
    'M9.2 12 h5.6',
  ],
  gear: [gear(12, 12, 9.4, 7, 8), circle(12, 12, 3)],
  circuit: [
    'M3 6 h6 l4 4 h8 M3 18 h8 l3 -3 h7',
    circle(3, 6, 1.4), circle(21, 10, 1.4), circle(3, 18, 1.4), circle(21, 15, 1.4),
  ],
  lamp: ['M12 2 v5.4', 'M5.6 14 a6.4 6.4 0 0 1 12.8 0 Z', 'M10 16.6 a2 2 0 0 0 4 0', 'M6.2 19.6 l-1.4 1.4 M17.8 19.6 l1.4 1.4'],
  ladder: ['M8 2 v20 M16 2 v20', 'M8 6 h8 M8 10 h8 M8 14 h8 M8 18 h8'],
  wire: ['M1.6 12 c1.8 -5 3.6 -5 5.2 0 s3.4 5 5.2 0 s3.4 -5 5.2 0 s3.4 5 5.2 0'],
  spark: ['M12 4.4 v4.4 M12 15.2 v4.4 M4.4 12 h4.4 M15.2 12 h4.4 M6.8 6.8 l2.2 2.2 M15 15 l2.2 2.2 M6.8 17.2 l2.2 -2.2 M15 9 l2.2 -2.2'],
  plus: ['M12 8.6 v6.8 M8.6 12 h6.8'],
  dot: [circle(12, 12, 1.8)],
  ring: [circle(12, 12, 3.4)],
};

/**
 * Раскладка плитки 360×360: значок, центр, поворот, масштаб. Соседние ряды сдвинуты,
 * мелкие точки и искры заполняют промежутки — узор плотный, но ровный.
 */
const TILE = 360;
const LAYOUT = [
  ['bolt', 30, 32, -14, 1.69], ['meter', 92, 28, 10, 1.44], ['ring', 128, 70, 0, 0.8], ['danger', 152, 34, -6, 1.63],
  ['plug', 214, 30, 18, 1.56], ['spark', 252, 72, 0, 0.75], ['socket', 276, 32, -10, 1.5], ['dot', 330, 24, 0, 0.8],
  ['resistor', 334, 64, 28, 1.31],
  ['wire', 60, 90, -8, 1.63], ['bulb', 120, 112, 12, 1.75], ['plus', 176, 90, 0, 0.8], ['pylon', 212, 110, -4, 1.81],
  ['capacitor', 270, 104, -22, 1.31], ['helmet', 322, 118, 8, 1.63], ['dot', 22, 128, 0, 0.8],
  ['reel', 36, 170, 6, 1.56], ['ring', 84, 156, 0, 0.7], ['wrench', 96, 196, -30, 1.56], ['switch', 160, 168, 8, 1.44],
  ['spark', 196, 204, 0, 0.7], ['transformer', 254, 168, -10, 1.44], ['bolt', 312, 178, 22, 1.38], ['plus', 348, 210, 0, 0.75],
  ['ground', 24, 238, -8, 1.44], ['lamp', 74, 264, 10, 1.63], ['circuit', 140, 238, -6, 1.63], ['dot', 186, 270, 0, 0.8],
  ['screwdriver', 222, 244, -12, 1.56], ['gear', 286, 246, 14, 1.44], ['ring', 334, 270, 0, 0.75],
  ['battery', 28, 318, 16, 1.44], ['plus', 112, 312, 0, 0.8], ['pliers', 150, 316, -18, 1.56], ['ladder', 210, 316, 10, 1.38],
  ['bulb', 266, 318, -14, 1.31], ['spark', 70, 342, 0, 0.65], ['danger', 322, 326, 12, 1.31],
];

const STROKE = 1.35;

/**
 * Фон переписки с узором на тему электромонтажа. Цвет фона и узора — из выбранного оформления;
 * узор бледный и не мешает читать.
 */
const ChatBackgroundComponent = () => {
  const theme = useTheme();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="doodles" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            <G fill="none" stroke={theme.pattern} strokeLinecap="round" strokeLinejoin="round">
              {LAYOUT.map(([name, x, y, rotate, scale], index) => (
                <G
                  key={index}
                  // Толщина линий одинаковая при любом масштабе значка
                  strokeWidth={STROKE / scale}
                  transform={`translate(${x}, ${y}) rotate(${rotate}) scale(${scale}) translate(-12, -12)`}
                >
                  {ICONS[name].map((d, part) => <Path key={part} d={d} />)}
                </G>
              ))}
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
