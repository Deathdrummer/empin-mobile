import React, { useRef } from 'react';
import { View } from 'react-native';
import { useSwipeControl } from '../contexts/SwipeControlContext';

/**
 * HOC компонент для автоматической блокировки свайпа
 * при взаимодействии с элементами внутри
 *
 * Использование:
 * <SwipeBlocker>
 *   <YourInteractiveComponent />
 * </SwipeBlocker>
 */
export const SwipeBlocker = ({ children, style, disabled = false }) => {
  const { disableSwipe, enableSwipe, flatListRef } = useSwipeControl();
  const isBlockingRef = useRef(false);

  // НЕ используем Capture - это блокирует вертикальный скролл ScrollView
  // Вместо этого используем обычный Responder
  const handleStartShouldSetResponder = () => {
    if (disabled) return false;

    console.log('🚫 [SwipeBlocker] Start - блокирую свайп');
    isBlockingRef.current = true;

    // Блокируем FlatList СИНХРОННО через setNativeProps
    // setState слишком медленный - FlatList успевает получить touch
    if (flatListRef?.current) {
      flatListRef.current.setNativeProps({ scrollEnabled: false });
    }

    disableSwipe();
    return true;
  };

  const handleMoveShouldSetResponder = () => {
    // Удерживаем респондер только если мы его захватили
    if (disabled || !isBlockingRef.current) return false;
    console.log('🚫 [SwipeBlocker] Move - удерживаю блокировку');
    return true;
  };

  // Запрещаем FlatList отбирать респондер у нас
  const handleResponderTerminationRequest = () => {
    console.log('🚫 [SwipeBlocker] TerminationRequest - НЕ отдаю респондер');
    return false;
  };

  const handleResponderGrant = () => {
    if (disabled) return;
    console.log('✅ [SwipeBlocker] Grant - получил респондер');
  };

  const handleResponderRelease = () => {
    if (disabled || !isBlockingRef.current) return;
    console.log('✅ [SwipeBlocker] Release - разблокирую свайп');
    isBlockingRef.current = false;

    // Разблокируем FlatList
    if (flatListRef?.current) {
      flatListRef.current.setNativeProps({ scrollEnabled: true });
    }

    enableSwipe();
  };

  const handleResponderTerminate = () => {
    if (disabled || !isBlockingRef.current) return;
    console.log('✅ [SwipeBlocker] Terminate - разблокирую свайп');
    isBlockingRef.current = false;

    // Разблокируем FlatList
    if (flatListRef?.current) {
      flatListRef.current.setNativeProps({ scrollEnabled: true });
    }

    enableSwipe();
  };

  return (
    <View
      style={style}
      onStartShouldSetResponder={handleStartShouldSetResponder}
      onMoveShouldSetResponder={handleMoveShouldSetResponder}
      onResponderTerminationRequest={handleResponderTerminationRequest}
      onResponderGrant={handleResponderGrant}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderTerminate}
    >
      {children}
    </View>
  );
};
