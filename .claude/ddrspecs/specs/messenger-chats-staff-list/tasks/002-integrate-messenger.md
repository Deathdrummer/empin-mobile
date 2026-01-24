---
task-id: 002-integrate-messenger
status: pending
dependencies: [001-chats-tab-component]
---

# Task: Интегрировать ChatsTab в MessengerScreen

## Goal
Заменить заглушку в MessengerScreen на реальный компонент ChatsTab

## Implementation Steps

1. Импортировать ChatsTab в MessengerScreen
2. Заменить заглушку в case 'chats' на <ChatsTab />
3. Протестировать переключение вкладок

## Files to Modify
- `src/screens/MessengerScreen.js`

## Acceptance Criteria
- [ ] ChatsTab отображается при activeTab === 'chats'
- [ ] Переключение на "История звонков" работает
- [ ] Нет ошибок в консоли
