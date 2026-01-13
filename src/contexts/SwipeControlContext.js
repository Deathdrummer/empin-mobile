import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

/**
 * Контекст для доступа к FlatList главного экрана
 * Позволяет интерактивным элементам (Slider, MediaCollage) блокировать горизонтальный свайп
 */
const SwipeControlContext = createContext(null);

export const SwipeControlProvider = ({ children }) => {
  const flatListRef = useRef(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const disableScroll = useCallback(() => {
    console.log('🚫 SwipeControl: Блокировка свайпа');
    setScrollEnabled(false);
  }, []);

  const enableScroll = useCallback(() => {
    console.log('✅ SwipeControl: Разблокировка свайпа');
    setScrollEnabled(true);
  }, []);

  const value = {
    flatListRef,
    scrollEnabled,
    disableScroll,
    enableScroll,
  };

  return (
    <SwipeControlContext.Provider value={value}>
      {children}
    </SwipeControlContext.Provider>
  );
};

/**
 * Хук для доступа к FlatList ref
 * @returns {Object} { flatListRef }
 */
export const useSwipeControl = () => {
  const context = useContext(SwipeControlContext);
  if (!context) {
    throw new Error('useSwipeControl must be used within SwipeControlProvider');
  }
  return context;
};
