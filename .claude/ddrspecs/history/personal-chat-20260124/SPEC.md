# Техническая спецификация: Личный чат в мессенджере

## Обзор
Реализация полнофункционального личного чата между двумя пользователями в разделе "Мессенджер", основанная на существующей реализации группового чата.

## Архитектура

### База данных

#### Таблица `messenger_chats`
Хранит информацию о личных чатах между пользователями.

```sql
CREATE TABLE messenger_chats (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    participant_1_id BIGINT UNSIGNED NOT NULL,
    participant_2_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    FOREIGN KEY (participant_1_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_2_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participants (participant_1_id, participant_2_id),
    INDEX idx_participant_1 (participant_1_id),
    INDEX idx_participant_2 (participant_2_id)
);
```

**Логика нормализации участников:**
- `participant_1_id` < `participant_2_id` (всегда)
- Это обеспечивает уникальность чата между двумя пользователями

#### Таблица `messenger_messages`
Хранит сообщения в личных чатах.

```sql
CREATE TABLE messenger_messages (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    chat_id BIGINT UNSIGNED NOT NULL,
    from_id BIGINT UNSIGNED NOT NULL,
    message LONGTEXT NULL,
    reply_to_id BIGINT UNSIGNED NULL,
    reactions JSON NULL,
    media JSON NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    FOREIGN KEY (chat_id) REFERENCES messenger_chats(id) ON DELETE CASCADE,
    FOREIGN KEY (from_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_id) REFERENCES messenger_messages(id) ON DELETE SET NULL,
    INDEX idx_chat_id (chat_id),
    INDEX idx_from_id (from_id)
);
```

**Структура JSON полей:**

`reactions`:
```json
[
    {"user_id": 123, "emoji": "👍"},
    {"user_id": 456, "emoji": "❤️"}
]
```

`media`:
```json
[
    {
        "path": "/storage/messenger/messages/file.jpg",
        "type": "image",
        "mime_type": "image/jpeg",
        "size": 123456,
        "name": "photo.jpg"
    }
]
```

### Backend

#### Модель `MessengerChat`
**Путь:** `Z:\empin.loc\app\Models\MessengerChat.php`

```php
<?php namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessengerChat extends Model {
    protected $table = 'messenger_chats';
    protected $guarded = [];
    public $timestamps = true;

    // Отношения
    public function messages(): HasMany {
        return $this->hasMany(MessengerMessage::class, 'chat_id');
    }

    public function participant1(): BelongsTo {
        return $this->belongsTo(Staff::class, 'participant_1_id');
    }

    public function participant2(): BelongsTo {
        return $this->belongsTo(Staff::class, 'participant_2_id');
    }

    // Статический метод для получения/создания чата
    public static function getOrCreate(int $userId1, int $userId2): self {
        // Нормализуем порядок участников
        $participant1 = min($userId1, $userId2);
        $participant2 = max($userId1, $userId2);

        return self::firstOrCreate([
            'participant_1_id' => $participant1,
            'participant_2_id' => $participant2,
        ]);
    }
}
```

#### Модель `MessengerMessage`
**Путь:** `Z:\empin.loc\app\Models\MessengerMessage.php`

```php
<?php namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessengerMessage extends Model {
    protected $table = 'messenger_messages';
    protected $guarded = [];
    public $timestamps = true;

    protected $casts = [
        'reactions' => 'array',
        'media' => 'array',
    ];

    // Отношения
    public function chat(): BelongsTo {
        return $this->belongsTo(MessengerChat::class, 'chat_id');
    }

    public function profile(): BelongsTo {
        return $this->belongsTo(Staff::class, 'from_id')
            ->select(['id', 'sname', 'fname', 'mname']);
    }

    public function replyTo(): BelongsTo {
        return $this->belongsTo(MessengerMessage::class, 'reply_to_id');
    }

    public function replies() {
        return $this->hasMany(MessengerMessage::class, 'reply_to_id');
    }
}
```

#### Resource `MessengerMessageResource`
**Путь:** `Z:\empin.loc\app\Http\Resources\MessengerMessageResource.php`

```php
<?php namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class MessengerMessageResource extends JsonResource {
    public function toArray($request) {
        $currentUserId = $request->user()->staff_id;

        return [
            'id' => $this->id,
            'chat_id' => $this->chat_id,
            'from' => $this->profile ? [
                'sname' => $this->profile->sname,
                'fname' => $this->profile->fname,
                'mname' => $this->profile->mname,
            ] : null,
            'message' => $this->message,
            'reply_to_id' => $this->reply_to_id,
            'reactions' => $this->reactions,
            'media' => $this->media,
            'self' => $this->from_id === $currentUserId,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
```

#### Контроллер `MessengerApiController`
**Путь:** `Z:\empin.loc\app\Http\Controllers\api\MessengerApiController.php`

**Методы:**

1. `getOrCreateChat(Request $request)`
   - Принимает: `participant_id` (ID собеседника)
   - Возвращает: `{id: chatId}`
   - Логика: вызывает `MessengerChat::getOrCreate()`

2. `getMessages(Request $request)`
   - Принимает: `chat_id`
   - Возвращает: массив сообщений через `MessengerMessageResource`
   - Загружает: `profile.registred`, `replyTo`
   - Сортировка: `created_at ASC`

3. `addMessage(Request $request)`
   - Принимает: `chat_id`, `message` (nullable), `reply_to_id` (nullable), `media[]` (files)
   - Валидация: хотя бы `message` или `media` должны быть
   - Сохранение медиа: `storage/app/public/messenger/messages/`
   - Возвращает: новое сообщение через `MessengerMessageResource`

4. `updateMessage(Request $request, $id)`
   - Принимает: `message`
   - Проверка: автор сообщения = текущий пользователь
   - Проверка прав: `mobile-app-can-edit-comment:site`
   - Возвращает: обновленное сообщение

5. `removeMessage($id)`
   - Проверка: автор сообщения = текущий пользователь
   - Проверка прав: `mobile-app-can-delete-comment:site`
   - Удаление медиа файлов из storage
   - Возвращает: `{success: true}`

6. `toggleReaction(Request $request)`
   - Принимает: `message_id`, `emoji`
   - Логика: аналогична `TimesheetApiController::toggleReaction()`
   - Возвращает: `{reactions: []}`

#### Роуты
**Путь:** `Z:\empin.loc\routes\api.php`

```php
Route::middleware('auth:sanctum')->prefix('messenger')->group(function () {
    Route::post('/chat', [MessengerApiController::class, 'getOrCreateChat']);
    Route::post('/chat/messages', [MessengerApiController::class, 'getMessages']);
    Route::post('/message', [MessengerApiController::class, 'addMessage']);
    Route::put('/message/{id}', [MessengerApiController::class, 'updateMessage']);
    Route::delete('/message/{id}', [MessengerApiController::class, 'removeMessage']);
    Route::post('/message/reaction', [MessengerApiController::class, 'toggleReaction']);
});
```

### Frontend

#### API Service
**Путь:** `/z/empin-mobile/src/services/api.js`

Добавить объект `messengerAPI`:

```javascript
export const messengerAPI = {
  getOrCreateChat: async (participantId) => {
    const response = await api.post('/messenger/chat', {
      participant_id: participantId,
    });
    return response.data;
  },

  getMessages: async (chatId) => {
    const response = await api.post('/messenger/chat/messages', {
      chat_id: chatId,
    });
    return response.data;
  },

  addMessage: async (chatId, message, replyToId = null, mediaArray = []) => {
    // Аналогично timesheetAPI.addComment
    // Если есть медиа - FormData, иначе JSON
  },

  updateMessage: async (id, message) => {
    const response = await api.put(`/messenger/message/${id}`, { message });
    return response.data;
  },

  removeMessage: async (id) => {
    const response = await api.delete(`/messenger/message/${id}`);
    return response.data;
  },

  addReaction: async (messageId, emoji) => {
    const response = await api.post('/messenger/message/reaction', {
      message_id: messageId,
      emoji,
    });
    return response.data;
  },

  removeReaction: async (messageId, emoji) => {
    // Используем тот же endpoint с теми же параметрами
    // toggleReaction определяет добавить/удалить автоматически
    const response = await api.post('/messenger/message/reaction', {
      message_id: messageId,
      emoji,
    });
    return response.data;
  },
};
```

#### Компонент ChatScreen
**Путь:** `/z/empin-mobile/src/screens/Messenger/ChatScreen.js`

**Состояние:**
- `chatId` - ID чата
- `messages` - массив сообщений
- `commentText` - текст нового сообщения
- `replyingToComment` - сообщение для ответа
- `editingComment` - редактируемое сообщение
- `deletingComment` - ID удаляемого сообщения
- `loading` - индикатор загрузки
- `refreshing` - индикатор обновления

**Lifecycle:**
1. `useEffect` при монтировании:
   - Вызов `messengerAPI.getOrCreateChat(staffId)`
   - Получение `chatId`
   - Вызов `messengerAPI.getMessages(chatId)`
   - Установка `messages`

2. Pull-to-refresh:
   - Повторный вызов `getMessages(chatId)`

**Обработчики:**
- `handleAddMessage(mediaArray)` - отправка сообщения
- `handleDeleteMessage(messageId)` - удаление
- `handleEditMessage(message)` - редактирование
- `handleReplyMessage(message)` - ответ
- `handleToggleReaction(messageId, emoji, hasReacted)` - реакции
- `handleCommentChange(text)` - изменение текста
- `handleCancelReply()` - отмена ответа

**Использование ChatSection:**
```jsx
<ChatSection
  chat={messages}
  commentText={commentText}
  replyingToComment={replyingToComment}
  deletingComment={deletingComment}
  onCommentChange={handleCommentChange}
  onAddComment={handleAddMessage}
  onDeleteComment={handleDeleteMessage}
  onEditComment={handleEditMessage}
  onReplyComment={handleReplyMessage}
  onToggleReaction={handleToggleReaction}
  onCancelReply={handleCancelReply}
/>
```

#### Переиспользование компонентов
Все вспомогательные компоненты остаются без изменений:
- `ChatSection.js` - универсальный компонент чата
- `MediaCollage.js` - галерея медиа
- `AudioPlayer.js` - плеер аудио
- `DocumentList.js` - список документов
- `EmojiPicker.js` - выбор эмоджи
- `CommentContextMenu.js` - контекстное меню

## План миграции

### Backend
1. Создать миграцию `create_messenger_chats_table`
2. Создать миграцию `create_messenger_messages_table`
3. Создать модель `MessengerChat`
4. Создать модель `MessengerMessage`
5. Создать ресурс `MessengerMessageResource`
6. Создать контроллер `MessengerApiController`
7. Добавить роуты в `api.php`

### Frontend
1. Расширить `api.js` объектом `messengerAPI`
2. Переработать `ChatScreen.js` с интеграцией API и ChatSection
3. Тестирование всех функций

## Возможности расширения

Текущая архитектура предусматривает будущее расширение:

### Групповые чаты
1. Добавить таблицу `messenger_chat_participants`:
   ```sql
   CREATE TABLE messenger_chat_participants (
       id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
       chat_id BIGINT UNSIGNED NOT NULL,
       participant_id BIGINT UNSIGNED NOT NULL,
       joined_at TIMESTAMP,

       FOREIGN KEY (chat_id) REFERENCES messenger_chats(id) ON DELETE CASCADE,
       FOREIGN KEY (participant_id) REFERENCES staff(id) ON DELETE CASCADE,
       UNIQUE KEY unique_chat_participant (chat_id, participant_id)
   );
   ```

2. Добавить поле `type` в `messenger_chats`:
   - `personal` - личный чат
   - `group` - групповой чат

3. Для личных чатов `participant_1_id` и `participant_2_id` остаются,
   для групповых используется `messenger_chat_participants`

## Проверки качества

### Backend
- [ ] Миграции применяются без ошибок
- [ ] Модели корректно связаны
- [ ] API возвращает правильную структуру данных
- [ ] Права доступа работают корректно
- [ ] Медиафайлы сохраняются и удаляются

### Frontend
- [ ] Сообщения отображаются корректно
- [ ] Медиа, аудио, документы загружаются и воспроизводятся
- [ ] Реакции добавляются/удаляются
- [ ] Ответы на сообщения работают
- [ ] Редактирование сохраняет изменения
- [ ] Удаление убирает сообщение
- [ ] Pull-to-refresh обновляет список
- [ ] Права доступа корректно ограничивают функции
