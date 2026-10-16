import React, { useMemo, useState, useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MonthYearPicker } from './MonthYearPicker';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../../../theme';

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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            borderColor: theme.accent,
            borderWidth: 1.5,
          },
        },
      };
    }

    // Отмечаем выбранную дату
    if (selectedDateString) {
      marked[selectedDateString] = {
        ...marked[selectedDateString],
        selected: true,
        selectedColor: theme.accent,
      };
    }

    return marked;
  }, [selectedDateString, today, hasActiveFilters, availableDates, currentCalendarDate, theme]);

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
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Выберите дату"
      buttons={(
        <>
          <DialogButton title="Закрыть" onPress={onClose} />
          <DialogButton title="Сегодня" variant="primary" onPress={handleToday} disabled={isTodaySelected} />
        </>
      )}
    >
      <Calendar
        // Календарь запоминает тему при создании: при смене светлой/тёмной создаём заново
        key={`${currentCalendarDateString}-${theme.dark ? 'dark' : 'light'}`}
        current={currentCalendarDateString}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType={'custom'}
        renderHeader={(date) => {
          const monthYear = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
          return (
            <TouchableOpacity onPress={openPicker} style={styles.calendarHeader} accessibilityLabel={`${monthYear}, выбрать месяц и год`}>
              <Text style={styles.calendarHeaderText}>{monthYear}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.accent} />
            </TouchableOpacity>
          );
        }}
        theme={{
          calendarBackground: theme.sheet,
          dayTextColor: theme.text,
          selectedDayBackgroundColor: theme.accent,
          selectedDayTextColor: theme.onAccent,
          todayTextColor: theme.accentText,
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textMonthFontWeight: 'bold',
          textDayHeaderFontSize: 13,
          monthTextColor: theme.text,
          arrowColor: theme.accent,
          textSectionTitleColor: theme.textSecondary,
          textDisabledColor: theme.dark ? '#3D3D45' : '#C9CAD0',
        }}
        style={styles.calendar}
        enableSwipeMonths={true}
        onMonthChange={(month) => {
          // Обновляем текущую дату календаря при свайпе
          const newDate = new Date(month.year, month.month - 1, 1);
          setCurrentCalendarDate(newDate);
        }}
      />

      <MonthYearPicker
        visible={pickerVisible}
        currentDate={currentCalendarDate}
        onClose={() => setPickerVisible(false)}
        onSelect={handleMonthYearSelect}
      />
    </Dialog>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  calendar: {
    borderRadius: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  calendarHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
});
