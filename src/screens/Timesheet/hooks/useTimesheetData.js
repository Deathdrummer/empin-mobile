import { useState, useEffect, useRef } from 'react';
import { Alert, Dimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';
import { refreshPermissions } from '../../../utils/permissions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAYS_RANGE = 30;
const LOAD_MORE_THRESHOLD = 15;

export const useTimesheetData = (onLogout, filters = null, isPrependingRef = null) => {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minIndex, setMinIndex] = useState(-DAYS_RANGE);
  const [maxIndex, setMaxIndex] = useState(DAYS_RANGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPrepending, setIsPrepending] = useState(false);
  const flatListRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pendingScrollRef = useRef(null); // Для хранения отложенного скролла

  useEffect(() => {
    refreshPermissions().catch(err => {
      console.error('Failed to refresh permissions on mount:', err);
    });
    loadDays();
  }, []);

  // Перезагружаем данные при изменении фильтров
  // ВАЖНО: всегда загружаем диапазон вокруг текущей даты, а не текущий загруженный диапазон
  // При сбросе фильтров (все пустые) - возвращаемся на текущую дату
  useEffect(() => {
    if (!loading) {
      setFilterLoading(true);
      const isFilterReset = !filters || (filters.teams?.length === 0 && filters.contracts?.length === 0);
      loadDays(-DAYS_RANGE, DAYS_RANGE, !isFilterReset);
    }
  }, [filters]);

  const loadDays = async (min = -DAYS_RANGE, max = DAYS_RANGE, preserveScrollPosition = false) => {
    try {
      const indexes = [];
      for (let i = min; i <= max; i++) {
        indexes.push(i);
      }

      const data = await timesheetAPI.getSlides(indexes, filters);

      if (data && Array.isArray(data)) {
        const currentDayIndex = preserveScrollPosition && days.length > 0 && days[currentIndex]
          ? days[currentIndex].index
          : null;

        setDays(data);
        setMinIndex(min);
        setMaxIndex(max);

        if (preserveScrollPosition && currentDayIndex !== null) {
          // Пытаемся найти текущий день в новых данных
          let newIdx = data.findIndex(day => day.index === currentDayIndex);

          // Если текущий день отфильтрован, ищем ближайший к сегодня (index = 0)
          if (newIdx === -1) {
            // Сначала пытаемся найти сегодня (index = 0)
            newIdx = data.findIndex(day => day.index === 0);

            // Если и сегодня нет, ищем день с минимальным расстоянием от 0
            if (newIdx === -1 && data.length > 0) {
              let minDistance = Infinity;
              let closestIdx = 0;

              data.forEach((day, idx) => {
                const distance = Math.abs(day.index);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIdx = idx;
                }
              });

              newIdx = closestIdx;
            }
          }

          if (newIdx !== -1) {
            setCurrentIndex(newIdx);
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: newIdx,
                  animated: false,
                });
              }
            }, 50);
          }
        } else {
          // Первая загрузка - ищем сегодня
          let todayIdx = data.findIndex(day => day.index === 0);

          // Если сегодня нет (отфильтровано), ищем день с минимальным расстоянием от 0
          if (todayIdx === -1 && data.length > 0) {
            let minDistance = Infinity;
            let closestIdx = 0;

            data.forEach((day, idx) => {
              const distance = Math.abs(day.index);
              if (distance < minDistance) {
                minDistance = distance;
                closestIdx = idx;
              }
            });

            todayIdx = closestIdx;
          }

          if (todayIdx !== -1) {
            setCurrentIndex(todayIdx);
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: todayIdx,
                  animated: false,
                });
              }
            }, 100);
          }
        }
      } else {
        Alert.alert('Ошибка', 'Неверный формат данных');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Сессия истекла',
          text2: 'Необходимо войти заново',
          position: 'top',
          visibilityTime: 2000,
        });
        setTimeout(() => {
          onLogout();
        }, 2000);
        return;
      }

      const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка';
      Toast.show({
        type: 'error',
        text1: 'Ошибка загрузки',
        text2: errorMsg,
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFilterLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPermissions();
      await loadDays(minIndex, maxIndex, true);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const loadMoreForward = async () => {
    if (loadingMore || isLoadingRef.current) {
      console.log('🚫 [LOAD FORWARD] Заблокировано:', {
        loadingMore,
        isLoadingRef: isLoadingRef.current,
      });
      return;
    }

    const currentDayIndex = days[currentIndex]?.index;

    console.log('🔄 [LOAD FORWARD] Начало подгрузки:', {
      currentArrayIndex: currentIndex,
      currentDayIndex,
      currentRange: `${minIndex} .. ${maxIndex}`,
      willLoadRange: `${maxIndex + 1} .. ${maxIndex + DAYS_RANGE}`,
      totalDaysBefore: days.length,
    });

    isLoadingRef.current = true;
    setLoadingMore(true);
    setIsPrepending(true); // Показываем спиннер
    try {
      const newMaxIndex = maxIndex + DAYS_RANGE;
      const indexes = [];
      for (let i = maxIndex + 1; i <= newMaxIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes, filters);
      if (newData && Array.isArray(newData)) {
        console.log('✅ [LOAD FORWARD] Данные загружены:', {
          loadedDays: newData.length,
          expectedDays: DAYS_RANGE,
          totalDaysAfter: days.length + newData.length,
          newRange: `${minIndex} .. ${newMaxIndex}`,
        });

        setDays(prev => [...prev, ...newData]);
        setMaxIndex(newMaxIndex);

        // Небольшая задержка перед скрытием спиннера для плавности
        setTimeout(() => {
          setIsPrepending(false);
        }, 100);
      }
    } catch (error) {
      console.error('Error loading more days:', error);
      setIsPrepending(false);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  };

  const loadMoreBackward = async (scrollIndex = currentIndex) => {
    if (loadingMore || isLoadingRef.current || (isPrependingRef && isPrependingRef.current)) {
      console.log('🚫 [LOAD BACKWARD] Заблокировано:', {
        loadingMore,
        isLoadingRef: isLoadingRef.current,
        isPrepending: isPrependingRef?.current,
      });
      return;
    }

    const currentDayIndex = days[scrollIndex]?.index;

    if (currentDayIndex === undefined) {
      return;
    }

    console.log('🔄 [LOAD BACKWARD] Начало подгрузки:', {
      currentArrayIndex: scrollIndex,
      currentDayIndex,
      currentRange: `${minIndex} .. ${maxIndex}`,
      willLoadRange: `${minIndex - DAYS_RANGE} .. ${minIndex - 1}`,
      totalDaysBefore: days.length,
    });

    isLoadingRef.current = true;
    if (isPrependingRef) {
      isPrependingRef.current = true;
    }
    setIsPrepending(true);
    setLoadingMore(true);
    try {
      const newMinIndex = minIndex - DAYS_RANGE;
      const indexes = [];
      for (let i = newMinIndex; i < minIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes, filters);
      if (newData && Array.isArray(newData)) {
        console.log('✅ [LOAD BACKWARD] Данные загружены:', {
          loadedDays: newData.length,
          expectedDays: DAYS_RANGE,
        });

        // Формируем новый массив
        const updatedDays = [...newData, ...days];

        // Находим новый индекс для того же дня (по day.index)
        const newIdx = updatedDays.findIndex(day => day.index === currentDayIndex);

        console.log('🎯 [LOAD BACKWARD] Новая позиция:', {
          oldArrayIndex: scrollIndex,
          newArrayIndex: newIdx,
          dayIndex: currentDayIndex,
          totalDaysAfter: updatedDays.length,
          newRange: `${newMinIndex} .. ${maxIndex}`,
        });

        if (newIdx === -1) {
          if (isPrependingRef) {
            isPrependingRef.current = false;
          }
          setIsPrepending(false);
          return;
        }

        // Сохраняем целевой индекс для fallback scroll
        pendingScrollRef.current = {
          index: newIdx,
          dayIndex: currentDayIndex,
        };

        // Обновляем данные
        setDays(updatedDays);
        setMinIndex(newMinIndex);
        setCurrentIndex(newIdx);

        console.log('🚀 [LOAD BACKWARD] Запланирован immediate scroll к индексу:', {
          arrayIndex: newIdx,
          dayIndex: currentDayIndex,
        });

        // Скроллим сразу после обновления данных
        setTimeout(() => {
          if (flatListRef.current) {
            console.log('📍 [LOAD BACKWARD] Выполняется immediate scrollToIndex:', newIdx);

            flatListRef.current.scrollToIndex({
              index: newIdx,
              animated: false,
              viewPosition: 0, // Начало видимой области
            });

            // КРИТИЧНО: очищаем pendingScrollRef, чтобы fallback не сработал
            pendingScrollRef.current = null;
            console.log('🗑️ [LOAD BACKWARD] pendingScrollRef очищен, fallback отменен');

            // Снимаем флаг prepending после скролла
            setTimeout(() => {
              if (isPrependingRef) {
                isPrependingRef.current = false;
              }
              setIsPrepending(false);
              console.log('✨ [LOAD BACKWARD] Prepending завершен');
            }, 300);
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error loading previous days:', error);
      if (isPrependingRef) {
        isPrependingRef.current = false;
      }
      setIsPrepending(false);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  };

  const handleDateSelect = async (date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    const diffTime = selectedDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Проверяем, находится ли выбранная дата в текущем диапазоне
    if (diffDays >= minIndex && diffDays <= maxIndex) {
      // Дата в текущем диапазоне - просто скроллим к ней
      const targetIndex = days.findIndex(day => day.index === diffDays);
      if (targetIndex !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
        });
        setCurrentIndex(targetIndex);
      }
    } else {
      // Дата за пределами диапазона - загружаем новый диапазон с центром на выбранной дате
      setLoading(true);
      try {
        const newMinIndex = diffDays - DAYS_RANGE;
        const newMaxIndex = diffDays + DAYS_RANGE;

        const indexes = [];
        for (let i = newMinIndex; i <= newMaxIndex; i++) {
          indexes.push(i);
        }

        const data = await timesheetAPI.getSlides(indexes, filters);

        if (data && Array.isArray(data)) {
          setDays(data);
          setMinIndex(newMinIndex);
          setMaxIndex(newMaxIndex);

          // Находим индекс выбранной даты в новом массиве
          const targetIndex = data.findIndex(day => day.index === diffDays);
          if (targetIndex !== -1) {
            setCurrentIndex(targetIndex);
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: targetIndex,
                  animated: false,
                });
              }
            }, 100);
          }
        }
      } catch (error) {
        const errorMsg = error.response?.data?.message || error.message || 'Ошибка загрузки';
        Toast.show({
          type: 'error',
          text1: 'Ошибка',
          text2: errorMsg,
          position: 'top',
          visibilityTime: 3000,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleContentSizeChange = () => {
    // Этот callback срабатывает сразу после изменения размера контента
    if (pendingScrollRef.current && flatListRef.current) {
      const { index, dayIndex } = pendingScrollRef.current;

      console.log('⚠️ [handleContentSizeChange] FALLBACK scroll срабатывает!', {
        arrayIndex: index,
        dayIndex: dayIndex,
        warning: 'Immediate scroll не сработал, используем fallback',
      });

      // Используем scrollToIndex вместо scrollToOffset - более надежный метод
      flatListRef.current.scrollToIndex({
        index,
        animated: false,
      });

      pendingScrollRef.current = null;

      // Снимаем флаг prepending после задержки для завершения скролла и всех momentum events
      if (isPrependingRef) {
        setTimeout(() => {
          isPrependingRef.current = false;
          setIsPrepending(false);
          console.log('✨ [handleContentSizeChange] Prepending завершен (fallback)');
        }, 500);
      }
    }
  };

  return {
    days,
    loading,
    refreshing,
    filterLoading,
    currentIndex,
    setCurrentIndex,
    flatListRef,
    minIndex,
    maxIndex,
    loadDays,
    onRefresh,
    loadMoreForward,
    loadMoreBackward,
    handleDateSelect,
    handleContentSizeChange,
    LOAD_MORE_THRESHOLD,
    loadingMore,
    isPrepending,
  };
};
