# Отчет о проверке качества: Личный чат в мессенджере

**Дата проверки:** 2026-01-24
**Задача:** 008 - Тестирование и проверка качества
**Статус:** Обнаружены критические ошибки, требующие исправления

---

## 1. ОБЗОР ПРОВЕРКИ

### 1.1 Проверенные компоненты

**Backend (Laravel):**
- ✅ Миграции БД (`messenger_chats`, `messenger_messages`)
- ✅ Модели (`MessengerChat`, `MessengerMessage`)
- ✅ Resource (`MessengerMessageResource`)
- ✅ Контроллер (`MessengerApiController`)
- ✅ Роуты API (`routes/api/api.php`)

**Frontend (React Native):**
- ✅ API Service (`src/services/api.js`)
- ✅ ChatScreen (`src/screens/Messenger/ChatScreen.js`)
- ✅ ChatsTab (`src/screens/Messenger/ChatsTab.js`)
- ✅ Навигация (`App.js`)

---

## 2. КРИТИЧЕСКИЕ ОШИБКИ (БЛОКИРУЮЩИЕ)

### 2.1 ❌ Несоответствие формата ответа `getOrCreateChat`

**Проблема:**
- **Backend возвращает:** `{id: chatId}`
- **Frontend ожидает:** `{chat_id: chatId}`

**Где:**
- Backend: `Z:/empin.loc/app/Http/Controllers/api/MessengerApiController.php:29`
- Frontend: `z:/empin-mobile/src/screens/Messenger/ChatScreen.js:59`

**Последствия:**
Чат не будет инициализирован, приложение не сможет загрузить сообщения.

**Решение:**
Изменить ответ контроллера с `['id' => $chat->id]` на `['chat_id' => $chat->id]`

```php
// БЫЛО:
return response()->json(['id' => $chat->id]);

// ДОЛЖНО БЫТЬ:
return response()->json(['chat_id' => $chat->id]);
```

---

### 2.2 ❌ Несоответствие формата ответа `getMessages`

**Проблема:**
- **Backend возвращает:** Массив сообщений напрямую через `MessengerMessageResource::collection($messages)`
- **Frontend ожидает:** `{messages: [...]}`

**Где:**
- Backend: `Z:/empin.loc/app/Http/Controllers/api/MessengerApiController.php:50`
- Frontend: `z:/empin-mobile/src/screens/Messenger/ChatScreen.js:63,97,214`

**Последствия:**
Сообщения не будут отображаться, массив будет пустым.

**Решение:**
Обернуть ответ в объект с ключом `messages`:

```php
// БЫЛО:
return MessengerMessageResource::collection($messages);

// ДОЛЖНО БЫТЬ:
return response()->json([
    'messages' => MessengerMessageResource::collection($messages)
]);
```

---

## 3. РЕЗУЛЬТАТЫ ПРОВЕРКИ ПО КАТЕГОРИЯМ

### 3.1 ✅ Синтаксис и импорты

**Статус:** Все в порядке

**Проверено:**
- ✅ Все импорты в `ChatScreen.js` корректны
- ✅ Все компоненты (`ChatSection`, `BottomMenu`, `LogoutModal`) существуют
- ✅ Утилита `formatShortName` существует и корректна
- ✅ Экспорт `messengerAPI` в `api.js` присутствует
- ✅ Навигация в `App.js` настроена правильно

**Детали:**
```
✅ src/screens/Timesheet/components/ChatSection.js - существует (47.7 KB)
✅ src/components/BottomMenu.js - существует (7.0 KB)
✅ src/screens/Timesheet/components/modals/LogoutModal.js - существует (3.0 KB)
✅ src/utils/formatName.js - существует (734 bytes)
✅ ChatSection экспортируется как named export
```

---

### 3.2 ✅ Структура БД

**Статус:** Все в порядке

**Миграции:**
```
✅ 2026_01_24_124517_create_messenger_chats_table.php
✅ 2026_01_24_124520_create_messenger_messages_table.php
```

**Проверено:**
- ✅ Таблица `messenger_chats` с правильными foreign keys
- ✅ Уникальный индекс `unique_participants` для предотвращения дублирования чатов
- ✅ Таблица `messenger_messages` с JSON полями для `reactions` и `media`
- ✅ Каскадное удаление при удалении участника
- ✅ `reply_to_id` корректно настроен с `onDelete('set null')`

---

### 3.3 ✅ Модели Laravel

**Статус:** Все в порядке

**MessengerChat:**
- ✅ Метод `getOrCreate()` корректно нормализует порядок участников
- ✅ Отношения `participant1()`, `participant2()`, `messages()` настроены
- ✅ Использует traits `Filterable`, `Collectionable`

**MessengerMessage:**
- ✅ Кастинг `reactions` и `media` в `array`
- ✅ Отношения `chat()`, `profile()`, `replyTo()`, `replies()` настроены
- ✅ `profile()` загружает только необходимые поля: `id`, `sname`, `fname`, `mname`

---

### 3.4 ⚠️ Resource и форматирование данных

**Статус:** В целом хорошо, но есть замечания

**MessengerMessageResource:**
- ✅ Группировка реакций по emoji с подсчетом
- ✅ Определение `isOwn` для текущего пользователя
- ✅ Определение `self` (является ли автором)
- ✅ Обработка медиа с извлечением `name` из `path`
- ✅ Декодирование URL-encoded имен файлов

**⚠️ Замечание:**
- Используется `$request->user()->id` для группировки реакций (line 21)
- Используется `$request->user()->staff_id` для определения `self` (line 16)
- Это потенциально может вызвать несоответствие, если `user.id !== user.staff_id`

**Проверить:**
Убедиться, что в реакциях сохраняется правильный ID (должен быть `staff_id` или `user.id` - консистентно)

---

### 3.5 ✅ API Endpoints и роуты

**Статус:** Все в порядке

**Роуты:**
```php
✅ POST /api/messenger/chat -> getOrCreateChat
✅ POST /api/messenger/chat/messages -> getMessages
✅ POST /api/messenger/message -> addMessage
✅ PUT /api/messenger/message/{id} -> updateMessage
✅ DELETE /api/messenger/message/{id} -> removeMessage
✅ POST /api/messenger/message/reaction -> toggleReaction
```

**Middleware:**
- ✅ Все роуты защищены `auth:sanctum`

---

### 3.6 ✅ Контроллер MessengerApiController

**Статус:** В целом хорошо (кроме критических ошибок выше)

**getOrCreateChat:**
- ✅ Валидация `participant_id`
- ✅ Использование `MessengerChat::getOrCreate()`
- ❌ **КРИТИЧЕСКАЯ ОШИБКА:** Возвращает `{id: ...}` вместо `{chat_id: ...}`

**getMessages:**
- ✅ Валидация `chat_id`
- ✅ Загрузка отношений `profile.registred`, `replyTo`
- ✅ Сортировка по `created_at ASC`
- ❌ **КРИТИЧЕСКАЯ ОШИБКА:** Возвращает массив напрямую вместо `{messages: [...]}`

**addMessage:**
- ✅ Валидация всех полей
- ✅ Проверка наличия текста или медиа
- ✅ Сохранение медиа в `storage/app/public/messenger/messages/`
- ✅ Определение типа медиа по MIME (`image`, `video`, `audio`, `document`, `archive`)
- ✅ Сохранение `name`, `size`, `mime_type` для каждого медиа
- ✅ Загрузка отношения `profile.registred` перед возвратом

**updateMessage:**
- ✅ Проверка прав `mobile-app-can-edit-comment:site`
- ✅ Проверка авторства (`from_id === staff_id`)
- ✅ Валидация `message`
- ✅ Обработка 404 если сообщение не найдено

**removeMessage:**
- ✅ Проверка прав `mobile-app-can-delete-comment:site`
- ✅ Проверка авторства
- ✅ Удаление медиа файлов из storage
- ✅ Обработка старого и нового формата медиа (массив или объект)

**toggleReaction:**
- ✅ Валидация `message_id` и `emoji`
- ✅ Toggle логика (добавить если нет, удалить если есть)
- ⚠️ Использует `$request->user()->id` - проверить консистентность с Resource

---

### 3.7 ✅ Frontend API Service

**Статус:** Все в порядке

**messengerAPI методы:**
- ✅ `getOrCreateChat(participantId)` - POST `/messenger/chat`
- ✅ `getMessages(chatId)` - POST `/messenger/chat/messages`
- ✅ `addMessage(chatId, message, replyToId, mediaArray)` - POST `/messenger/message`
- ✅ `updateMessage(id, message)` - PUT `/messenger/message/{id}`
- ✅ `removeMessage(id)` - DELETE `/messenger/message/{id}`
- ✅ `addReaction(messageId, emoji)` - POST `/messenger/message/reaction`
- ✅ `removeReaction(messageId, emoji)` - POST `/messenger/message/reaction`

**Проверено:**
- ✅ FormData используется для отправки медиа
- ✅ MIME типы определяются по расширению файла
- ✅ Поддержка всех типов файлов (изображения, видео, документы, архивы, аудио)
- ✅ Параметры корректно передаются в body/formData

---

### 3.8 ✅ ChatScreen компонент

**Статус:** Все в порядке (кроме зависимости от критических ошибок backend)

**State:**
- ✅ Все необходимые state переменные объявлены
- ✅ Использование `useCallback` для оптимизации

**Lifecycle:**
- ✅ Загрузка текущего пользователя из AsyncStorage
- ✅ Инициализация чата при монтировании
- ✅ Автоскролл к новым сообщениям

**Обработчики:**
- ✅ `handleAddMessage` - отправка с медиа
- ✅ `handleDeleteMessage` - удаление с try/catch
- ✅ `handleEditMessage` - редактирование и сохранение
- ✅ `handleReplyMessage` - установка replyingToComment
- ✅ `handleToggleReaction` - добавление/удаление + обновление списка
- ✅ `handleRefresh` - pull-to-refresh

**UI/UX:**
- ✅ `KeyboardAvoidingView` для iOS
- ✅ `RefreshControl` для обновления
- ✅ `ScrollView` с автоскроллом
- ✅ Header с кнопкой назад и именем собеседника
- ✅ BottomMenu с навигацией

**Обработка ошибок:**
- ✅ Все API вызовы обернуты в try/catch
- ✅ Toast уведомления при ошибках
- ✅ Обработка отсутствия `staffId`

---

### 3.9 ✅ ChatsTab компонент

**Статус:** Все в порядке

**Проверено:**
- ✅ Загрузка списка сотрудников через `timesheetAPI.getAllStaff()`
- ✅ Pull-to-refresh
- ✅ Навигация в чат с передачей `staffId` и `staffName`
- ✅ Использование `formatShortName` для отображения имен
- ✅ Аватары с первой буквой фамилии
- ✅ Обработка пустого списка

---

### 3.10 ✅ Навигация

**Статус:** Все в порядке

**Проверено:**
- ✅ Route `Chat` добавлен в `App.js`
- ✅ Импорт `ChatScreen` присутствует
- ✅ Навигация из `ChatsTab` в `ChatScreen` корректна
- ✅ Передача параметров `staffId` и `staffName`

---

## 4. СПИСОК ВСЕХ СОЗДАННЫХ/ИЗМЕНЕННЫХ ФАЙЛОВ

### 4.1 Backend (Laravel)

**Созданные файлы:**
```
✅ Z:/empin.loc/database/migrations/2026_01_24_124517_create_messenger_chats_table.php
✅ Z:/empin.loc/database/migrations/2026_01_24_124520_create_messenger_messages_table.php
✅ Z:/empin.loc/app/Models/MessengerChat.php
✅ Z:/empin.loc/app/Models/MessengerMessage.php
✅ Z:/empin.loc/app/Http/Resources/MessengerMessageResource.php
✅ Z:/empin.loc/app/Http/Controllers/api/MessengerApiController.php
```

**Измененные файлы:**
```
✅ Z:/empin.loc/routes/api/api.php (добавлены роуты для мессенджера)
```

### 4.2 Frontend (React Native)

**Измененные файлы:**
```
✅ z:/empin-mobile/src/services/api.js (добавлен messengerAPI)
✅ z:/empin-mobile/src/screens/Messenger/ChatScreen.js (полностью переработан)
✅ z:/empin-mobile/App.js (добавлен импорт и роут Chat)
```

**Используемые существующие компоненты:**
```
✅ z:/empin-mobile/src/screens/Timesheet/components/ChatSection.js
✅ z:/empin-mobile/src/components/BottomMenu.js
✅ z:/empin-mobile/src/screens/Timesheet/components/modals/LogoutModal.js
✅ z:/empin-mobile/src/utils/formatName.js
```

---

## 5. ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ (НЕ КРИТИЧНЫЕ)

### 5.1 ⚠️ Несоответствие ID в реакциях

**Проблема:**
- В `MessengerMessageResource` для группировки реакций используется `$request->user()->id` (line 21)
- Для определения `self` используется `$request->user()->staff_id` (line 16)
- В `toggleReaction` контроллера сохраняется `$request->user()->id` (line 262)

**Потенциальные последствия:**
Если `user.id !== user.staff_id`, то может возникнуть несоответствие при проверке "своих" реакций.

**Рекомендация:**
Использовать `staff_id` консистентно во всех местах или убедиться, что `user.id === user.staff_id`.

---

### 5.2 ⚠️ Обновление всех сообщений при изменении реакции

**Проблема:**
В `ChatScreen.handleToggleReaction` после добавления/удаления реакции выполняется полная перезагрузка всех сообщений:

```javascript
const messagesData = await messengerAPI.getMessages(chatId);
setMessages(messagesData.messages || []);
```

**Последствия:**
- Лишний сетевой запрос
- Потеря позиции скролла (возможно)

**Рекомендация:**
Обновлять только реакции для конкретного сообщения в локальном state:

```javascript
const response = await messengerAPI.addReaction(messageId, emoji);
setMessages(prev => prev.map(msg =>
  msg.id === messageId
    ? { ...msg, reactions: response.reactions }
    : msg
));
```

**Примечание:** Для этого контроллер `toggleReaction` должен возвращать отформатированные реакции через Resource.

---

### 5.3 ⚠️ Отсутствие индикатора загрузки при инициализации чата

**Проблема:**
В `ChatScreen` есть state `loading`, но он не используется в render.

**Рекомендация:**
Показывать `ActivityIndicator` пока `loading === true`:

```javascript
if (loading) {
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </SafeAreaView>
  );
}
```

---

## 6. ТРЕБУЕМЫЕ ИСПРАВЛЕНИЯ

### Критические (ОБЯЗАТЕЛЬНО):

1. **MessengerApiController::getOrCreateChat** - изменить ответ на `{chat_id: ...}`
2. **MessengerApiController::getMessages** - обернуть ответ в `{messages: [...]}`

### Рекомендуемые (ЖЕЛАТЕЛЬНО):

3. Использовать консистентно `staff_id` для реакций
4. Оптимизировать обновление реакций (не перезагружать все сообщения)
5. Добавить индикатор загрузки при инициализации чата

---

## 7. ИНСТРУКЦИИ ДЛЯ РУЧНОГО ТЕСТИРОВАНИЯ

### 7.1 После исправления критических ошибок

1. **Запустить миграции на сервере:**
   ```bash
   php artisan migrate
   ```

2. **Проверить создание таблиц:**
   ```sql
   SHOW TABLES LIKE 'messenger_%';
   DESC messenger_chats;
   DESC messenger_messages;
   ```

3. **Запустить приложение на BlueStacks**

4. **Тесты инициализации:**
   - ✅ Открыть раздел "Мессенджер"
   - ✅ Перейти на вкладку "Чаты"
   - ✅ Нажать на любого сотрудника
   - ✅ Проверить, что открылся ChatScreen с именем собеседника в header

5. **Тесты отправки сообщений:**
   - ✅ Ввести текстовое сообщение и отправить
   - ✅ Проверить, что сообщение появилось в чате
   - ✅ Отправить сообщение с 1 изображением
   - ✅ Отправить сообщение с несколькими изображениями
   - ✅ Отправить сообщение с видео
   - ✅ Отправить сообщение с документом
   - ✅ Отправить сообщение с аудио

6. **Тесты pull-to-refresh:**
   - ✅ Потянуть список сообщений вниз
   - ✅ Проверить, что сообщения обновились

7. **Тесты ответа на сообщение:**
   - ✅ Долгое нажатие на сообщение
   - ✅ Выбрать "Ответить"
   - ✅ Ввести текст и отправить
   - ✅ Проверить, что показывается цитата исходного сообщения

8. **Тесты редактирования:**
   - ✅ Долгое нажатие на свое сообщение
   - ✅ Выбрать "Редактировать"
   - ✅ Изменить текст и сохранить
   - ✅ Проверить, что текст обновился

9. **Тесты удаления:**
   - ✅ Долгое нажатие на свое сообщение
   - ✅ Выбрать "Удалить"
   - ✅ Проверить, что сообщение удалилось
   - ✅ Если было медиа - проверить, что файлы удалились из storage

10. **Тесты реакций:**
    - ✅ Двойное нажатие на сообщение
    - ✅ Выбрать эмодзи
    - ✅ Проверить, что реакция появилась
    - ✅ Повторно нажать на ту же реакцию
    - ✅ Проверить, что реакция удалилась

11. **Тесты прав доступа:**
    - ✅ Попытаться отредактировать чужое сообщение (должна быть ошибка)
    - ✅ Попытаться удалить чужое сообщение (должна быть ошибка)

12. **Тесты обработки ошибок:**
    - ✅ Выключить сервер и попытаться отправить сообщение
    - ✅ Проверить, что показывается Toast с ошибкой
    - ✅ Включить сервер и проверить восстановление

13. **Тесты KeyboardAvoidingView (iOS):**
    - ✅ Открыть клавиатуру
    - ✅ Проверить, что поле ввода поднимается над клавиатурой

14. **Тесты автоскролла:**
    - ✅ Отправить несколько сообщений
    - ✅ Проверить, что чат автоматически прокручивается к последнему сообщению

---

## 8. ЧЕКЛИСТ ACCEPTANCE CRITERIA

Из задачи 008:

- [x] Код проверен на синтаксические ошибки
- [x] Все импорты корректны
- [x] API интеграция соответствует backend (с учетом найденных критических ошибок)
- [x] Обработка ошибок присутствует
- [x] UI компоненты правильно интегрированы
- [x] Отчет с результатами проверки создан

---

## 9. ИТОГОВАЯ ОЦЕНКА

**Общая оценка:** 85/100

**Сильные стороны:**
- ✅ Четкая архитектура с разделением ответственности
- ✅ Полная обработка ошибок с Toast уведомлениями
- ✅ Правильное использование существующих компонентов (ChatSection)
- ✅ Корректная структура БД с правильными foreign keys
- ✅ Поддержка всех типов медиа
- ✅ Реализация всех функций (ответы, редактирование, удаление, реакции)

**Слабые стороны:**
- ❌ 2 критические ошибки в формате ответов контроллера
- ⚠️ Несоответствие использования `user.id` vs `staff_id` в реакциях
- ⚠️ Неоптимальное обновление реакций (полная перезагрузка)
- ⚠️ Отсутствие индикатора загрузки

**Вывод:**
После исправления двух критических ошибок функционал будет полностью работоспособен. Рекомендуется также устранить некритичные проблемы для улучшения производительности и UX.

---

**Отчет составлен:** 2026-01-24
**Проверка выполнена:** Статический анализ кода + проверка соответствия спецификации
**Следующий шаг:** Исправление критических ошибок в backend контроллере
