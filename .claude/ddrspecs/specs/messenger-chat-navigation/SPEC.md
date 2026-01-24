# Spec: Навигация в чат с сотрудником

## Цель
Добавить переход из списка сотрудников (ChatsTab) в экран чата (ChatScreen).

## Требования
- При тапе на плашку сотрудника → navigate('Chat', { staffId, staffName })
- ChatScreen — заглушка с header и кнопкой назад
- Стиль как в Telegram/WhatsApp

## Файлы
- `src/screens/Messenger/ChatScreen.js` (create)
- `App.js` (modify) — добавить Chat в Stack.Navigator
- `src/screens/Messenger/ChatsTab.js` (modify) — добавить onPress
