import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@callPermissionsAsked';
const OVERLAY_KEY = '@overlayPermissionAsked';

/**
 * Запрашивает разрешение SYSTEM_ALERT_WINDOW (поверх других приложений).
 * Нужно для показа полноэкранного UI входящего звонка когда экран активен
 * и приложение в background (пользователь использует другое приложение).
 *
 * Это особое разрешение — только через переход в системные настройки.
 */
const requestOverlayPermission = async () => {
  if (Platform.OS !== 'android' || Platform.Version < 23) return;

  const asked = await AsyncStorage.getItem(OVERLAY_KEY);
  if (asked) return;

  await AsyncStorage.setItem(OVERLAY_KEY, '1');

  // Проверяем через PermissionsAndroid.check (best-effort для SYSTEM_ALERT_WINDOW)
  let granted = false;
  try {
    granted = await PermissionsAndroid.check('android.permission.SYSTEM_ALERT_WINDOW');
  } catch {}

  if (granted) return;

  Alert.alert(
    'Разрешение для входящих звонков',
    'Чтобы показывать экран входящего звонка поверх других приложений, разрешите "Отображение поверх других приложений".',
    [
      { text: 'Позже', style: 'cancel' },
      {
        text: 'Настройки',
        onPress: () => {
          Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION')
            .catch(() => Linking.openSettings());
        },
      },
    ]
  );
};

/**
 * Запрашивает разрешения для входящих звонков при старте,
 * чтобы диалог не всплывал во время входящего вызова.
 *
 * На Google Play (production) USE_FULL_SCREEN_INTENT автоматически выдаётся
 * для приложений с MANAGE_OWN_CALLS в манифесте — никаких диалогов.
 *
 * На dev APK / Android 14+ требует ручного подтверждения (один раз).
 */
export const requestCallPermissions = async () => {
  if (Platform.OS !== 'android') return;

  // USE_FULL_SCREEN_INTENT — для показа полноэкранного окна при заблокированном экране
  const asked = await AsyncStorage.getItem(STORAGE_KEY);
  if (!asked) {
    await AsyncStorage.setItem(STORAGE_KEY, '1');

    if (Platform.Version >= 34) {
      try {
        const result = await PermissionsAndroid.request(
          'android.permission.USE_FULL_SCREEN_INTENT'
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Разрешение для входящих звонков',
            'Для отображения входящих звонков на полный экран нажмите "Настройки" и разрешите "Полноэкранные уведомления".',
            [
              { text: 'Позже', style: 'cancel' },
              {
                text: 'Настройки',
                onPress: () => {
                  Linking.sendIntent(
                    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
                    [{ key: 'android.provider.extra.APP_PACKAGE', value: 'ru.deathdrumer.empinmobile' }]
                  ).catch(() => Linking.openSettings());
                },
              },
            ]
          );
        }
      } catch {}
    }
  }

  // SYSTEM_ALERT_WINDOW — для показа полноэкранного окна при активном экране
  // (когда пользователь в другом приложении и экран включён)
  await requestOverlayPermission();
};
