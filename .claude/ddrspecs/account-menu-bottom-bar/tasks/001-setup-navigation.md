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
1. [ ] Импортировать NavigationContainer из @react-navigation/native
2. [ ] Импортировать createNativeStackNavigator из @react-navigation/native-stack
3. [ ] Создать Stack Navigator
4. [ ] Обернуть авторизованную часть в Navigator со скрытым header
5. [ ] Создать две screen: Timesheet и Messenger
6. [ ] Передать onLogout через navigation params или context

## Критерии готовности
- [ ] NavigationContainer обёрнут вокруг приложения
- [ ] Stack Navigator создан для авторизованной части
- [ ] Существующий функционал TimesheetScreen не нарушен
- [ ] Приложение запускается без ошибок
