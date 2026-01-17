# Task 2: Интегрировать BottomMenu в MessengerScreen

## Цель
Добавить компонент BottomMenu в MessengerScreen с отключенными кнопками "Календарь" и "Фильтр".

## Контекст
MessengerScreen сейчас полностью пустой. Нужно добавить нижнее меню только с кнопкой "Аккаунт", которая навигирует обратно на экран Timesheet (план-график работ).

## Файлы
- `src/screens/MessengerScreen.js`

## План
1. [ ] Прочитать текущую реализацию MessengerScreen.js
2. [ ] Импортировать BottomMenu
3. [ ] Импортировать useNavigation из @react-navigation/native
4. [ ] Добавить обработчик handleNavigateToTimesheet
5. [ ] Добавить BottomMenu с пропсами:
   - showCalendar={false}
   - showFilter={false}
   - onNavigateToMessenger={handleNavigateToTimesheet}
6. [ ] Обернуть экран в SafeAreaView если нужно

## Критерии готовности
- [ ] BottomMenu отображается внизу экрана MessengerScreen
- [ ] Видны только 3 пустые позиции и кнопка "Аккаунт" справа
- [ ] Клик по кнопке "Аккаунт" возвращает на экран Timesheet
- [ ] Меню визуально идентично меню в Timesheet (по высоте, отступам, стилям)
