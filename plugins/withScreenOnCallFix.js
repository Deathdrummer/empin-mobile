/**
 * Expo config plugin: запуск IncomingCallActivity поверх активного экрана.
 *
 * Проблема: Android показывает fullscreen Activity через fullscreen_intent ТОЛЬКО
 * когда экран заблокирован. При активном экране — показывается HUN (heads-up notification).
 *
 * Решение: патчим IncomingCallService.java — при обнаружении активного экрана
 * и наличии разрешения SYSTEM_ALERT_WINDOW стартуем IncomingCallActivity напрямую.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const servicePath = path.join(
      config.modRequest.projectRoot,
      'node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallService.java'
    );

    if (!fs.existsSync(servicePath)) {
      console.warn('[withScreenOnCallFix] IncomingCallService.java not found, skipping patch');
      return config;
    }

    let content = fs.readFileSync(servicePath, 'utf8');

    // Idempotent: пропускаем если уже применён
    if (content.includes('startActivityIfScreenOn')) {
      return config;
    }

    // 1. Добавляем импорты PowerManager и Settings после IBinder
    content = content.replace(
      'import android.os.IBinder;',
      'import android.os.IBinder;\nimport android.os.PowerManager;\nimport android.provider.Settings;'
    );

    // 2. В startForegroundWithNotification добавляем вызов startActivityIfScreenOn()
    //    после startForeground + добавляем сам метод
    content = content.replace(
      '    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {\n      startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);\n    } else {\n      startForeground(1, notification);\n    }\n  }',
      [
        '    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {',
        '      startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);',
        '    } else {',
        '      startForeground(1, notification);',
        '    }',
        '    startActivityIfScreenOn();',
        '  }',
        '',
        '  /**',
        '   * Если экран активен (не заблокирован) и есть разрешение SYSTEM_ALERT_WINDOW,',
        '   * запускаем IncomingCallActivity напрямую (не через fullscreen_intent).',
        '   * Android разрешает fullscreen_intent только при выключенном экране.',
        '   */',
        '  private void startActivityIfScreenOn() {',
        '    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);',
        '    if (pm == null || !pm.isInteractive()) return;',
        '    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return;',
        '    if (bundleData == null) return;',
        '    Intent activityIntent = new Intent(this, IncomingCallActivity.class);',
        '    activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);',
        '    activityIntent.putExtras(bundleData);',
        '    startActivity(activityIntent);',
        '  }',
      ].join('\n')
    );

    fs.writeFileSync(servicePath, content);
    console.log('[withScreenOnCallFix] IncomingCallService.java patched successfully');
    return config;
  }]);
};
