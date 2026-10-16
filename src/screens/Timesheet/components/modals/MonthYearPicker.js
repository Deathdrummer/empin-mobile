import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dialog, DialogButton } from '../../../../components/ui/Dialog';
import { useTheme, useThemedStyles } from '../../../../theme';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Генерируем года от 2020 до 2040
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

const ITEM_HEIGHT = 40;

export const MonthYearPicker = ({ visible, currentDate, onClose, onSelect }) => {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Затухание к краям колеса — цветом фона окна
  const fadeIn = [`${theme.sheet}FF`, `${theme.sheet}00`];
  const fadeOut = [`${theme.sheet}00`, `${theme.sheet}FF`];
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

  const handleToday = () => {
    const today = new Date();
    const monthIndex = today.getMonth();
    const yearIndex = YEARS.indexOf(today.getFullYear());

    if (yearIndex !== -1) {
      setSelectedMonthIndex(monthIndex);
      setSelectedYearIndex(yearIndex);

      monthScrollRef.current?.scrollTo({
        y: monthIndex * ITEM_HEIGHT,
        animated: true,
      });
      yearScrollRef.current?.scrollTo({
        y: yearIndex * ITEM_HEIGHT,
        animated: true,
      });
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Месяц и год"
      buttons={(
        <>
          <DialogButton title="Отмена" onPress={onClose} />
          <DialogButton title="Сегодня" onPress={handleToday} />
          <DialogButton title="Выбрать" variant="primary" onPress={handleConfirm} />
        </>
      )}
    >
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
              colors={fadeIn}
              style={styles.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={fadeOut}
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
              colors={fadeIn}
              style={styles.fadeTop}
              pointerEvents="none"
            />
            <LinearGradient
              colors={fadeOut}
              style={styles.fadeBottom}
              pointerEvents="none"
            />
          </View>
        </View>
      </View>
    </Dialog>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    height: 228,
  },
  pickerWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
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
    backgroundColor: theme.fill,
    borderRadius: 10,
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
    color: theme.textMuted,
    textAlign: 'center',
  },
  selectedItemText: {
    fontSize: 20,
    color: theme.text,
    fontWeight: '700',
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
});
