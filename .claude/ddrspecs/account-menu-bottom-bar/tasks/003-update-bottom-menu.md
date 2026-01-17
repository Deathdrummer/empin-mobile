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
1. [x] Импортировать useActionSheet
2. [x] Заменить иконку "log-out-outline" на "person-circle-outline"
3. [x] Создать handleAccountPress функцию с ActionSheet
4. [x] Настроить options: ["План-график работ", "Мессенджер", "Выйти", "Отмена"]
5. [x] Добавить cancelButtonIndex (3)
6. [x] Добавить title: "Меню аккаунта"
7. [x] Обработать нажатия: 0 - ничего (уже на экране), 1 - навигация, 2 - выход
8. [x] Принять onNavigateToMessenger через props

## Критерии готовности
- [x] Кнопка "Выйти" заменена на "Аккаунт"
- [x] Иконка person-circle-outline отображается
- [x] При тапе открывается ActionSheet
- [x] Меню содержит 3 пункта + Отмена
- [x] Функционал выхода работает

## Прогресс
- Импортирован useActionSheet
- Создана функция handleAccountPress с ActionSheet
- Иконка заменена на person-circle-outline
- Настроено меню с 4 опциями (включая Отмена)
- Добавлен prop onNavigateToMessenger
- Обработаны все варианты нажатий

## Результат
- Изменено: `src/components/BottomMenu.js`
- Добавлено:
  - useActionSheet hook
  - Функция handleAccountPress
  - Prop onNavigateToMessenger
  - ActionSheet меню с опциями
- Кнопка "Выйти" заменена на "Аккаунт"
