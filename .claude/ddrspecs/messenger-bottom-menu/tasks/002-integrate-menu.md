# Task 2: Интегрировать BottomMenu в MessengerScreen

## Цель
Добавить компонент BottomMenu в MessengerScreen с отключенными кнопками "Календарь" и "Фильтр".

## Контекст
MessengerScreen сейчас полностью пустой. Нужно добавить нижнее меню только с кнопкой "Аккаунт", которая навигирует обратно на экран Timesheet (план-график работ).

## Файлы
- `src/screens/MessengerScreen.js`

## План
1. [x] Прочитать текущую реализацию MessengerScreen.js
2. [x] Импортировать BottomMenu
3. [x] Импортировать useNavigation из @react-navigation/native
4. [x] Добавить обработчик handleNavigateToTimesheet
5. [x] Добавить BottomMenu с пропсами:
   - showCalendar={false}
   - showFilter={false}
   - onNavigateToMessenger={handleNavigateToTimesheet}
6. [x] Обернуть экран в SafeAreaView если нужно

## Критерии готовности
- [x] BottomMenu отображается внизу экрана MessengerScreen
- [x] Видны только 3 пустые позиции и кнопка "Аккаунт" справа
- [x] Клик по кнопке "Аккаунт" возвращает на экран Timesheet
- [x] Меню визуально идентично меню в Timesheet (по высоте, отступам, стилям)

## Результат
- Изменено: src/screens/MessengerScreen.js
- Ключевые изменения:
  - Импортирован BottomMenu и useNavigation
  - Добавлен обработчик handleNavigateToTimesheet для навигации на экран Timesheet
  - Интегрирован BottomMenu с showCalendar={false} и showFilter={false}
  - Меню содержит только 3 пустые позиции и кнопку "Аккаунт"
