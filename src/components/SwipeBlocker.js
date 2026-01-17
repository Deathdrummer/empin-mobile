import React from 'react';
import { View } from 'react-native';
import { useSwipeControl } from '../contexts/SwipeControlContext';

/**
 * Компонент-обертка для блокировки свайпа FlatList
 * Используется для интерактивных элементов (AudioPlayer, MediaCollage, кнопки)
 *
 * КРИТИЧНО для работы на реальных устройствах:
 * Использует гибридный подход - setNativeProps (немедленно) + state (синхронизация)
 * См. SwipeControlContext.disableScroll/enableScroll
 */
export const SwipeBlocker = ({ children, style }) => {
  const { disableScroll, enableScroll } = useSwipeControl();

  return (
    <View
      style={style}
      onTouchStart={disableScroll}
      onTouchEnd={enableScroll}
      onTouchCancel={enableScroll}
      onResponderTerminate={enableScroll}
    >
      {children}
    </View>
  );
};
