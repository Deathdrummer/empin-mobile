# Кнопка "Аккаунт" в нижнем меню с всплывающим меню

## Meta
- Slug: account-menu-bottom-bar
- Branch: feature/account-menu-bottom-bar
- Created: 2026-01-17
- Status: in_progress

## Checkpoint
- Current: 3
- Last Updated: 2026-01-17T13:00:00Z

## Tasks
| # | File | Status | Title |
|---|------|--------|-------|
| 1 | 001-setup-navigation.md | done | Настроить React Navigation |
| 2 | 002-messenger-screen.md | done | Создать экран MessengerScreen |
| 3 | 003-update-bottom-menu.md | current | Обновить BottomMenu с кнопкой "Аккаунт" |
| 4 | 004-integrate-navigation.md | pending | Интегрировать навигацию в BottomMenu |
| 5 | 005-testing.md | pending | Тестирование функционала |

## Context
- Выбран: @expo/react-native-action-sheet (уже в проекте)
- Навигация: React Navigation Stack Navigator (уже установлен)
- Экран Мессенджера: заглушка с надписью
- Ключевые файлы:
  - src/components/BottomMenu.js
  - src/screens/Timesheet/index.js
  - App.js
  - src/screens/MessengerScreen.js (новый)
