/**
 * Expo config plugin: добавляет воспроизведение рингтона в IncomingCallActivity.
 *
 * Библиотека react-native-full-screen-notification-incoming-call показывает
 * полноэкранный UI входящего звонка, но НЕ воспроизводит никаких звуков.
 * React-рингтон (expo-audio) недоступен в background (callModalVisible = false).
 *
 * Этот плагин патчит IncomingCallActivity.java во время expo prebuild:
 * - Добавляет import RingtoneManager
 * - Запускает системный рингтон в onStart() в loop (API 28+)
 * - Останавливает его при принятии/отклонении/уничтожении activity
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const activityPath = path.join(
      config.modRequest.projectRoot,
      'node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallActivity.java'
    );

    if (!fs.existsSync(activityPath)) return config;

    let content = fs.readFileSync(activityPath, 'utf8');

    // Idempotent: пропускаем если уже применён
    if (content.includes('RingtoneManager')) return config;

    // 1. Добавляем импорты после android.widget.TextView
    content = content.replace(
      'import android.widget.TextView;',
      'import android.widget.TextView;\n\nimport android.media.Ringtone;\nimport android.media.RingtoneManager;\nimport android.net.Uri;'
    );

    // 2. Добавляем поле ringtone после uuid
    content = content.replace(
      'private String uuid = "";',
      'private String uuid = "";\n  private Ringtone ringtone;'
    );

    // 3. Расширяем onStart() и добавляем методы startRingtone/stopRingtone
    content = content.replace(
      '  @Override\n  public void onStart() {\n    super.onStart();\n    active = true;\n    instance = this;\n  }',
      [
        '  @Override',
        '  public void onStart() {',
        '    super.onStart();',
        '    active = true;',
        '    instance = this;',
        '    startRingtone();',
        '  }',
        '',
        '  private void startRingtone() {',
        '    try {',
        '      Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);',
        '      ringtone = RingtoneManager.getRingtone(this, ringtoneUri);',
        '      if (ringtone != null) {',
        '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {',
        '          ringtone.setLooping(true);',
        '        }',
        '        ringtone.play();',
        '      }',
        '    } catch (Exception e) {',
        '      Log.e(TAG, "Failed to start ringtone", e);',
        '    }',
        '  }',
        '',
        '  private void stopRingtone() {',
        '    try {',
        '      if (ringtone != null && ringtone.isPlaying()) {',
        '        ringtone.stop();',
        '      }',
        '      ringtone = null;',
        '    } catch (Exception e) {',
        '      Log.e(TAG, "Failed to stop ringtone", e);',
        '    }',
        '  }',
      ].join('\n')
    );

    // 4. Останавливаем рингтон в onDestroy
    content = content.replace(
      '  public void onDestroy() {\n    Log.d(TAG, "onDestroy: ");',
      '  public void onDestroy() {\n    stopRingtone();\n    Log.d(TAG, "onDestroy: ");'
    );

    // 5. Останавливаем рингтон при принятии звонка
    content = content.replace(
      '  private void acceptDialing() {\n    active = false;',
      '  private void acceptDialing() {\n    stopRingtone();\n    active = false;'
    );

    // 6. Останавливаем рингтон при отклонении
    content = content.replace(
      '  private void dismissDialing(String action) {\n    active = false;',
      '  private void dismissDialing(String action) {\n    stopRingtone();\n    active = false;'
    );

    fs.writeFileSync(activityPath, content);
    return config;
  }]);
};
