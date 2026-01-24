---
id: 003
status: pending
depends: [002]
---

# Task: Добавить onPress в ChatsTab

## Goal
При тапе на плашку сотрудника — navigate('Chat', { staffId, staffName }).

## Files
- `src/screens/Messenger/ChatsTab.js` (modify)

## Steps
1. Импортировать useNavigation
2. Обернуть View в TouchableOpacity
3. onPress → navigation.navigate('Chat', { staffId: item.id, staffName: formatName(item) })

## Acceptance
- [ ] Плашка тапабельна
- [ ] При тапе открывается ChatScreen
- [ ] Имя собеседника передаётся
