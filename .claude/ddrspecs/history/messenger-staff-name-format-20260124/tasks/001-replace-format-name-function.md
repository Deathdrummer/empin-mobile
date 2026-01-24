---
id: 001
status: completed
depends: []
---

# Task: Заменить локальную функцию formatName на утилиту formatShortName в ChatsTab

## Goal

Использовать существующую утилиту `formatShortName()` для форматирования имен сотрудников в списке чатов, чтобы обеспечить единый формат отображения "Фамилия И.О." во всем приложении.

## Files

- `src/screens/Messenger/ChatsTab.js` (modify)

## Steps

1. Добавить импорт утилиты `formatShortName`:
   ```javascript
   import { formatShortName } from '../../utils/formatName';
   ```

2. Удалить локальную функцию `formatName`:
   ```javascript
   // УДАЛИТЬ:
   const formatName = (item) => {
     return [item.sname, item.fname, item.mname].filter(Boolean).join(' ');
   };
   ```

3. Заменить все вызовы `formatName(item)` на `formatShortName(item)`:
   - В функции `handleOpenChat`:
     ```javascript
     staffName: formatShortName(item),
     ```
   - В компоненте `renderItem`:
     ```javascript
     <Text style={styles.name}>{formatShortName(item)}</Text>
     ```

## Acceptance

- [x] Импортирована утилита `formatShortName`
- [x] Удалена локальная функция `formatName`
- [x] Все вызовы заменены на `formatShortName(item)`
- [x] Код компилируется без ошибок
- [x] В списке чатов имена отображаются в формате "Фамилия И.О."
- [x] В экране чата имя в заголовке отображается корректно

## Notes

- Утилита `formatShortName` уже используется в `TeamCard.js`, поэтому это безопасное изменение
- Функция принимает объект с полями `{ sname, fname, mname }` - точно такой же, как используется в `formatName`
- Изменения в `ChatScreen.js` не требуются, так как он получает уже отформатированное имя через `route.params.staffName`
