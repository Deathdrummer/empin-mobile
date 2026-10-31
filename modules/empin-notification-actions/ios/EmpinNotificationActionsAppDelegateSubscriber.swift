import EXNotifications
import ExpoModulesCore
import UIKit
import UserNotifications

public final class EmpinNotificationActionsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private let responseDelegate = NotificationActionResponseDelegate()

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // До первого нажатия: если приложение запущено самим нажатием, iOS передаст его сразу после запуска
    NotificationCenterManager.shared.addDelegate(responseDelegate)
    return true
  }
}

/// Получает нажатия раньше, чем expo-notifications отдаст системе completionHandler
final class NotificationActionResponseDelegate: NotificationDelegate {
  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    if NotificationActionKeepAlive.actions.contains(response.actionIdentifier) {
      NotificationActionKeepAlive.shared.begin(key: NotificationActionKeepAlive.key(for: response))
    }
    // Нажатие не забираем: его, как и раньше, получит expo-notifications и передаст в JavaScript
    return false
  }
}
