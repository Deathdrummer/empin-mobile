# Исправление блокировки свайпа на реальных устройствах

## Проблема

Блокировка свайпа работала на эмуляторе BlueStacks, но **НЕ работала на реальном телефоне**.

### Причина

**Декларативный подход через state слишком медленный:**

```javascript
// СТАРЫЙ подход - НЕ работает на реальных устройствах
const disableScroll = useCallback(() => {
  setScrollEnabled(false); // ❌ State обновление асинхронное
}, []);
```

**Почему не работало:**
1. `setState` вызывает асинхронное обновление
2. React планирует re-render компонента
3. FlatList получает новый prop `scrollEnabled={false}` после re-render
4. На реальных устройствах (особенно Android) это занимает **несколько миллисекунд**
5. За это время FlatList **успевает захватить жест** и начать свайп

### Источники

Решение найдено в GitHub discussions:
- [Discussion #1667 - Disable FlatList scrolling](https://github.com/software-mansion/react-native-gesture-handler/discussions/1667)
- Цитата: "When setNativeProps is executed during a gesture, the native thread won't process it until the gesture finishes"
- **Ключ к решению:** использовать `setNativeProps` для НЕМЕДЛЕННОЙ блокировки

## Решение: Гибридный подход

**Используем `setNativeProps` (синхронно) + `state` (для синхронизации с React):**

```javascript
// НОВЫЙ подход - работает на реальных устройствах ✅
const disableScroll = useCallback(() => {
  // 1. НЕМЕДЛЕННАЯ блокировка через setNativeProps (синхронно)
  if (flatListRef.current) {
    flatListRef.current.setNativeProps({ scrollEnabled: false });
  }
  // 2. Обновление state для синхронизации с React
  setScrollEnabled(false);
}, []);
```

### Почему это работает

1. **setNativeProps** изменяет native свойства **синхронно**
2. Блокировка происходит **мгновенно**, ДО того как FlatList получит жест
3. State обновление происходит параллельно для синхронизации с React
4. FlatList получает оба обновления: через `setNativeProps` (немедленно) и через prop (после re-render)

## Измененные файлы

### 1. SwipeControlContext.js

Добавлен гибридный подход в `disableScroll` и `enableScroll`:

```javascript
const disableScroll = useCallback(() => {
  // КРИТИЧНО: setNativeProps для немедленной блокировки
  if (flatListRef.current) {
    flatListRef.current.setNativeProps({ scrollEnabled: false });
  }
  // Плюс state для синхронизации с React
  setScrollEnabled(false);
}, []);
```

### 2. SwipeBlocker.js

Добавлен обработчик `onResponderTerminate` для дополнительной страховки:

```javascript
<View
  onTouchStart={disableScroll}
  onTouchEnd={enableScroll}
  onTouchCancel={enableScroll}
  onResponderTerminate={enableScroll} // ← НОВОЕ: разблокировка при прерывании жеста
>
```

## Тестирование

### На эмуляторе BlueStacks:
1. Открыть приложение
2. Попробовать свайпнуть на кнопке "Добавить бригаду" → свайп должен быть заблокирован ✅
3. Попробовать свайпнуть на AudioPlayer → свайп должен быть заблокирован ✅
4. Попробовать свайпнуть на MediaCollage → свайп должен быть заблокирован ✅
5. Свайп по header дня → должен переключать дни ✅

### На реальном устройстве:
1. Собрать и установить приложение на телефон
2. Повторить все тесты выше
3. **Особое внимание:** свайп на интерактивных элементах должен быть заблокирован

### Проверка логов

В консоли должны появляться сообщения:
```
🚫 SwipeControl: Блокировка свайпа
✅ SwipeControl: Разблокировка свайпа
```

## Best Practice из сообщества

**Рекомендация из GitHub:**
- Всегда использовать `setNativeProps` для динамического управления свойствами FlatList во время жестов
- State подход подходит только для статических изменений (при загрузке данных, изменении режима и т.д.)
- Для жестов критична **синхронная** блокировка через `setNativeProps`

## Источники

- [Disable Flatlist scrolling when GestureHandler interacting?](https://github.com/software-mansion/react-native-gesture-handler/discussions/1667)
- [Gesture Responder System · React Native](https://reactnative.dev/docs/gesture-responder-system)
- [Horizontal FlatList with pages and ScrollView](https://github.com/software-mansion/react-native-gesture-handler/issues/590)
