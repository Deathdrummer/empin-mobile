package expo.modules.empincallservice

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class EmpinCallServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EmpinCallService")

    Function("start") { title: String ->
      val context = appContext.reactContext ?: return@Function false
      // Служба типа microphone требует выданного разрешения, иначе Android 14+ завершит приложение
      if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        return@Function false
      }
      val intent = Intent(context, CallForegroundService::class.java)
        .putExtra(CallForegroundService.EXTRA_TITLE, title)
      try {
        context.startForegroundService(intent)
        true
      } catch (error: Exception) {
        // Android 12+ запрещает запуск из фона — звонок продолжается без службы
        Log.w("EmpinCallService", "Unable to start call foreground service", error)
        false
      }
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function Unit
      context.stopService(Intent(context, CallForegroundService::class.java))
      Unit
    }
  }
}
