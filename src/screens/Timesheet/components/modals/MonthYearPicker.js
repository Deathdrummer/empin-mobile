import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableHighlight, Modal, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Генерируем года от 2020 до 2040
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

const ITEM_HEIGHT = 40;

export const MonthYearPicker = ({ visible, currentDate, onClose, onSelect }) => {
  const monthScrollRef = useRef(null);
  const yearScrollRef = useRef(null);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    return currentDate ? new Date(currentDate).getMonth() : new Date().getMonth();
  });

  const [selectedYearIndex, setSelectedYearIndex] = useState(() => {
    const year = currentDate ? new Date(currentDate).getFullYear() : new Date().getFullYear();
    return YEARS.indexOf(year);
  });

  // Обновляем при изменении currentDate
  useEffect(() => {
    if (currentDate) {
      const date = new Date(currentDate);
      setSelectedMonthIndex(date.getMonth());
      const yearIndex = YEARS.indexOf(date.getFullYear());
      if (yearIndex !== -1) {
        setSelectedYearIndex(yearIndex);
      }
    }
  }, [currentDate]);

  // Скроллим к выбранному элементу при открытии
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        monthScrollRef.current?.scrollTo({
          y: selectedMonthIndex * ITEM_HEIGHT,
          animated: false,
        });
        yearScrollRef.current?.scrollTo({
          y: selectedYearIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 100);
    }
  }, [visible]);

  const handleMonthScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    setSelectedMonthIndex(Math.max(0, Math.min(index, MONTHS.length - 1)));
  };

  const handleYearScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    setSelectedYearIndex(Math.max(0, Math.min(index, YEARS.length - 1)));
  };

  const handleConfirm = () => {
    onSelect(selectedMonthIndex, YEARS[selectedYearIndex]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBlurLayer} />
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Выберите месяц и год</Text>

          <View style={styles.pickersContainer}>
            {/* Месяцы */}
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Месяц</Text>
              <View style={styles.wheelContainer}>
                {/* Индикатор выбранного элемента */}
                <View style={styles.selectedIndicator} />

                <ScrollView
                  ref={monthScrollRef}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleMonthScroll}
                >
                  {MONTHS.map((month, index) => (
                    <View key={index} style={styles.item}>
                      <Text
                        style={[
                          styles.itemText,
                          selectedMonthIndex === index && styles.selectedItemText
                        ]}
                      >
                        {month}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Градиенты затухания */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)']}
                  style={styles.fadeTop}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']}
                  style={styles.fadeBottom}
                  pointerEvents="none"
                />
              </View>
            </View>

            {/* Годы */}
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Год</Text>
              <View style={styles.wheelContainer}>
                {/* Индикатор выбранного элемента */}
                <View style={styles.selectedIndicator} />

                <ScrollView
                  ref={yearScrollRef}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleYearScroll}
                >
                  {YEARS.map((year, index) => (
                    <View key={year} style={styles.item}>
                      <Text
                        style={[
                          styles.itemText,
                          selectedYearIndex === index && styles.selectedItemText
                        ]}
                      >
                        {year}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Градиенты затухания */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)']}
                  style={styles.fadeTop}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']}
                  style={styles.fadeBottom}
                  pointerEvents="none"
                />
              </View>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableHighlight
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              underlayColor="#b8b8b8"
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableHighlight>

            <TouchableHighlight
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              underlayColor="#7a7a7a"
            >
              <Text style={styles.confirmButtonText}>Применить</Text>
            </TouchableHighlight>
          </View>
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
    maxHeight: '80%',
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
    marginBottom: 20,
    textAlign: 'center',
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    height: 200,
  },
  pickerWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textAlign: 'center',
  },
  wheelContainer: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(153, 153, 153, 0.15)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#999',
    zIndex: 1,
    pointerEvents: 'none',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 80,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
  },
  selectedItemText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 2,
    pointerEvents: 'none',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 2,
    pointerEvents: 'none',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#d0d0d0',
  },
  confirmButton: {
    backgroundColor: '#999999',
  },
  cancelButtonText: {
    color: '#777',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
