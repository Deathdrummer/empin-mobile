import ExpoModulesCore

public final class EmpinNotificationActionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EmpinNotificationActions")

    // JavaScript обработал нажатие «Ответить» / «Прочитано» (отправил или положил в очередь)
    Function("finish") { (key: String) in
      NotificationActionKeepAlive.shared.finish(key: key)
    }
  }
}
