# Push-уведомления и звонки iOS

## Что используется

- Android: Expo Push -> FCM -> data-only сообщение -> полноэкранное нативное уведомление.
- iOS, обычные уведомления: Expo Push -> APNs.
- iOS, входящий звонок: сервер напрямую отправляет VoIP push в APNs; PushKit будит приложение, а CallKit немедленно показывает системный экран звонка.
- Отмена и завершение: Pusher в активном приложении плюс обычный background push как резерв для заблокированного устройства.

Firebase-конфигурация нужна Android. Для обычных уведомлений и PushKit/CallKit на iOS Firebase не требуется.

## Контракт приложения с API

После входа приложение регистрирует два разных токена:

- `POST /api/messenger/calls/push-token` — Expo token, `platform`, `installation_id`;
- `POST /api/messenger/calls/voip-token` — APNs VoIP token и `installation_id`.

При выходе соответствующие токены удаляются через `DELETE` этих же адресов. Один сотрудник может иметь несколько установок приложения.

## Настройка Apple и сервера перед тестом

1. Для Bundle ID `ru.deathdrumer.empinmobile` включить capability **Push Notifications**.
2. Создать APNs Auth Key (`.p8`) в Apple Developer. Сам файл ключа хранить только на сервере, вне Git и папки приложения.
3. Для локального backend задать:

   ```dotenv
   APNS_TEAM_ID=
   APNS_KEY_ID=
   APNS_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
   APNS_BUNDLE_ID=ru.deathdrumer.empinmobile
   APNS_ENVIRONMENT=sandbox
   ```

   Для TestFlight используется `APNS_ENVIRONMENT=production`.
4. Выполнить миграции backend. Новая таблица `staff_push_tokens` не заменяет и не удаляет старые данные.
5. Пересоздать iOS provisioning profile после включения Push Notifications. Обычный APNs credential должен быть также доступен EAS-проекту для Expo push.

Для тестовой сборки адрес локального/тестового API задаётся без изменения кода:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://test-api.example.com/api
```

Если переменная не задана, приложение использует текущий боевой адрес `https://empin-pro.ru/api`.

Отдельного тестового API у проекта сейчас нет. Поэтому серверную часть PushKit нельзя проверять на изолированном окружении, пока не будет поднята отдельная копия backend или согласовано временное применение изменений на боевом сервере.

Сервер отправляет VoIP push с обязательными заголовками:

- `apns-push-type: voip`;
- `apns-topic: ru.deathdrumer.empinmobile.voip`;
- `apns-priority: 10`;
- `apns-expiration: 0`.

## Проверка до публикации

Нужны два реальных телефона; Expo Go и iOS Simulator не проверяют PushKit/CallKit корректно.

1. Android: приложение активно, свернуто, выгружено; входящий звонок, ответ, отказ, отмена звонящим.
2. iPhone: экран включён, заблокирован, приложение свернуто и выгружено; системный экран CallKit должен появляться во всех случаях.
3. На iPhone принять звонок и проверить двусторонний звук Agora, динамик, микрофон и завершение обеими сторонами.
4. Выйти из аккаунта на каждом устройстве и убедиться, что старые звонки больше не показываются.
5. Войти одним сотрудником на двух устройствах и проверить, что звонят оба, а отмена закрывает оба экрана.

Нативную iOS-сборку необходимо собирать на EAS/macOS. На Windows можно проверить JavaScript, Expo-конфигурацию и результат prebuild, но нельзя полноценно скомпилировать Swift/CallKit.

## Зафиксированная конфигурация EAS/TestFlight

- Expo account: `work161`;
- Expo organization/project: `@empin/empin-mobile`;
- EAS project ID: `f6eb001a-e226-4bfc-acd6-8b5e10107463`;
- Apple bundle ID: `ru.deathdrumer.empinmobile`;
- App Store Connect app ID: `6817777415`;
- EAS profile для iOS: `testflight`;
- source номера сборки: remote, текущее значение `4`; следующая сборка с `autoIncrement` получит номер `5`;
- подпись iOS: локальные Distribution certificate и App Store provisioning profile из `credentials.json`; сам файл и пароль не коммитить;
- профиль `testflight` задаёт `IOS_WITHOUT_FIREBASE=true`, поэтому iOS собирается без `GoogleService-Info.plist` и React Native Firebase.
- APNs Auth Key для команды `8QV83GB277` подключён к `@empin/empin-mobile` в EAS 6 октября 2026 года. Это даёт Expo доступ к отправке обычных iOS push; сам `.p8` в репозиторий не копировался.
- App Store provisioning profile уже содержит entitlement `aps-environment=production` и действует до 30 сентября 2027 года.

Перед запуском следующей сборки повторно проверить `npx eas-cli whoami`, `npx eas-cli project:info` и срок действия файлов подписи. Команда сборки — `npx eas-cli build --platform ios --profile testflight`; запускать её только после отдельного решения о сборке. Загрузка в TestFlight выполняется отдельно и не должна запускаться автоматически.

Для полностью рабочих входящих iOS-звонков до выпуска остаются внешние шаги: безопасно разместить уже полученный APNs Auth Key на backend, применить подготовленный backend-код и миграцию, затем проверить сценарии на реальном iPhone. На 6 октября 2026 года боевой backend не изменён.

## Откат настройки EAS

Если APNs credential потребуется отключить, удалить нужно только его привязку в EAS Credentials у проекта `@empin/empin-mobile`. Не отзывать ключ на Apple Developer без отдельной причины: отзыв затронет все приложения и окружения, использующие этот ключ. Локальные изменения приложения и backend остаются обычными незакоммиченными Git-изменениями и до публикации не влияют на пользователей.
