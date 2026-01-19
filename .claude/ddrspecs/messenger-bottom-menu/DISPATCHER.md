# Добавить нижнее меню в Мессенджер

## Meta
- Slug: messenger-bottom-menu
- Branch: feature/messenger-bottom-menu
- Created: 2026-01-17
- Status: done
- Completed: 2026-01-19

## Checkpoint
- Current: 3
- Last Updated: 2026-01-17T13:00:00.000Z

## Tasks
| # | File | Status | Title |
|---|------|--------|-------|
| 1 | 001-modify-bottom-menu.md | done | Модифицировать BottomMenu с условными пропсами |
| 2 | 002-integrate-menu.md | done | Интегрировать BottomMenu в MessengerScreen |
| 3 | 003-test-functionality.md | done | Тестирование функционала |

## Context
- Выбран подход: Условные пропсы showCalendar/showFilter
- Структура меню: 4 позиции (3 пустых + Аккаунт)
- Action sheet: активный раздел отмечен ✓ и отключен
- Ключевые файлы:
  - src/components/BottomMenu.js
  - src/screens/MessengerScreen.js
  - src/screens/Timesheet/index.js (референс)
