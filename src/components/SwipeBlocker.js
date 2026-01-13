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
  const startPositionRef = useRef({ x: 0, y: 0 });

  // Capture phase - только сохраняем позицию, НЕ блокируем
  const handleStartShouldSetResponderCapture = (event) => {
    if (disabled) return false;

    // Сохраняем начальную позицию
    startPositionRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };

    console.log('📍 [SwipeBlocker] StartCapture - запомнил позицию');

    // НЕ блокируем FlatList! Блокируем только при реальном движении
    // НЕ перехватываем респондер - даем дочерним элементам работать
    return false;
  };

  // Capture phase - перехватываем и блокируем только при горизонтальном движении
  const handleMoveShouldSetResponderCapture = (event) => {
    if (disabled) return false;

    const dx = Math.abs(event.nativeEvent.pageX - startPositionRef.current.x);
    const dy = Math.abs(event.nativeEvent.pageY - startPositionRef.current.y);

    // Если горизонтальное движение больше вертикального - БЛОКИРУЕМ и перехватываем
    if (dx > dy && dx > 10) {
      console.log('🚫 [SwipeBlocker] MoveCapture - горизонтальный свайп, БЛОКИРУЮ');

      // Блокируем FlatList ТОЛЬКО СЕЙЧАС
      if (flatListRef?.current) {
        flatListRef.current.setNativeProps({ scrollEnabled: false });
      }

      isBlockingRef.current = true;
      disableSwipe();

      return true; // Перехватываем респондер
    }

    // Если вертикальное движение - НЕ перехватываем (даем ScrollView скроллить)
    if (dy > dx && dy > 10) {
      console.log('✅ [SwipeBlocker] MoveCapture - вертикальный свайп, пропускаю');
      return false;
    }

    return false;
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
      onStartShouldSetResponderCapture={handleStartShouldSetResponderCapture}
      onMoveShouldSetResponderCapture={handleMoveShouldSetResponderCapture}
      onResponderTerminationRequest={handleResponderTerminationRequest}
      onResponderGrant={handleResponderGrant}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderTerminate}
    >
      {children}
    </View>
  );
};
