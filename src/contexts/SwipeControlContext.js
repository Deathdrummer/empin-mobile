import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Контекст для управления блокировкой свайпа дней
 * Позволяет любым элементам блокировать/разблокировать свайп
 */
const SwipeControlContext = createContext(null);

export const SwipeControlProvider = ({ children }) => {
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const blockersCount = useRef(0);
  const flatListRef = useRef(null); // Ref на FlatList для прямой блокировки

  /**
   * Блокирует свайп (увеличивает счетчик блокировок)
   * Свайп будет заблокирован, пока счетчик > 0
   */
  const disableSwipe = useCallback(() => {
    blockersCount.current += 1;
    if (swipeEnabled) {
      setSwipeEnabled(false);
      console.log('🚫 [SwipeControl] Свайп заблокирован (блокировок:', blockersCount.current, ')');
    }
  }, [swipeEnabled]);

  /**
   * Разблокирует свайп (уменьшает счетчик блокировок)
   * Свайп будет разблокирован только когда счетчик достигнет 0
   */
  const enableSwipe = useCallback(() => {
    blockersCount.current = Math.max(0, blockersCount.current - 1);
    if (!swipeEnabled && blockersCount.current === 0) {
      setSwipeEnabled(true);
      console.log('✅ [SwipeControl] Свайп разблокирован');
    }
  }, [swipeEnabled]);

  /**
   * Сброс всех блокировок (на случай ошибок)
   */
  const resetSwipe = useCallback(() => {
    blockersCount.current = 0;
    setSwipeEnabled(true);
    console.log('🔄 [SwipeControl] Сброс всех блокировок');
  }, []);

  const value = {
    swipeEnabled,
    disableSwipe,
    enableSwipe,
    resetSwipe,
    flatListRef, // Передаем ref в контекст
  };

  return (
    <SwipeControlContext.Provider value={value}>
      {children}
    </SwipeControlContext.Provider>
  );
};

/**
 * Хук для управления свайпом
 * @returns {Object} { swipeEnabled, disableSwipe, enableSwipe, resetSwipe }
 */
export const useSwipeControl = () => {
  const context = useContext(SwipeControlContext);
  if (!context) {
    throw new Error('useSwipeControl must be used within SwipeControlProvider');
  }
  return context;
};
