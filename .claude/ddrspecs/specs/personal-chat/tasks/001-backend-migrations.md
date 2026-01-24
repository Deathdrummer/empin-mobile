---
id: 001
status: pending
depends: []
---

# Task: Создание миграций БД для личных чатов

## Goal
Создать структуру базы данных для хранения личных чатов и сообщений.

## Files
- `Z:\empin.loc\database\migrations\YYYY_MM_DD_HHMMSS_create_messenger_chats_table.php` (create)
- `Z:\empin.loc\database\migrations\YYYY_MM_DD_HHMMSS_create_messenger_messages_table.php` (create)

## Steps
1. Создать миграцию для таблицы `messenger_chats`:
   - `id` - BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
   - `participant_1_id` - BIGINT UNSIGNED NOT NULL (FK на staff)
   - `participant_2_id` - BIGINT UNSIGNED NOT NULL (FK на staff)
   - `created_at`, `updated_at` - TIMESTAMP
   - Уникальный индекс на пару `(participant_1_id, participant_2_id)`
   - Индексы на `participant_1_id` и `participant_2_id`
   - Foreign keys с CASCADE DELETE

2. Создать миграцию для таблицы `messenger_messages`:
   - `id` - BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
   - `chat_id` - BIGINT UNSIGNED NOT NULL (FK на messenger_chats)
   - `from_id` - BIGINT UNSIGNED NOT NULL (FK на staff)
   - `message` - LONGTEXT NULL
   - `reply_to_id` - BIGINT UNSIGNED NULL (FK на messenger_messages)
   - `reactions` - JSON NULL
   - `media` - JSON NULL
   - `created_at`, `updated_at` - TIMESTAMP
   - Индекс на `chat_id`
   - Foreign keys (CASCADE DELETE для chat_id, SET NULL для reply_to_id)

3. Применить миграции локально через Artisan:
   - `/c/laragon/bin/php/php.cmd artisan migrate`

## Acceptance
- [ ] Миграция `create_messenger_chats_table` создана
- [ ] Миграция `create_messenger_messages_table` создана
- [ ] Миграции применяются без ошибок
- [ ] Все индексы и внешние ключи созданы корректно
- [ ] Таблицы существуют в БД
