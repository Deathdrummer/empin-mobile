import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const Dot = ({ color, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 260 }),
    ), -1));
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * progress.value,
    transform: [{ translateY: -2.5 * progress.value }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

/** Три бегущие точки перед «печатает…» */
export const TypingDots = ({ color }) => (
  <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Dot color={color} delay={0} />
    <Dot color={color} delay={140} />
    <Dot color={color} delay={280} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 5, height: 14 },
  dot: { width: 4.5, height: 4.5, borderRadius: 2.25 },
});
