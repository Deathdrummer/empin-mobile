# Task 3: Обновить BottomMenu с кнопкой "Аккаунт"

## Цель
Заменить кнопку "Выйти" на кнопку-иконку "Аккаунт" (person-circle-outline), добавить ActionSheet меню.

## Контекст
ActionSheet уже используется в проекте (ChatSection.js):
```javascript
import { useActionSheet } from '@expo/react-native-action-sheet';
const { showActionSheetWithOptions } = useActionSheet();
```

Меню должно содержать:
- План-график работ
- Мессенджер
- Выйти

## Файлы
- `src/components/BottomMenu.js` - обновить компонент

## План
1. [ ] Импортировать useActionSheet
2. [ ] Заменить иконку "log-out-outline" на "person-circle-outline"
3. [ ] Создать handleAccountPress функцию с ActionSheet
4. [ ] Настроить options: ["План-график работ", "Мессенджер", "Выйти", "Отмена"]
5. [ ] Добавить cancelButtonIndex (3)
6. [ ] Добавить title: "Меню аккаунта"
7. [ ] Обработать нажатия: 0 - ничего (уже на экране), 1 - навигация, 2 - выход
8. [ ] Принять onNavigateToMessenger через props

## Критерии готовности
- [ ] Кнопка "Выйти" заменена на "Аккаунт"
- [ ] Иконка person-circle-outline отображается
- [ ] При тапе открывается ActionSheet
- [ ] Меню содержит 3 пункта + Отмена
- [ ] Функционал выхода работает
