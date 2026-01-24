# Полное описание запроса

## Описание задачи
В разделе "Мессенджер" в подразделе "Чаты" мы можем провалиться в чат с конкретным пользователем. Сейчас там просто заглушка. Необходимо реализовать полностью работающий функционал личного чата.

## Текущее состояние

### Фронтенд
1. **ChatsTab.js** (`/z/empin-mobile/src/screens/Messenger/ChatsTab.js`)
   - Отображает список всех сотрудников
   - При клике открывает ChatScreen с параметрами: `staffId`, `staffName`

2. **ChatScreen.js** (`/z/empin-mobile/src/screens/Messenger/ChatScreen.js`)
   - Заглушка с минимальным UI
   - Отображает имя собеседника в заголовке
   - Нет функционала чата

3. **ChatSection.js** (`/z/empin-mobile/src/screens/Timesheet/components/ChatSection.js`)
   - Полнофункциональный компонент группового чата
   - Поддерживает:
     - Текстовые сообщения
     - Медиа (фото/видео через MediaCollage)
     - Аудио сообщения (AudioPlayer)
     - Документы (DocumentList)
     - Реакции на сообщения (EmojiPicker)
     - Ответы на сообщения (reply)
     - Редактирование своих сообщений
     - Удаление сообщений
     - Двойной тап для редактирования
     - Долгое нажатие для контекстного меню

### Бэкенд
1. **TimesheetApiController.php** (`Z:\empin.loc\app\Http\Controllers\api\TimesheetApiController.php`)
   - Методы для работы с групповыми чатами:
     - `addComment()` - добавление комментария с медиа
     - `updateComment()` - редактирование
     - `removeComment()` - удаление
     - `toggleReaction()` - добавление/удаление реакций

2. **TimesheetChat** модель (`Z:\empin.loc\app\Models\TimesheetChat.php`)
   - Таблица: `timesheet_chat`
   - Поля: `id`, `timesheet_contract_id`, `from_id`, `message`, `reply_to_id`, `reactions`, `media`, `created_at`, `updated_at`
   - Связан с `timesheet_contract_id` (групповой чат объекта)

## Требования

### Функциональные требования
1. Личный чат должен иметь ВСЕ возможности группового чата:
   - Отправка текстовых сообщений
   - Прикрепление медиа (фото, видео)
   - Запись и отправка голосовых сообщений
   - Прикрепление документов
   - Реакции на сообщения (👍, 👎, ❤️, 🔥, 👀)
   - Ответы на сообщения (reply)
   - Редактирование своих сообщений (двойной тап)
   - Удаление сообщений
   - Контекстное меню (долгое нажатие)
   - Копирование текста сообщения

2. Разделение сообщений:
   - Сообщения от текущего пользователя справа
   - Сообщения от собеседника слева

3. Отображение статуса сообщения:
   - Автор и время отправки
   - Отметка "изменено" для редактированных

### Технические требования

#### База данных
1. Создать отдельную таблицу `messenger_chats`:
   - `id` - первичный ключ
   - `participant_1_id` - ID первого участника (меньший ID)
   - `participant_2_id` - ID второго участника (больший ID)
   - `created_at`, `updated_at` - временные метки
   - Уникальный индекс на пару `(participant_1_id, participant_2_id)`

2. Создать таблицу `messenger_messages`:
   - `id` - первичный ключ
   - `chat_id` - внешний ключ на `messenger_chats`
   - `from_id` - ID отправителя (ссылка на `staff`)
   - `message` - текст сообщения (longText, nullable)
   - `reply_to_id` - ID сообщения, на которое отвечают (nullable)
   - `reactions` - JSON массив реакций (nullable)
   - `media` - JSON массив медиафайлов (nullable)
   - `created_at`, `updated_at` - временные метки
   - Индекс на `chat_id`
   - Внешний ключ на `messenger_chats` с каскадным удалением

#### Backend API
1. Создать контроллер `MessengerApiController.php`:
   - `getOrCreateChat(Request $request)` - получить или создать чат между двумя пользователями
   - `getMessages(Request $request)` - получить сообщения чата
   - `addMessage(Request $request)` - отправить сообщение
   - `updateMessage(Request $request, $id)` - редактировать сообщение
   - `removeMessage($id)` - удалить сообщение
   - `toggleReaction(Request $request)` - добавить/удалить реакцию

2. Создать модели:
   - `MessengerChat.php`
   - `MessengerMessage.php`

3. Создать ресурс `MessengerMessageResource.php` для форматирования ответов

4. Добавить роуты в `api.php`

#### Frontend API
1. Расширить `src/services/api.js`:
   - `messengerAPI.getOrCreateChat(participantId)`
   - `messengerAPI.getMessages(chatId)`
   - `messengerAPI.addMessage(chatId, message, replyToId, mediaArray)`
   - `messengerAPI.updateMessage(id, message)`
   - `messengerAPI.removeMessage(id)`
   - `messengerAPI.addReaction(messageId, emoji)`
   - `messengerAPI.removeReaction(messageId, emoji)`

#### Frontend компоненты
1. Переиспользовать существующие компоненты:
   - `ChatSection.js` - адаптировать для личных чатов
   - `MediaCollage.js` - отображение медиа
   - `AudioPlayer.js` - проигрывание аудио
   - `DocumentList.js` - список документов
   - `EmojiPicker.js` - выбор реакций
   - `CommentContextMenu.js` - контекстное меню

2. Обновить `ChatScreen.js`:
   - Интегрировать логику работы с API
   - Использовать компонент ChatSection
   - Реализовать загрузку/обновление сообщений
   - Реализовать все обработчики событий

### Права доступа
- Использовать существующие права из `Can` компонента:
  - `mobile-app-can-create-comment:site` - для создания сообщений
  - `mobile-app-can-edit-comment:site` - для редактирования
  - `mobile-app-can-delete-comment:site` - для удаления

## Примечания
- Структура БД должна предусматривать возможность расширения до групповых чатов в будущем
- Логика нормализации участников чата: `participant_1_id` всегда меньше `participant_2_id` (для уникальности)
- Медиафайлы хранятся в `storage/app/public/messenger/messages/`
- Все существующие компоненты чата уже протестированы и работают - нужно только адаптировать под новую структуру данных
