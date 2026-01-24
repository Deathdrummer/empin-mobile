---
id: 006
status: pending
depends: [005]
---

# Task: Расширение API сервиса для мессенджера

## Goal
Добавить методы для работы с личными чатами в frontend API service.

## Files
- `/z/empin-mobile/src/services/api.js` (modify)

## Steps
1. Добавить объект `messengerAPI` после `timesheetAPI`:

2. Реализовать метод `getOrCreateChat(participantId)`:
   - POST запрос `/messenger/chat`
   - Тело: `{participant_id: participantId}`
   - Возврат: `response.data` (объект с `id`)

3. Реализовать метод `getMessages(chatId)`:
   - POST запрос `/messenger/chat/messages`
   - Тело: `{chat_id: chatId}`
   - Возврат: `response.data` (массив сообщений)

4. Реализовать метод `addMessage(chatId, message, replyToId, mediaArray)`:
   - Аналогично `timesheetAPI.addComment()`:
     - Если есть медиа - FormData с `multipart/form-data`
     - Иначе - JSON
   - POST запрос `/messenger/message`
   - Поля: `chat_id`, `message`, `reply_to_id` (optional), `media[]` (files)
   - Возврат: `response.data` (новое сообщение)

5. Реализовать метод `updateMessage(id, message)`:
   - PUT запрос `/messenger/message/{id}`
   - Тело: `{message}`
   - Возврат: `response.data`

6. Реализовать метод `removeMessage(id)`:
   - DELETE запрос `/messenger/message/{id}`
   - Возврат: `response.data`

7. Реализовать методы для реакций:
   - `addReaction(messageId, emoji)` - POST `/messenger/message/reaction`
   - `removeReaction(messageId, emoji)` - POST `/messenger/message/reaction` (тот же endpoint)
   - Тело: `{message_id, emoji}`

8. Экспортировать `messengerAPI` вместе с другими API

## Acceptance
- [ ] Объект `messengerAPI` создан и экспортирован
- [ ] Все 7 методов реализованы
- [ ] Метод `addMessage` корректно обрабатывает медиа через FormData
- [ ] Метод `addMessage` корректно определяет MIME типы
- [ ] Код следует паттернам существующего `timesheetAPI`
