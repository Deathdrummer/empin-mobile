---
id: 002
status: pending
depends: [001]
---

# Task: Создание моделей для личных чатов

## Goal
Создать Eloquent модели для работы с личными чатами и сообщениями.

## Files
- `Z:\empin.loc\app\Models\MessengerChat.php` (create)
- `Z:\empin.loc\app\Models\MessengerMessage.php` (create)

## Steps
1. Создать модель `MessengerChat`:
   - Таблица: `messenger_chats`
   - Отношения:
     - `messages()` - HasMany к MessengerMessage
     - `participant1()` - BelongsTo к Staff
     - `participant2()` - BelongsTo к Staff
   - Статический метод `getOrCreate(int $userId1, int $userId2)`:
     - Нормализует порядок участников (меньший ID в participant_1)
     - Возвращает существующий или создает новый чат

2. Создать модель `MessengerMessage`:
   - Таблица: `messenger_messages`
   - Casts: `reactions` => 'array', `media` => 'array'
   - Отношения:
     - `chat()` - BelongsTo к MessengerChat
     - `profile()` - BelongsTo к Staff (select sname, fname, mname)
     - `replyTo()` - BelongsTo к MessengerMessage
     - `replies()` - HasMany к MessengerMessage

## Acceptance
- [ ] Модель `MessengerChat` создана со всеми отношениями
- [ ] Модель `MessengerMessage` создана со всеми отношениями
- [ ] Метод `getOrCreate()` корректно нормализует участников
- [ ] JSON поля корректно кастятся
