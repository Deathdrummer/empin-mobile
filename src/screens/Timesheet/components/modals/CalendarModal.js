import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Modal, Dimensions, StatusBar } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Настройка русской локализации
LocaleConfig.locales['ru'] = {
  monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Сегодня'
};
LocaleConfig.defaultLocale = 'ru';

export const CalendarModal = ({ visible, selectedDate, onClose, onDateSelect }) => {
  // Формируем строку даты в формате YYYY-MM-DD для react-native-calendars
  const selectedDateString = useMemo(() => {
    if (!selectedDate) return null;
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  // Получаем текущую дату для отметки
  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Формируем markedDates для выделения выбранной даты и сегодняшней
  const markedDates = useMemo(() => {
    const marked = {};

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
  }, [selectedDateString, today]);

  const handleDayPress = (day) => {
    // day.timestamp - это Unix timestamp в миллисекундах
    const date = new Date(day.timestamp);
    onDateSelect(date);
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
            current={selectedDateString || today}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            markingType={'custom'}
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
          />
          <TouchableHighlight
            style={styles.modalCloseButton}
            onPress={onClose}
            underlayColor="#b8b8b8"
          >
            <Text style={styles.modalCloseText}>Закрыть</Text>
          </TouchableHighlight>
        </View>
      </View>
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
  modalCloseButton: {
    backgroundColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#777',
    fontSize: 16,
    fontWeight: '700',
  },
});
