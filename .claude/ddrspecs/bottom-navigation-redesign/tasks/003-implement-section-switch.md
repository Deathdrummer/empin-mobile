# Task 3: Реализация динамической правой кнопки переключения раздела

## Цель
Реализовать правую кнопку, которая динамически меняет иконку и действие в зависимости от текущего раздела:
- В разделе "План-график работ" → иконка мессенджера, переход в Messenger
- В разделе "Мессенджер" → иконка календаря, переход в Timesheet

## Контекст
Используем React Navigation для плавных переходов через `navigation.replace()` или `navigation.navigate()`.

## Файлы
- `src/components/BottomMenu.js`

## План
1. [ ] Добавить пропсы: `currentSection` (или определять из `currentScreen`), `onNavigateToMessenger`, `onNavigateToTimesheet`
2. [ ] Создать функцию getSwitchSectionIcon() - возвращает иконку в зависимости от раздела
3. [ ] Создать функцию handleSectionSwitch() - вызывает нужный navigation callback
4. [ ] Обновить renderRightButton() с реальной реализацией
5. [ ] Добавить Ionicons: `chatbubble-outline` (мессенджер), `calendar-outline` (план-график)

## Критерии готовности
- [ ] В разделе Timesheet правая кнопка показывает иконку мессенджера
- [ ] В разделе Messenger правая кнопка показывает иконку календаря
- [ ] Тап на кнопку корректно переключает раздел
- [ ] Переход анимированный и плавный (React Navigation)

## Проблемы и решения

### 🐛 Проблема 1: Меню "три точки" не закрывается при тапе вне области
**Дата**: 2026-01-19 19:30
**Описание**: При клике на кнопку "три точки" открывается меню, но закрыть его можно только если кликнуть на "Выйти". Необходимо сделать так, чтобы меню закрывалось при тапе/клике на пустое пространство вне области меню. При этом **не должно быть видимой кнопки "Отмена"**.

**Решение**: Использован хак - установлен `cancelButtonIndex = 1` при массиве `options = ['Выйти']` (индекс 1 за пределами массива). В `@expo/react-native-action-sheet` библиотека требует `cancelButtonIndex` для закрытия тапом вне области. Но если указать индекс за пределами массива options, меню закрывается тапом вне области, но кнопка "Отмена" не отображается.

**Изменено**:
- `src/components/BottomMenu.js` - установлен cancelButtonIndex = 1 при одной опции (индекс за пределами массива)

**Источники**:
- [GitHub Issue #173](https://github.com/expo/react-native-action-sheet/issues/173) — проблема с закрытием ActionSheet тапом вне области
- Коммит `77933e5` — предыдущая реализация этого хака в проекте

### 🐛 Проблема 2: Большое расстояние между иконкой и надписью в пункте "Выйти"
**Дата**: 2026-01-19 20:00
**Описание**: У пункта меню "Выйти" было большое расстояние между иконкой и текстом (иконка далеко от текста).

**Причина**: В исходном коде `@expo/react-native-action-sheet` жестко закодировано `marginRight: 32` для иконки в стилях. Это значение нельзя изменить через пропсы.

**Решение**: Создан patch через `patch-package`, который изменяет `marginRight` с 32 на 12 в файлах `ActionGroup.js` библиотеки. Патч автоматически применяется после `npm install` через postinstall скрипт.

**Изменено**:
- `patches/@expo+react-native-action-sheet+4.1.1.patch` - создан патч для изменения marginRight
- `src/components/BottomMenu.js` - убрана обёртка View вокруг иконки (откат предыдущей попытки)

**Как менять расстояние вручную**:
```bash
# Отредактируй файл:
# node_modules/@expo/react-native-action-sheet/lib/module/ActionSheet/ActionGroup.js
# Найди: marginRight:12
# Измени на нужное значение (например, 8 или 16)
# Пересоздай патч:
npx patch-package @expo/react-native-action-sheet
```

**Источники**:
- [GitHub expo/react-native-action-sheet](https://github.com/expo/react-native-action-sheet) — исходный код ActionGroup.tsx
- [WebFetch ActionGroup.tsx](https://github.com/expo/react-native-action-sheet/blob/master/src/ActionSheet/ActionGroup.tsx) — хардкод marginRight: 32
