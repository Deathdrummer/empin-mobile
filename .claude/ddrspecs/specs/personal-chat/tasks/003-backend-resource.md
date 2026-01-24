---
id: 003
status: pending
depends: [002]
---

# Task: Создание Resource для форматирования сообщений

## Goal
Создать API Resource для унифицированного форматирования сообщений.

## Files
- `Z:\empin.loc\app\Http\Resources\MessengerMessageResource.php` (create)

## Steps
1. Создать `MessengerMessageResource`:
   - Наследуется от `JsonResource`
   - Метод `toArray($request)` возвращает:
     - `id` - ID сообщения
     - `chat_id` - ID чата
     - `from` - объект с данными отправителя (sname, fname, mname)
     - `message` - текст сообщения
     - `reply_to_id` - ID сообщения для ответа
     - `reactions` - массив реакций
     - `media` - массив медиа
     - `self` - boolean (текущий пользователь = автор)
     - `created_at` - ISO8601 строка
     - `updated_at` - ISO8601 строка

2. Определение `self`:
   - Сравнить `from_id` сообщения с `$request->user()->staff_id`

## Acceptance
- [ ] Resource создан и корректно форматирует данные
- [ ] Поле `self` корректно определяется
- [ ] Даты форматируются в ISO8601
- [ ] Данные профиля загружаются из отношения
