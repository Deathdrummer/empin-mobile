---
id: 007
status: pending
depends: [006]
---

# Task: Реализация функционала ChatScreen

## Goal
Интегрировать API и компонент ChatSection в ChatScreen для работы личного чата.

## Files
- `/z/empin-mobile/src/screens/Messenger/ChatScreen.js` (modify)

## Steps
1. Добавить импорты:
   - `useState`, `useEffect`, `useCallback` из React
   - `ScrollView`, `RefreshControl`, `KeyboardAvoidingView`, `Platform`
   - `messengerAPI` из `../../services/api`
   - `ChatSection` из `../Timesheet/components/ChatSection`
   - `Toast` для уведомлений

2. Добавить state:
   - `chatId` - ID чата
   - `messages` - массив сообщений
   - `commentText` - текст нового сообщения
   - `replyingToComment` - сообщение для ответа
   - `editingComment` - редактируемое сообщение
   - `deletingComment` - ID удаляемого сообщения
   - `loading` - индикатор загрузки
   - `refreshing` - индикатор обновления

3. Реализовать `useEffect` при монтировании:
   - Вызвать `messengerAPI.getOrCreateChat(staffId)`
   - Сохранить `chatId`
   - Вызвать `messengerAPI.getMessages(chatId)`
   - Установить `messages`
   - Обработать ошибки через Toast

4. Реализовать `handleRefresh`:
   - Повторный вызов `messengerAPI.getMessages(chatId)`
   - Обновить `messages`

5. Реализовать `handleAddMessage(mediaArray)`:
   - Вызвать `messengerAPI.addMessage(chatId, commentText, replyToId, mediaArray)`
   - Добавить новое сообщение в `messages`
   - Очистить `commentText` и `replyingToComment`
   - Обработать ошибки

6. Реализовать `handleDeleteMessage(messageId)`:
   - Установить `deletingComment = messageId`
   - Вызвать `messengerAPI.removeMessage(messageId)`
   - Удалить сообщение из `messages`
   - Сбросить `deletingComment`
   - Обработать ошибки

7. Реализовать `handleEditMessage(message)`:
   - Если `editingComment` уже установлен:
     - Вызвать `messengerAPI.updateMessage(editingComment.id, commentText)`
     - Обновить сообщение в `messages`
     - Очистить `editingComment` и `commentText`
   - Иначе:
     - Установить `editingComment = message`
     - Установить `commentText = message.message`

8. Реализовать `handleReplyMessage(message)`:
   - Установить `replyingToComment = message`

9. Реализовать `handleToggleReaction(messageId, emoji, hasReacted)`:
   - Если `hasReacted` - вызвать `removeReaction(messageId, emoji)`
   - Иначе - вызвать `addReaction(messageId, emoji)`
   - Обновить `reactions` для сообщения в `messages`

10. Реализовать `handleCommentChange(text)`:
    - Установить `commentText = text`

11. Реализовать `handleCancelReply()`:
    - Очистить `replyingToComment`

12. Обернуть контент в `KeyboardAvoidingView` для iOS:
    - `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`

13. Обернуть сообщения в `ScrollView` с `RefreshControl`:
    - `refreshing={refreshing}`
    - `onRefresh={handleRefresh}`
    - Автоскролл вниз при новых сообщениях

14. Интегрировать `ChatSection`:
    - Передать все state и handlers
    - Обернуть в `View` с правильными стилями

## Acceptance
- [ ] ChatScreen загружает и отображает сообщения
- [ ] Pull-to-refresh обновляет список сообщений
- [ ] Отправка текстовых сообщений работает
- [ ] Отправка медиа работает
- [ ] Ответы на сообщения работают
- [ ] Редактирование работает
- [ ] Удаление работает
- [ ] Реакции добавляются/удаляются
- [ ] Клавиатура корректно взаимодействует с экраном
- [ ] Автоскролл к новым сообщениям работает
- [ ] Ошибки отображаются через Toast
