import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Modal, Dimensions, StatusBar, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MonthYearPicker } from './MonthYearPicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// Настройка русской локализации
LocaleConfig.locales['ru'] = {
  monthNames: MONTHS,
  monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Сегодня'
};
LocaleConfig.defaultLocale = 'ru';

export const CalendarModal = ({ visible, selectedDate, availableDates, hasActiveFilters, onClose, onDateSelect }) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(selectedDate || new Date());

  // Синхронизируем currentCalendarDate с selectedDate при изменении
  useEffect(() => {
    if (selectedDate) {
      setCurrentCalendarDate(selectedDate);
    }
  }, [selectedDate]);

  // Формируем строку даты в формате YYYY-MM-DD для react-native-calendars
  const selectedDateString = useMemo(() => {
    if (!selectedDate) return null;
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  // Формируем строку текущей даты календаря для навигации
  const currentCalendarDateString = useMemo(() => {
    const date = new Date(currentCalendarDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [currentCalendarDate]);

  // Получаем текущую дату для отметки
  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Проверяем, является ли выбранная дата сегодняшней
  const isTodaySelected = useMemo(() => {
    if (!selectedDate) return false;

    const todayDate = new Date();
    const selected = new Date(selectedDate);

    return (
      todayDate.getFullYear() === selected.getFullYear() &&
      todayDate.getMonth() === selected.getMonth() &&
      todayDate.getDate() === selected.getDate()
    );
  }, [selectedDate]);

  // Формируем markedDates для выделения выбранной даты и сегодняшней
  const markedDates = useMemo(() => {
    const marked = {};

    // Если есть активные фильтры - помечаем недоступные даты как disabled
    if (hasActiveFilters && availableDates) {
      // Генерируем disabled даты для диапазона ±3 месяца от текущего месяца календаря
      const currentMonth = new Date(currentCalendarDate);
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 3, 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 4, 0);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // Если даты нет в списке доступных - помечаем как disabled
        if (!availableDates.has(dateString)) {
          marked[dateString] = {
            ...marked[dateString],
            disabled: true,
            disableTouchEvent: true,
          };
        }
      }
    }

    // Отмечаем сегодняшнюю дату
    if (today) {
      marked[today] = {
        ...marked[today],
        customStyles: {
          container: {
            borderColor: '#999999',
            borderWidth: 2,
          },
        },
      };
    }

    // Отмечаем выбранную дату
    if (selectedDateString) {
      marked[selectedDateString] = {
        ...marked[selectedDateString],
        selected: true,
        selectedColor: '#999999',
      };
    }

    return marked;
  }, [selectedDateString, today, hasActiveFilters, availableDates, currentCalendarDate]);

  const handleDayPress = (day) => {
    // day.timestamp - это Unix timestamp в миллисекундах
    const date = new Date(day.timestamp);
    onDateSelect(date);
  };

  const handleMonthYearSelect = (month, year) => {
    // Создаем новую дату с выбранным месяцем и годом
    const newDate = new Date(year, month, 1);
    setCurrentCalendarDate(newDate);
  };

  const openPicker = () => {
    setPickerVisible(true);
  };

  const handleToday = () => {
    const today = new Date();
    onDateSelect(today);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" hidden={true} />
      <View style={styles.modalOverlay}>
        <View style={styles.modalBlurLayer} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Выберите дату</Text>

          <Calendar
            key={currentCalendarDateString}
            current={currentCalendarDateString}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            markingType={'custom'}
            renderHeader={(date) => {
              const monthYear = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
              return (
                <TouchableOpacity onPress={openPicker} style={styles.calendarHeader}>
                  <Text style={styles.calendarHeaderText}>{monthYear}</Text>
                </TouchableOpacity>
              );
            }}
            theme={{
              selectedDayBackgroundColor: '#999999',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#999999',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textMonthFontWeight: 'bold',
              textDayHeaderFontSize: 14,
              monthTextColor: '#555555',
              arrowColor: '#999999',
              textSectionTitleColor: '#333333',
              textDisabledColor: '#d9d9d9',
            }}
            style={{
              borderRadius: 8,
            }}
            enableSwipeMonths={true}
            onMonthChange={(month) => {
              // Обновляем текущую дату календаря при свайпе
              const newDate = new Date(month.year, month.month - 1, 1);
              setCurrentCalendarDate(newDate);
            }}
          />

          <View style={styles.buttonsContainer}>
            <TouchableHighlight
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
              underlayColor="#e8e8e8"
            >
              <Text style={styles.closeButtonText}>Закрыть</Text>
            </TouchableHighlight>

            <TouchableHighlight
              style={[styles.button, styles.todayButton, isTodaySelected && styles.todayButtonDisabled]}
              onPress={handleToday}
              underlayColor="#7a7a7a"
              disabled={isTodaySelected}
            >
              <Text style={[styles.todayButtonText, isTodaySelected && styles.todayButtonTextDisabled]}>Сегодня</Text>
            </TouchableHighlight>
          </View>
        </View>
      </View>

      <MonthYearPicker
        visible={pickerVisible}
        currentDate={currentCalendarDate}
        onClose={() => setPickerVisible(false)}
        onSelect={handleMonthYearSelect}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
  },
  modalBlurLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: SCREEN_WIDTH - 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 15,
    textAlign: 'center',
  },
  calendarHeader: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  calendarHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 25,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  todayButton: {
    backgroundColor: '#999999',
  },
  todayButtonDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  todayButtonTextDisabled: {
    color: '#aaa',
  },
  closeButtonText: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
  },
});
