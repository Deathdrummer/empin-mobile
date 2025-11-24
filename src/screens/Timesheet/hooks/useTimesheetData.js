import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { timesheetAPI } from '../../../services/api';
import { refreshPermissions } from '../../../utils/permissions';

const DAYS_RANGE = 30;
const LOAD_MORE_THRESHOLD = 15;

export const useTimesheetData = (onLogout) => {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minIndex, setMinIndex] = useState(-DAYS_RANGE);
  const [maxIndex, setMaxIndex] = useState(DAYS_RANGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    refreshPermissions().catch(err => {
      console.error('Failed to refresh permissions on mount:', err);
    });
    loadDays();
  }, []);

  const loadDays = async (min = -DAYS_RANGE, max = DAYS_RANGE, preserveScrollPosition = false) => {
    try {
      const indexes = [];
      for (let i = min; i <= max; i++) {
        indexes.push(i);
      }

      const data = await timesheetAPI.getSlides(indexes);

      if (data && Array.isArray(data)) {
        const currentDayIndex = preserveScrollPosition && days.length > 0 && days[currentIndex]
          ? days[currentIndex].index
          : null;

        setDays(data);
        setMinIndex(min);
        setMaxIndex(max);

        if (preserveScrollPosition && currentDayIndex !== null) {
          const newIdx = data.findIndex(day => day.index === currentDayIndex);
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
          const todayIdx = data.findIndex(day => day.index === 0);
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
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const newMaxIndex = maxIndex + DAYS_RANGE;
      const indexes = [];
      for (let i = maxIndex + 1; i <= newMaxIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes);
      if (newData && Array.isArray(newData)) {
        setDays(prev => [...prev, ...newData]);
        setMaxIndex(newMaxIndex);
      }
    } catch (error) {
      console.error('Error loading more days:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreBackward = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const newMinIndex = minIndex - DAYS_RANGE;
      const indexes = [];
      for (let i = newMinIndex; i < minIndex; i++) {
        indexes.push(i);
      }

      const newData = await timesheetAPI.getSlides(indexes);
      if (newData && Array.isArray(newData)) {
        // Сначала обновляем индекс до изменения массива
        const newIdx = currentIndex + newData.length;
        setCurrentIndex(newIdx);

        // Затем обновляем массив и границы
        const updatedDays = [...newData, ...days];
        setDays(updatedDays);
        setMinIndex(newMinIndex);

        // Прокручиваем к сохраненной позиции
        if (flatListRef.current) {
          // Используем requestAnimationFrame для синхронизации с рендером
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: newIdx,
                  animated: false,
                });
              }
            }, 100);
          });
        }
      }
    } catch (error) {
      console.error('Error loading previous days:', error);
    } finally {
      setLoadingMore(false);
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

        const data = await timesheetAPI.getSlides(indexes);

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

  return {
    days,
    loading,
    refreshing,
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
    LOAD_MORE_THRESHOLD,
    loadingMore,
  };
};
