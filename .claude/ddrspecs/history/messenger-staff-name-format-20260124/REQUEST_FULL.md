# Полная история запроса

## Исходный запрос

В разделе "план-график работ" название бригады - это имя сотрудника, но в формате Фамилия И.О.

**Задача:** В разделе "мессенджер -> чаты" и в чате с конкретным пользователем - сделать вывод списка имен в таком же формате.

## Контекст проекта

- React Native приложение
- Раздел мессенджера: `src/components/messenger/`
- Раздел план-график работ: `src/components/timesheets/`

## Анализ кодовой базы

### Формат имени в плане-график работ

**Файл:** `src/utils/formatName.js`

Используется утилита `formatShortName()`:
```javascript
export const formatShortName = (person) => {
  if (!person || !person.sname) return 'Без имени';

  const firstNameInitial = person.fname ? person.fname.charAt(0) + '.' : '';
  const middleNameInitial = person.mname ? person.mname.charAt(0) + '.' : '';

  return `${person.sname} ${firstNameInitial}${middleNameInitial}`.trim();
};
```

**Используется в:** `src/screens/Timesheet/components/TeamCard.js`
```javascript
const masterName = formatShortName(team.master);
```

### Формат имени в мессенджере

**Файл:** `src/screens/Messenger/ChatsTab.js`

Текущая реализация:
```javascript
const formatName = (item) => {
  return [item.sname, item.fname, item.mname].filter(Boolean).join(' ');
};
```

Результат: "Фамилия Имя Отчество"

**Файл:** `src/screens/Messenger/ChatScreen.js`

Получает имя через route params:
```javascript
const { staffName = 'Собеседник' } = route.params || {};
```

## Решение

Использовать существующую утилиту `formatShortName()` в компонентах мессенджера вместо локальной функции `formatName()`.

## Уточнений не требуется

Задача ясна, решение очевидно.
