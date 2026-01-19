# Полная переделка навигации (нижняя панель меню)

## Meta
- Slug: bottom-navigation-redesign
- Branch: feature/bottom-navigation-redesign
- Created: 2026-01-19
- Status: in_progress

## Checkpoint
- Current: 3
- Last Updated: 2026-01-19T19:50:00.000Z
- Last Action: Решена проблема - уменьшено расстояние между иконкой и текстом в меню "Выйти" (иконка обёрнута в View)

## Tasks
| # | File | Status | Title |
|---|------|--------|-------|
| 1 | 001-refactor-bottom-menu-structure.md | done | Рефакторинг структуры BottomMenu |
| 2 | 002-implement-dots-menu.md | done | Реализация popup меню для кнопки "три точки" |
| 3 | 003-implement-section-switch.md | current | Реализация динамической правой кнопки переключения раздела |
| 4 | 004-integrate-timesheet.md | pending | Интеграция средних кнопок для раздела "План-график работ" |
| 5 | 005-integrate-messenger.md | pending | Интеграция средних кнопок для раздела "Мессенджер" |
| 6 | 006-testing.md | pending | Тестирование и финальная проверка |

## Context
- Выбрано: ActionSheet для меню "три точки" (уже используется в проекте)
- Навигация: React Navigation с плавными переходами
- Структура: 4 позиции (фиксированные крайние + динамические средние)
- Ключевые файлы:
  - src/components/BottomMenu.js
  - src/screens/MessengerScreen.js
  - src/screens/Timesheet/index.js
  - App.js
