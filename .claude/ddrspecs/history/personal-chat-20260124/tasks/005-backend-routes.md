---
id: 005
status: pending
depends: [004]
---

# Task: Добавление API роутов для мессенджера

## Goal
Зарегистрировать API endpoints для работы с личными чатами.

## Files
- `Z:\empin.loc\routes\api.php` (modify)

## Steps
1. Добавить группу роутов с middleware `auth:sanctum` и префиксом `messenger`:
   - `POST /api/messenger/chat` -> `MessengerApiController@getOrCreateChat`
   - `POST /api/messenger/chat/messages` -> `MessengerApiController@getMessages`
   - `POST /api/messenger/message` -> `MessengerApiController@addMessage`
   - `PUT /api/messenger/message/{id}` -> `MessengerApiController@updateMessage`
   - `DELETE /api/messenger/message/{id}` -> `MessengerApiController@removeMessage`
   - `POST /api/messenger/message/reaction` -> `MessengerApiController@toggleReaction`

2. Убедиться, что контроллер импортирован в начале файла

## Acceptance
- [ ] Все 6 роутов добавлены
- [ ] Роуты защищены middleware `auth:sanctum`
- [ ] Контроллер корректно импортирован
