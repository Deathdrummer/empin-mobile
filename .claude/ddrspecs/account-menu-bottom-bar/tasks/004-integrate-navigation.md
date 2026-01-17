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
1. [ ] В TimesheetScreen получить navigation через useNavigation hook
2. [ ] Создать handleNavigateToMessenger функцию: navigation.navigate('Messenger')
3. [ ] Передать handleNavigateToMessenger в BottomMenu props
4. [ ] В BottomMenu вызвать onNavigateToMessenger при выборе пункта "Мессенджер"
5. [ ] Проверить что функционал "План-график работ" не делает ничего (уже на экране)

## Критерии готовности
- [ ] Navigation hook импортирован в TimesheetScreen
- [ ] handleNavigateToMessenger передан в BottomMenu
- [ ] Тап на "Мессенджер" открывает экран MessengerScreen
- [ ] Тап на "План-график работ" ничего не делает (или закрывает меню)
- [ ] Кнопка "Назад" в Мессенджере возвращает на План-график
