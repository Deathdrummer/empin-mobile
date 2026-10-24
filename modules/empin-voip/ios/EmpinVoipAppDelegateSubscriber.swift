import ExpoModulesCore
import UIKit

public final class EmpinVoipAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    EmpinVoipManager.shared.start()
    return true
  }

  // Перезвон из журнала вызовов iPhone (INStartCallIntent)
  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    EmpinVoipManager.shared.start()
    // Восстанавливать нечего; вызов нужен, чтобы Expo дождался всех подписчиков
    restorationHandler(nil)
    return EmpinVoipManager.shared.handleUserActivity(userActivity)
  }

  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    let handled = EmpinVoipManager.shared.handleRemoteNotification(userInfo)
    completionHandler(handled ? .newData : .noData)
  }
}
