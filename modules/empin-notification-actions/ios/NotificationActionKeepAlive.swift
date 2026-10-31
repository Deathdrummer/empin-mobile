import Foundation
import UIKit
import UserNotifications

/**
 «Ответить» / «Прочитано» в уведомлении о сообщении. iOS запускает (или будит) приложение в фоне, а
 expo-notifications сразу сообщает системе, что нажатие обработано, — после этого iOS может усыпить
 приложение раньше, чем JavaScript запустится и отправит ответ. Поэтому от нажатия до отметки из
 JavaScript (finish) держим фоновое задание: iOS даёт ему около 30 секунд.
 */
final class NotificationActionKeepAlive {
  static let shared = NotificationActionKeepAlive()

  // Идентификаторы кнопок — как в src/utils/notificationActions.js
  static let actions: Set<String> = ["reply", "read"]

  // Не дожидаемся, пока iOS сама отберёт время: JavaScript не отозвался (например, вышли из аккаунта)
  private static let timeout: TimeInterval = 25

  // Состояние меняется только на главном потоке
  private var pending = Set<String>()
  private var taskId: UIBackgroundTaskIdentifier = .invalid
  private var deadline: DispatchWorkItem?

  /// Ключ нажатия — как actionKey в JavaScript: «идентификатор уведомления:кнопка»
  static func key(for response: UNNotificationResponse) -> String {
    return "\(response.notification.request.identifier):\(response.actionIdentifier)"
  }

  /// Вызывается до того, как expo-notifications отдаст системе completionHandler — поэтому синхронно
  func begin(key: String) {
    if Thread.isMainThread {
      beginOnMain(key: key)
    } else {
      DispatchQueue.main.sync { self.beginOnMain(key: key) }
    }
  }

  func finish(key: String) {
    DispatchQueue.main.async {
      guard self.pending.remove(key) != nil, self.pending.isEmpty else {
        return
      }
      self.endAll()
    }
  }

  private func beginOnMain(key: String) {
    pending.insert(key)
    if taskId == .invalid {
      taskId = UIApplication.shared.beginBackgroundTask(withName: "EmpinNotificationAction") { [weak self] in
        self?.endAll()
      }
    }
    deadline?.cancel()
    let item = DispatchWorkItem { [weak self] in
      self?.endAll()
    }
    deadline = item
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.timeout, execute: item)
  }

  private func endAll() {
    pending.removeAll()
    deadline?.cancel()
    deadline = nil
    if taskId != .invalid {
      let task = taskId
      taskId = .invalid
      UIApplication.shared.endBackgroundTask(task)
    }
  }
}
