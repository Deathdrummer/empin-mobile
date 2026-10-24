import ExpoModulesCore
import Foundation

public final class EmpinVoipModule: Module {
  private var callObserver: NSObjectProtocol?
  private var tokenObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("EmpinVoip")

    Events("onVoipToken", "onVoipCallEvent")

    OnCreate {
      EmpinVoipManager.shared.start()

      self.callObserver = NotificationCenter.default.addObserver(
        forName: EmpinVoipManager.callEventNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let payload = Self.stringKeyedPayload(notification.userInfo) else {
          return
        }
        self?.sendEvent("onVoipCallEvent", payload)
      }

      self.tokenObserver = NotificationCenter.default.addObserver(
        forName: EmpinVoipManager.tokenEventNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        let token = notification.userInfo?["token"] as? String
        let tokenValue: Any = token.map { $0 as Any } ?? NSNull()
        self?.sendEvent("onVoipToken", ["token": tokenValue])
      }
    }

    OnDestroy {
      if let observer = self.callObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      if let observer = self.tokenObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      self.callObserver = nil
      self.tokenObserver = nil
    }

    AsyncFunction("registerAsync") {
      EmpinVoipManager.shared.setEnabled(true)
    }.runOnQueue(.main)

    AsyncFunction("setEnabledAsync") { (enabled: Bool) in
      EmpinVoipManager.shared.setEnabled(enabled)
    }.runOnQueue(.main)

    AsyncFunction("getVoipTokenAsync") { () -> String? in
      return EmpinVoipManager.shared.voipToken
    }

    AsyncFunction("getPendingEventsAsync") { () -> [[String: Any]] in
      return EmpinVoipManager.shared.pendingEvents()
    }

    AsyncFunction("acknowledgeEventAsync") { (eventId: String) in
      EmpinVoipManager.shared.acknowledgeEvent(eventId)
    }

    AsyncFunction("endCallAsync") { (callId: String, reason: String) in
      EmpinVoipManager.shared.endCall(callId: callId, reason: reason)
    }.runOnQueue(.main)

    AsyncFunction("startOutgoingCallAsync") { (callId: String, calleeId: String, calleeName: String) in
      EmpinVoipManager.shared.startOutgoingCall(callId: callId, calleeId: calleeId, calleeName: calleeName)
    }.runOnQueue(.main)

    AsyncFunction("reportOutgoingConnectedAsync") { (callId: String) in
      EmpinVoipManager.shared.reportOutgoingConnected(callId: callId)
    }.runOnQueue(.main)
  }

  private static func stringKeyedPayload(_ userInfo: [AnyHashable: Any]?) -> [String: Any]? {
    guard let userInfo else {
      return nil
    }

    return userInfo.reduce(into: [String: Any]()) { result, pair in
      if let key = pair.key as? String {
        result[key] = pair.value
      }
    }
  }
}
