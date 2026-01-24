---
task-id: 001-chats-tab-component
status: pending
dependencies: []
---

# Task: Создать компонент ChatsTab

## Goal
Создать компонент для отображения списка сотрудников в разделе "Чаты"

## Implementation Steps

1. Создать файл `src/screens/Messenger/ChatsTab.js`
2. Использовать `timesheetAPI.getStaff()` для загрузки данных
3. Отобразить список через FlatList
4. Показать ФИО сотрудника (sname fname mname)
5. Добавить индикатор загрузки и pull-to-refresh

## Files to Create
- `src/screens/Messenger/ChatsTab.js`

## Acceptance Criteria
- [ ] Список сотрудников загружается при монтировании
- [ ] Отображается loading state
- [ ] Работает pull-to-refresh
- [ ] ФИО форматируется корректно
