# Реализация избирательного свайпа для карточек дней

## Задача
FlatList с horizontal свайпом работает везде. Нужно, чтобы:
- Свайп работал на header дня и пустых областях
- Свайп НЕ работал на интерактивных элементах (TeamCard, кнопки, MediaCollage, AudioPlayer)

## Попытка 1: GestureDetector + blocksExternalGesture ❌

### Подход
```javascript
// SwipeControlContext.js - создаем nativeGesture
const nativeGesture = Gesture.Native();

// index.js - оборачиваем FlatList
<GestureDetector gesture={nativeGesture}>
  <FlatList ... />
</GestureDetector>

// SwipeBlocker.js - блокируем через blocksExternalGesture
const panGesture = Gesture.Pan()
  .activeOffsetX([-10, 10])
  .failOffsetY([-20, 20])
  .blocksExternalGesture(nativeGesture);
```

### Результат
**ПРОВАЛ**: Приложение падает при клике на любое место в карточке.

### Причина
- `blocksExternalGesture` работает нестабильно в React Native
- Известная проблема: [Issue #3140](https://github.com/software-mansion/react-native-gesture-handler/issues/3140)
- GestureDetector с Pan ломает FlatList на Android

### Коммиты
- `572d959` - feat: Реализован избирательный свайп (с blocksExternalGesture)
- `19587f4` - fix: Исправлена инициализация nativeGesture

---

## Попытка 2: Responder System + onStartShouldSetResponder ❌

### Подход
```javascript
// SwipeBlocker.js
const handleStartShouldSetResponder = () => {
  return true; // Перехватываем все touch события
};

<View
  onStartShouldSetResponder={handleStartShouldSetResponder}
  onResponderMove={handleResponderMove}
  ...
>
```

### Результат
**ПРОВАЛ**: Приложение не падает, но свайп НЕ блокируется, а клики частично не работают.

### Причина
- `onStartShouldSetResponder` срабатывает на начало touch, но не перехватывает жест движения
- FlatList получает жест раньше, чем SwipeBlocker успевает заблокировать через `setNativeProps`
- Блокирует клики на дочерних элементах

### Коммиты
- `1449ee9` - fix: Исправлена блокировка через Responder System

---

## Попытка 3: onMoveShouldSetResponder + onTouchStart ✅

### Подход
```javascript
// SwipeBlocker.js
const handleTouchStart = (event) => {
  // Сохраняем начальную точку без перехвата
  startX.current = event.nativeEvent.pageX;
  startY.current = event.nativeEvent.pageY;
};

const handleMoveShouldSetResponder = (event) => {
  const deltaX = Math.abs(event.nativeEvent.pageX - startX.current);
  const deltaY = Math.abs(event.nativeEvent.pageY - startY.current);

  // Перехватываем только при горизонтальном движении
  if (deltaX > 5 && deltaX > deltaY) {
    flatListRef.current.setNativeProps({ scrollEnabled: false });
    return true; // Перехватываем жест
  }

  return false; // Пропускаем клики и вертикальный scroll
};

<View
  onTouchStart={handleTouchStart}
  onMoveShouldSetResponder={handleMoveShouldSetResponder}
  onResponderRelease={handleResponderRelease}
  ...
>
```

### Результат
**УСПЕХ**: ✅ Клики работают, свайп блокируется.

### Почему работает
1. **onTouchStart** - сохраняет начальную точку, НЕ перехватывает событие
2. **onMoveShouldSetResponder** - срабатывает только при движении
3. Возвращает `true` только при horizontal движении > 5px
4. Возвращает `false` для кликов и vertical scroll
5. `setNativeProps({ scrollEnabled: false })` блокирует FlatList

### Ключевые моменты
- Порог активации: 5px горизонтального движения
- Обязательно: deltaX > deltaY (только горизонтальный жест)
- Разблокировка через 50ms в setTimeout
- Обязательно `onResponderTerminate` для обработки прерванных жестов

### Коммиты
- `a969d14` - fix: Исправлена блокировка через onMoveShouldSetResponder

---

## Итоговое решение

### Файлы
1. **src/components/SwipeBlocker.js** - компонент блокировки свайпа
2. **src/screens/Timesheet/components/DayCard.js** - обертка TeamCard и кнопок
3. **src/contexts/SwipeControlContext.js** - передача flatListRef

### Использование
```javascript
// Обернуть интерактивные элементы
<SwipeBlocker>
  <TeamCard ... />
</SwipeBlocker>

<SwipeBlocker>
  <TouchableHighlight onPress={...}>
    <Text>Кнопка</Text>
  </TouchableHighlight>
</SwipeBlocker>
```

### Проверка
- ✅ Клики по кнопкам работают
- ✅ Horizontal свайп по карточкам блокируется
- ✅ Vertical scroll работает
- ✅ Свайп по header переключает дни

---

## Попытка 4: Pressable из gesture-handler вместо TouchableOpacity ❌

### Подход
Заменить все TouchableOpacity/TouchableHighlight на Pressable из react-native-gesture-handler для автоматической координации жестов.

```javascript
// Было (AudioPlayer.js, MediaCollage.js, DayCard.js)
import { TouchableOpacity } from 'react-native';

// Стало
import { Pressable } from 'react-native-gesture-handler';

// AudioPlayer.js - кнопка Play/Pause
<Pressable
  style={styles.playButton}
  onPress={handlePlayPause}
>
  <MaterialCommunityIcons name={status.playing ? 'pause' : 'play'} />
</Pressable>

// MediaCollage.js - клики на медиа и кнопки удаления
<Pressable onPress={...}>
  <Image source={{ uri }} />
</Pressable>

// DayCard.js - кнопка "Добавить бригаду"
<Pressable
  style={({ pressed }) => [
    styles.addTeamButton,
    pressed && styles.addTeamButtonPressed
  ]}
  onPress={...}
>
  <Text>+ Добавить бригаду</Text>
</Pressable>
```

### Теория
Best practice из документации gesture-handler:
- "Если заменить TouchableOpacity на Gesture Handler Touchable, проблема исчезает"
- Gesture Handler автоматически приоритизирует taps над swipes
- TouchableOpacity deprecated, рекомендуется Pressable

### Результат
**ПРОВАЛ**: Подход не работает в реальном приложении.

### Причина
- Документация устарела или не применима к FlatList с horizontal свайпом
- Pressable из gesture-handler не блокирует свайп FlatList автоматически
- Простая замена компонентов не решает проблему координации жестов

### Источники
- [Touchables Deprecation | Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/docs/components/touchables/)
- [Discussion #1667 - gesture-handler](https://github.com/software-mansion/react-native-gesture-handler/discussions/1667)
- [Issue #150 - react-native-reanimated-carousel](https://github.com/dohooo/react-native-reanimated-carousel/issues/150)

### Коммиты
- `7174c9a` - refactor: Миграция с TouchableOpacity на Pressable из gesture-handler (откачен)

---

## Документация и источники

### React Native Gesture Handler (не подошло)
- [Pan Gesture API](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/pan-gesture/)
- [Discussion #1667 - Disable FlatList scrolling](https://github.com/software-mansion/react-native-gesture-handler/discussions/1667)
- [Discussion #3237 - blockExternalGesture](https://github.com/software-mansion/react-native-gesture-handler/discussions/3237)
- [Issue #3140 - GestureDetector breaks FlatList (Android)](https://github.com/software-mansion/react-native-gesture-handler/issues/3140)

### React Native Responder System (подошло)
- [Gesture Responder System](https://reactnative.dev/docs/gesture-responder-system)
- `onMoveShouldSetResponder` - ключевой метод для избирательного перехвата

---

## Выводы

1. **GestureDetector + blocksExternalGesture** - нестабилен, вызывает crash
2. **onStartShouldSetResponder** - не подходит для блокировки свайпа (срабатывает слишком рано)
3. **onMoveShouldSetResponder** - идеальное решение для избирательного перехвата жестов

**Ключ к успеху**: перехватывать жест только при движении, а не при начале touch.
