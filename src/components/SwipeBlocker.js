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

  // Capture phase - блокируем FlatList СРАЗУ
  const handleStartShouldSetResponderCapture = (event) => {
    if (disabled) return false;

    // Сохраняем начальную позицию
    startPositionRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };

    console.log('🚫 [SwipeBlocker] StartCapture - блокирую FlatList сразу');

    // Блокируем FlatList СРАЗУ - это предотвратит свайп дня
    if (flatListRef?.current) {
      flatListRef.current.setNativeProps({ scrollEnabled: false });
    }

    isBlockingRef.current = true;
    disableSwipe();

    // НЕ перехватываем респондер - даем Slider/TouchableOpacity работать
    return false;
  };

  // Capture phase - разблокируем только при вертикальном движении
  const handleMoveShouldSetResponderCapture = (event) => {
    if (disabled || !isBlockingRef.current) return false;

    const dx = Math.abs(event.nativeEvent.pageX - startPositionRef.current.x);
    const dy = Math.abs(event.nativeEvent.pageY - startPositionRef.current.y);

    // Если вертикальное движение - РАЗБЛОКИРУЕМ (даем ScrollView скроллить)
    if (dy > dx && dy > 10) {
      console.log('✅ [SwipeBlocker] MoveCapture - вертикальный свайп, РАЗБЛОКИРУЮ');

      // Разблокируем FlatList для вертикального скролла
      if (flatListRef?.current) {
        flatListRef.current.setNativeProps({ scrollEnabled: true });
      }

      isBlockingRef.current = false;
      enableSwipe();

      return false;
    }

    // Горизонтальное или слабое движение - оставляем блокировку
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
