# Dispatcher: messenger-staff-name-format

## Status

- Total: 1
- Completed: 1
- Current: none

## Tasks

| ID  | Name                                                      | Status    | Depends |
|-----|-----------------------------------------------------------|-----------|---------|
| 001 | Заменить formatName на formatShortName в ChatsTab         | completed | -       |

## Execution Log

**2026-01-24 - Task 001 completed:**
- Добавлен импорт `formatShortName` из `../../utils/formatName`
- Удалена локальная функция `formatName`
- Заменены все вызовы на `formatShortName(item)` в `handleOpenChat` и `renderItem`
- Файл: `src/screens/Messenger/ChatsTab.js`

---

## Branch

`feature/messenger-staff-name-format`

## Related Files

- `src/screens/Messenger/ChatsTab.js`
- `src/screens/Messenger/ChatScreen.js`
- `src/utils/formatName.js`
