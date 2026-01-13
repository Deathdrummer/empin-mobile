import React, { useRef, useCallback, useEffect } from 'react';
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
  const unlockTimerRef = useRef(null);

  // Функция разблокировки
  const unlock = useCallback(() => {
    if (!isBlockingRef.current) return;

    console.log('✅ [SwipeBlocker] Разблокирую свайп');

    // Очищаем таймер
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }

    // Разблокируем FlatList
    if (flatListRef?.current) {
      flatListRef.current.setNativeProps({ scrollEnabled: true });
    }

    isBlockingRef.current = false;
    enableSwipe();
  }, [enableSwipe, flatListRef]);

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

    // СТРАХОВКА: автоматическая разблокировка через 1 секунду
    // Если Release не вызовется (дочерний элемент перехватил респондер)
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
    }
    unlockTimerRef.current = setTimeout(() => {
      console.log('⏰ [SwipeBlocker] Таймер - автоматическая разблокировка');
      unlock();
    }, 1000);

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
      console.log('✅ [SwipeBlocker] MoveCapture - вертикальный свайп');
      unlock();
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
    if (disabled) return;
    console.log('✅ [SwipeBlocker] Release');
    unlock();
  };

  const handleResponderTerminate = () => {
    if (disabled) return;
    console.log('✅ [SwipeBlocker] Terminate');
    unlock();
  };

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
      }
      // Разблокируем FlatList при размонтировании, если был заблокирован
      if (isBlockingRef.current && flatListRef?.current) {
        flatListRef.current.setNativeProps({ scrollEnabled: true });
      }
    };
  }, [flatListRef]);

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
