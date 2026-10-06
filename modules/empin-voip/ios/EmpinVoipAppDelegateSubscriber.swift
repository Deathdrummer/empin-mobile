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

  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    let handled = EmpinVoipManager.shared.handleRemoteNotification(userInfo)
    completionHandler(handled ? .newData : .noData)
  }
}
