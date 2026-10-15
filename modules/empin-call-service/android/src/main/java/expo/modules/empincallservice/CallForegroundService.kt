package expo.modules.empincallservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

class CallForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Звонок"
    try {
      ensureChannel()
      val notification = buildNotification(title)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Exception) {
      // Система не разрешила службу (например, запуск из фона) — звонок идёт как раньше, без неё
      Log.w(TAG, "Call foreground service was not started", error)
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Приложение смахнули из списка — звонок завершён вместе с ним
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  private fun ensureChannel() {
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Текущий звонок", NotificationManager.IMPORTANCE_LOW).apply {
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(title: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText("Идёт звонок")
      .setSmallIcon(android.R.drawable.sym_action_call)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_CALL)
      .setContentIntent(contentIntent)
      .build()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    private const val TAG = "EmpinCallService"
    private const val CHANNEL_ID = "empin_active_call"
    private const val NOTIFICATION_ID = 4711
  }
}
