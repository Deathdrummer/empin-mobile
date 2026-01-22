# Task 1: Настроить React Navigation

## Цель
Настроить Stack Navigator для навигации между экранами План-график работ и Мессенджер.

## Контекст
В проекте уже установлены:
- @react-navigation/native (7.1.18)
- @react-navigation/native-stack (7.5.1)
- react-native-safe-area-context (5.6.1)
- react-native-screens (4.16.0)

Сейчас в App.js используется простой условный рендеринг:
```javascript
{isLoggedIn ? <TimesheetScreen onLogout={handleLogout} /> : <LoginScreen onLoginSuccess={handleLoginSuccess} />}
```

Нужно обернуть в NavigationContainer и создать Stack Navigator.

## Файлы
- `App.js` - добавить NavigationContainer и Stack Navigator

## План
1. [x] Импортировать NavigationContainer из @react-navigation/native
2. [x] Импортировать createNativeStackNavigator из @react-navigation/native-stack
3. [x] Создать Stack Navigator
4. [x] Обернуть авторизованную часть в Navigator со скрытым header
5. [x] Создать screen Timesheet (Messenger будет в следующей задаче)
6. [x] Передать onLogout через props в children функции

## Критерии готовности
- [x] NavigationContainer обёрнут вокруг приложения
- [x] Stack Navigator создан для авторизованной части
- [x] Существующий функционал TimesheetScreen не нарушен
- [ ] Приложение запускается без ошибок (требуется проверка)

## Прогресс
- Добавлены импорты NavigationContainer и createNativeStackNavigator
- Создан Stack экземпляр
- Обернута авторизованная часть в NavigationContainer + Stack.Navigator
- Установлен headerShown: false глобально через screenOptions
- onLogout передаётся через props в children функции
- Код готов к тестированию

## Результат
- Изменено: `App.js`
- Добавлено:
  - Импорты: NavigationContainer, createNativeStackNavigator
  - Stack Navigator для авторизованной части
  - Screen "Timesheet" с передачей onLogout через props
