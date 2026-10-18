import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Копии эмодзи разлетаются веером вверх, как у реакций в Telegram
const PARTICLE_ANGLES = [-160, -125, -90, -55, -20];
const PARTICLE_DISTANCE = 44;

const Particle = ({ emoji, angle, progress }) => {
  const style = useAnimatedStyle(() => {
    const radians = (angle * Math.PI) / 180;
    const distance = PARTICLE_DISTANCE * progress.value;
    return {
      opacity: progress.value < 0.2 ? progress.value * 5 : 1 - progress.value,
      transform: [
        { translateX: Math.cos(radians) * distance },
        { translateY: Math.sin(radians) * distance },
        { scale: 0.45 + 0.25 * (1 - progress.value) },
      ],
    };
  });

  return <Animated.Text style={[styles.particle, style]}>{emoji}</Animated.Text>;
};

/**
 * Реакция только что поставлена: эмодзи крупно «выпрыгивает» над сообщением и тает,
 * несколько маленьких копий разлетаются. Перезапуск — новый key.
 */
export const ReactionBurst = ({ emoji, alignRight }) => {
  const scale = useSharedValue(0.3);
  const lift = useSharedValue(0);
  const opacity = useSharedValue(1);
  const spread = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(withSpring(1.7, { damping: 8, stiffness: 220 }), withTiming(1.2, { duration: 280 }));
    lift.value = withTiming(-30, { duration: 900, easing: Easing.out(Easing.cubic) });
    opacity.value = withDelay(560, withTiming(0, { duration: 340 }));
    spread.value = withDelay(80, withTiming(1, { duration: 760, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mainStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  return (
    <View pointerEvents="none" style={[styles.anchor, alignRight ? styles.anchorRight : styles.anchorLeft]}>
      {PARTICLE_ANGLES.map((angle) => <Particle key={angle} emoji={emoji} angle={angle} progress={spread} />)}
      <Animated.Text style={[styles.main, mainStyle]}>{emoji}</Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  anchor: { position: 'absolute', bottom: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  anchorRight: { right: 18 },
  anchorLeft: { left: 18 },
  main: { fontSize: 26 },
  particle: { position: 'absolute', fontSize: 22 },
});
