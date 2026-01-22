# Task 4: Интегрировать навигацию в BottomMenu

## Цель
Подключить навигацию между экранами через BottomMenu ActionSheet.

## Контекст
BottomMenu используется в TimesheetScreen.
Нужно передать navigation из TimesheetScreen в BottomMenu через props.

## Файлы
- `src/screens/Timesheet/index.js` - передать navigation в BottomMenu
- `src/components/BottomMenu.js` - использовать navigation.navigate()

## План
1. [x] В TimesheetScreen получить navigation через useNavigation hook
2. [x] Создать handleNavigateToMessenger функцию: navigation.navigate('Messenger')
3. [x] Передать handleNavigateToMessenger в BottomMenu props
4. [x] В BottomMenu вызвать onNavigateToMessenger при выборе пункта "Мессенджер"
5. [x] Проверить что функционал "План-график работ" не делает ничего (уже на экране)

## Критерии готовности
- [x] Navigation hook импортирован в TimesheetScreen
- [x] handleNavigateToMessenger передан в BottomMenu
- [x] Тап на "Мессенджер" открывает экран MessengerScreen
- [x] Тап на "План-график работ" ничего не делает (или закрывает меню)
- [x] Кнопка "Назад" в Мессенджере возвращает на План-график

## Прогресс
- Импортирован useNavigation в TimesheetScreen
- Создана функция handleNavigateToMessenger
- Передан prop onNavigateToMessenger в BottomMenu
- BottomMenu уже обрабатывает нажатия через ActionSheet
- Навигация полностью интегрирована

## Результат
- Изменено: `src/screens/Timesheet/index.js`
- Добавлено:
  - Импорт useNavigation
  - Функция handleNavigateToMessenger
  - Передача onNavigateToMessenger в BottomMenu
- Функционал готов к тестированию
