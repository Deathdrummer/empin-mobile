# Система прав доступа в мобильном приложении

Система прав полностью интегрирована с Spatie Permissions из веб-версии. При авторизации все права пользователя загружаются из таблиц `model_has_permissions` и `model_has_roles`.

## Как это работает

1. При логине/logout права автоматически загружаются/удаляются из AsyncStorage
2. API эндпоинты `/auth/login` и `/auth/me` возвращают массив `permissions`
3. Права хранятся локально и доступны без дополнительных запросов к API

## Использование

### 1. Компонент Can (рекомендуемый способ)

Аналог Blade директивы `@can`:

```jsx
import { Can } from '../components/Can';

// Проверка одного права
<Can permission="contract-col-date_report_from:site">
  <Text>Этот текст виден только пользователям с правом</Text>
</Can>

// Проверка хотя бы одного из прав
<Can any={["permission1:site", "permission2:site"]}>
  <Button title="Доступно при наличии любого права" />
</Can>

// Проверка всех прав
<Can all={["permission1:site", "permission2:site"]}>
  <Button title="Доступно только при наличии всех прав" />
</Can>

// Fallback контент
<Can
  permission="admin:site"
  fallback={<Text>У вас нет доступа</Text>}
>
  <Text>Админ панель</Text>
</Can>
```

### 2. Хук usePermissions

Для программной проверки прав в компонентах:

```jsx
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const { can, canAny, canAll, permissions, loading } = usePermissions();

  if (loading) {
    return <ActivityIndicator />;
  }

  // Проверка одного права
  if (can('contract-col-date_report_from:site')) {
    // делаем что-то
  }

  // Проверка хотя бы одного из прав
  if (canAny(['permission1:site', 'permission2:site'])) {
    // делаем что-то
  }

  // Проверка всех прав
  if (canAll(['permission1:site', 'permission2:site'])) {
    // делаем что-то
  }

  // Получить все права
  console.log('User permissions:', permissions);

  return <View>...</View>;
}
```

### 3. Утилиты permissions (для использования вне компонентов)

```js
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/permissions';

// В async функциях
async function checkAccess() {
  const canEdit = await hasPermission('contract-edit:site');

  if (canEdit) {
    // делаем что-то
  }
}

// Проверка хотя бы одного из прав
const hasAccess = await hasAnyPermission(['perm1:site', 'perm2:site']);

// Проверка всех прав
const hasFullAccess = await hasAllPermissions(['perm1:site', 'perm2:site']);
```

## Примеры реальных кейсов

### Скрытие кнопок/элементов UI

```jsx
import { Can } from '../components/Can';

function ContractsList() {
  return (
    <View>
      {/* Кнопка удаления видна только с правом */}
      <Can permission="contract-delete:site">
        <TouchableOpacity onPress={handleDelete}>
          <Text>Удалить</Text>
        </TouchableOpacity>
      </Can>

      {/* Кнопка редактирования */}
      <Can permission="contract-edit:site">
        <TouchableOpacity onPress={handleEdit}>
          <Text>Редактировать</Text>
        </TouchableOpacity>
      </Can>
    </View>
  );
}
```

### Условная логика в обработчиках

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TimesheetScreen() {
  const { can } = usePermissions();

  const handleAddTeam = async () => {
    if (!can('mobile-app-can-create-team:site')) {
      Alert.alert('Ошибка', 'У вас нет прав для добавления команды');
      return;
    }

    // Выполняем действие
    await timesheetAPI.addTeam(...);
  };

  return (
    <TouchableOpacity onPress={handleAddTeam}>
      <Text>Добавить команду</Text>
    </TouchableOpacity>
  );
}
```

### Скрытие целых экранов/разделов

```jsx
import { Can } from '../components/Can';

function BottomMenu() {
  return (
    <View>
      {/* Раздел администрирования */}
      <Can permission="admin-panel:site">
        <TouchableOpacity onPress={() => navigate('Admin')}>
          <Text>Админка</Text>
        </TouchableOpacity>
      </Can>

      {/* Раздел отчетов */}
      <Can any={["reports-view:site", "reports-export:site"]}>
        <TouchableOpacity onPress={() => navigate('Reports')}>
          <Text>Отчеты</Text>
        </TouchableOpacity>
      </Can>
    </View>
  );
}
```

### Условные стили

```jsx
function MyComponent() {
  const { can } = usePermissions();
  const isAdmin = can('admin:site');

  return (
    <View style={[styles.container, isAdmin && styles.adminContainer]}>
      <Text>Контент</Text>
    </View>
  );
}
```

## Обновление прав

Права автоматически обновляются:
- При логине
- При вызове `/auth/me`

Для принудительного обновления:

```jsx
const { refresh } = usePermissions();

// Обновить права
await refresh();
```

## Формат названий прав

Права должны совпадать с теми, что используются в веб-версии:

```
{название}-{действие}:{guard}
```

Примеры:
- `contract-col-date_report_from:site`
- `contract-edit:site`
- `contract-delete:site`
- `mobile-app-can-create-team:site`
- `mobile-app-can-delete-team:site`
- `admin-panel:site`

## API

### AuthController изменения

```php
// /auth/login возвращает
{
  "token": "...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "Иванов Иван Иванович",
    "staff_id": 5,
    "permissions": [
      "contract-col-date_report_from:site",
      "contract-edit:site",
      ...
    ]
  }
}

// /auth/me возвращает
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "Иванов Иван Иванович",
  "staff_id": 5,
  "department_id": 3,
  "permissions": [...]
}
```
