# Примеры интеграции системы прав в TimesheetScreen

## Пример 1: Скрытие кнопок удаления

```jsx
import { Can } from '../components/Can';

// В renderDay функции, вместо onLongPress для удаления:

<Can permission="mobile-app-can-delete-team:site">
  <TouchableOpacity
    onLongPress={() => handleDeleteTeam(team.id, team.master?.full_name)}
  >
    <Text>Удалить бригаду</Text>
  </TouchableOpacity>
</Can>
```

## Пример 2: Условная кнопка добавления

```jsx
import { Can } from '../components/Can';

// Вместо безусловной кнопки "Добавить бригаду":

<Can permission="mobile-app-can-create-team:site">
  <TouchableOpacity
    style={styles.addTeamButton}
    onPress={() => openAddTeamModal(item)}
  >
    <Text style={styles.addTeamButtonText}>+ Добавить бригаду</Text>
  </TouchableOpacity>
</Can>
```

## Пример 3: Проверка прав в обработчиках

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TimesheetScreen() {
  const { can } = usePermissions();

  const handleAddTeam = async (staffId, staffName) => {
    // Проверяем право перед выполнением действия
    if (!can('mobile-app-can-create-team:site')) {
      Toast.show({
        type: 'error',
        text1: 'Нет доступа',
        text2: 'У вас нет прав для добавления бригады',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      await timesheetAPI.addTeam(staffId, selectedDay.day);
      // ... остальной код
    } catch (error) {
      // обработка ошибки
    }
  };

  // Аналогично для других операций
  const handleDeleteTeam = (teamId, teamName) => {
    if (!can('mobile-app-can-delete-team:site')) {
      Toast.show({
        type: 'error',
        text1: 'Нет доступа',
        text2: 'У вас нет прав для удаления бригады',
      });
      return;
    }

    Alert.alert(/* ... */);
  };
}
```

## Пример 4: Условная видимость элементов в списке

```jsx
{team.contracts.map((contract) => (
  <View key={contract.timesheet_contract_id}>
    <TouchableOpacity
      style={styles.contract}
      onPress={() => setExpandedContract(contract.timesheet_contract_id)}
    >
      <Text>{contract.object_number} - {contract.title}</Text>
    </TouchableOpacity>

    {/* Кнопка удаления договора только для пользователей с правами */}
    <Can permission="mobile-app-can-delete-contract:site">
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteContract(contract.timesheet_contract_id)}
      >
        <Text>Удалить</Text>
      </TouchableOpacity>
    </Can>
  </View>
))}
```

## Пример 5: Комплексная проверка прав

```jsx
import { usePermissions } from '../hooks/usePermissions';

function TimesheetScreen() {
  const { can, canAny } = usePermissions();

  // В renderDay
  return (
    <View>
      {/* Показываем список бригад всем */}
      {item.teams.map(team => (
        <View key={team.id}>
          <Text>{team.master?.full_name}</Text>

          {/* Управление договорами - только для тех, кто может добавлять ИЛИ удалять */}
          <Can any={["mobile-app-can-create-contract:site", "mobile-app-can-delete-contract:site"]}>
            {team.contracts.map(contract => (
              <View key={contract.timesheet_contract_id}>
                <Text>{contract.object_number}</Text>

                {/* Добавление договора */}
                <Can permission="mobile-app-can-create-contract:site">
                  <TouchableOpacity onPress={() => openAddContractModal(team.id)}>
                    <Text>+ Добавить договор</Text>
                  </TouchableOpacity>
                </Can>

                {/* Удаление договора */}
                <Can permission="mobile-app-can-delete-contract:site">
                  <TouchableOpacity onPress={() => handleDeleteContract(contract.id)}>
                    <Text>Удалить</Text>
                  </TouchableOpacity>
                </Can>
              </View>
            ))}
          </Can>
        </View>
      ))}
    </View>
  );
}
```

## Пример 6: Модальное окно с правами

```jsx
import { Can } from '../components/Can';

// Модальное окно выбора сотрудника показываем только с правом
<Can permission="mobile-app-can-create-team:site">
  <Modal
    visible={staffModalVisible}
    onRequestClose={() => setStaffModalVisible(false)}
  >
    {/* содержимое модального окна */}
  </Modal>
</Can>
```

## Рекомендуемые названия прав для Timesheet

Создайте эти права в админке Laravel через Spatie:

```
mobile-app-can-create-team:site      - Добавление бригады
mobile-app-can-delete-team:site      - Удаление бригады
mobile-app-can-create-contract:site  - Добавление договора к бригаде
mobile-app-can-delete-contract:site  - Удаление договора из бригады
mobile-app-can-create-comment:site   - Добавление комментария
mobile-app-can-delete-comment:site   - Удаление комментария
```

## Создание прав в Laravel

```php
use Spatie\Permission\Models\Permission;

// В seeder или tinker
Permission::create(['name' => 'mobile-app-can-create-team:site', 'guard_name' => 'site']);
Permission::create(['name' => 'mobile-app-can-delete-team:site', 'guard_name' => 'site']);
Permission::create(['name' => 'mobile-app-can-create-contract:site', 'guard_name' => 'site']);
Permission::create(['name' => 'mobile-app-can-delete-contract:site', 'guard_name' => 'site']);
Permission::create(['name' => 'mobile-app-can-create-comment:site', 'guard_name' => 'site']);
Permission::create(['name' => 'mobile-app-can-delete-comment:site', 'guard_name' => 'site']);

// Назначение прав пользователю
$user = User::find(1);
$user->givePermissionTo('mobile-app-can-create-team:site');
$user->givePermissionTo('mobile-app-can-delete-team:site');

// Или через роль
$role = Role::create(['name' => 'Мастер', 'guard_name' => 'site']);
$role->givePermissionTo([
    'mobile-app-can-create-team:site',
    'mobile-app-can-create-contract:site',
    'mobile-app-can-create-comment:site',
]);
$user->assignRole('Мастер');
```
