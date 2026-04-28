/**
 * Expo config plugin:
 * 1. Повышает приоритет ReactNativeFirebaseMessagingService с -500 до 1,
 *    чтобы он обрабатывал FCM-сообщения раньше ExpoFirebaseMessagingService.
 *    Без этого setBackgroundMessageHandler никогда не вызывается.
 *
 * 2. Добавляет MainActivity флаги showWhenLocked и turnScreenOn,
 *    чтобы приложение могло открываться поверх экрана блокировки при ответе на звонок.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = (config) => {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest?.application?.[0];
    if (!application) return config;

    // 1. Firebase messaging service priority
    if (application.service) {
      for (const service of application.service) {
        const name = service.$?.['android:name'] ?? '';
        if (name.includes('ReactNativeFirebaseMessagingService')) {
          const filters = service['intent-filter'] ?? [];
          for (const filter of filters) {
            if (!filter.$) filter.$ = {};
            filter.$['android:priority'] = '1';
          }
        }
      }
    }

    // 2. MainActivity: showWhenLocked + turnScreenOn для ответа на звонок с локскрина
    if (application.activity) {
      for (const activity of application.activity) {
        const name = activity.$?.['android:name'] ?? '';
        if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
          activity.$['android:showWhenLocked'] = 'true';
          activity.$['android:turnScreenOn'] = 'true';
        }
      }
    }

    return config;
  });
};
