---
id: 004
status: pending
depends: [003]
---

# Task: Создание API контроллера для мессенджера

## Goal
Реализовать API endpoints для работы с личными чатами.

## Files
- `Z:\empin.loc\app\Http\Controllers\api\MessengerApiController.php` (create)

## Steps
1. Создать `MessengerApiController extends Controller`

2. Реализовать метод `getOrCreateChat(Request $request)`:
   - Валидация: `participant_id` (required|integer)
   - Получить `staff_id` текущего пользователя
   - Вызвать `MessengerChat::getOrCreate($currentUserId, $participantId)`
   - Вернуть `{id: chatId}`

3. Реализовать метод `getMessages(Request $request)`:
   - Валидация: `chat_id` (required|integer)
   - Загрузить сообщения с отношениями: `profile.registred`, `replyTo`
   - Сортировка: `created_at ASC`
   - Вернуть через `MessengerMessageResource::collection()`

4. Реализовать метод `addMessage(Request $request)`:
   - Валидация:
     - `chat_id` (required|integer)
     - `message` (nullable|string)
     - `reply_to_id` (nullable|integer)
     - `media[]` (nullable|array, files)
   - Проверить: хотя бы `message` или `media` должны быть
   - Обработать медиафайлы (сохранение в `messenger/messages/`)
   - Создать сообщение с `from_id` = текущий пользователь
   - Вернуть через `MessengerMessageResource`

5. Реализовать метод `updateMessage(Request $request, $id)`:
   - Валидация: `message` (required|string)
   - Проверить права: `mobile-app-can-edit-comment:site`
   - Проверить: автор = текущий пользователь
   - Обновить сообщение
   - Вернуть через `MessengerMessageResource`

6. Реализовать метод `removeMessage($id)`:
   - Проверить права: `mobile-app-can-delete-comment:site`
   - Проверить: автор = текущий пользователь
   - Удалить медиафайлы из storage
   - Удалить сообщение
   - Вернуть `{success: true}`

7. Реализовать метод `toggleReaction(Request $request)`:
   - Валидация: `message_id` (required|integer), `emoji` (required|string)
   - Загрузить сообщение
   - Логика аналогична `TimesheetApiController::toggleReaction()`:
     - Если реакция уже есть - удалить
     - Иначе - добавить
   - Сохранить и вернуть `{reactions: []}`

## Acceptance
- [ ] Все 6 методов реализованы
- [ ] Валидация работает корректно
- [ ] Права доступа проверяются
- [ ] Медиафайлы сохраняются в правильную директорию
- [ ] Ошибки обрабатываются с правильными HTTP кодами
