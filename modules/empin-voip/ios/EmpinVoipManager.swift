import AVFoundation
import CallKit
import Foundation
import PushKit

public final class EmpinVoipManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
  public static let shared = EmpinVoipManager()
  public static let callEventNotification = Notification.Name("EmpinVoipCallEvent")
  public static let tokenEventNotification = Notification.Name("EmpinVoipTokenEvent")

  private static let tokenStorageKey = "EmpinVoipToken"
  private static let eventsStorageKey = "EmpinVoipPendingEvents"
  private static let enabledStorageKey = "EmpinVoipEnabled"
  private static let callTimeout: TimeInterval = 45

  private let lock = NSLock()
  private var registry: PKPushRegistry?
  private var provider: CXProvider?
  private var callsById: [String: CallRecord] = [:]
  private var callsByUUID: [UUID: CallRecord] = [:]
  private var timeoutTasks: [UUID: DispatchWorkItem] = [:]
  private var hasStarted = false

  public var voipToken: String? {
    UserDefaults.standard.string(forKey: Self.tokenStorageKey)
  }

  private override init() {
    super.init()
  }

  public func start() {
    if !Thread.isMainThread {
      DispatchQueue.main.async { [weak self] in
        self?.start()
      }
      return
    }

    guard !hasStarted else {
      return
    }
    hasStarted = true

    let configuration = CXProviderConfiguration(localizedName: "ЭМПИН")
    configuration.supportsVideo = false
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    configuration.includesCallsInRecents = false

    let provider = CXProvider(configuration: configuration)
    provider.setDelegate(self, queue: .main)
    self.provider = provider

    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = isEnabled ? [.voIP] : []
    self.registry = registry
  }

  public func setEnabled(_ enabled: Bool) {
    start()
    UserDefaults.standard.set(enabled, forKey: Self.enabledStorageKey)
    registry?.desiredPushTypes = enabled ? [.voIP] : []

    if !enabled {
      Array(callsById.values).forEach { record in
        provider?.reportCall(with: record.uuid, endedAt: Date(), reason: .failed)
        cleanupCall(record)
      }
    }
  }

  public func pendingEvents() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    return loadPendingEventsLocked()
  }

  public func acknowledgeEvent(_ eventId: String) {
    lock.lock()
    defer { lock.unlock() }
    let events = loadPendingEventsLocked().filter { ($0["eventId"] as? String) != eventId }
    savePendingEventsLocked(events)
  }

  public func endCall(callId: String, reason: String) {
    guard let record = callsById[callId] else {
      return
    }

    let endReason: CXCallEndedReason
    switch reason {
    case "failed":
      endReason = .failed
    case "unanswered", "timeout":
      endReason = .unanswered
    case "declined":
      endReason = .declinedElsewhere
    default:
      endReason = .remoteEnded
    }

    provider?.reportCall(with: record.uuid, endedAt: Date(), reason: endReason)
    cleanupCall(record)
  }

  public func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) -> Bool {
    guard
      let data = normalizedNotificationData(userInfo),
      let type = stringValue(data["type"]),
      type == "call_cancelled" || type == "call_ended",
      let callId = stringValue(data["call_id"]),
      let record = callsById[callId]
    else {
      return false
    }

    enqueueEvent(type: record.answered ? "end" : "reject", record: record)
    provider?.reportCall(with: record.uuid, endedAt: Date(), reason: .remoteEnded)
    cleanupCall(record)
    return true
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    guard type == .voIP else {
      return
    }

    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(token, forKey: Self.tokenStorageKey)
    NotificationCenter.default.post(
      name: Self.tokenEventNotification,
      object: nil,
      userInfo: ["token": token]
    )
  }

  public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else {
      return
    }

    UserDefaults.standard.removeObject(forKey: Self.tokenStorageKey)
    NotificationCenter.default.post(
      name: Self.tokenEventNotification,
      object: nil,
      userInfo: ["token": NSNull()]
    )
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }

    let data = payload.dictionaryPayload
    guard let callId = stringValue(data["call_id"]), !callId.isEmpty else {
      completion()
      return
    }

    if callsById[callId] != nil {
      completion()
      return
    }

    let callUUID = UUID(uuidString: stringValue(data["call_uuid"]) ?? "") ?? UUID()
    let callerName = stringValue(data["caller_name"]) ?? "Неизвестный"
    let callerId = stringValue(data["caller_id"])
    let callerAvatar = stringValue(data["caller_avatar"])
    let record = CallRecord(
      callId: callId,
      uuid: callUUID,
      callerId: callerId,
      callerName: callerName,
      callerAvatar: callerAvatar,
      answered: false
    )

    callsById[callId] = record
    callsByUUID[callUUID] = record

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: callerId ?? callId)
    update.localizedCallerName = callerName
    update.hasVideo = false
    update.supportsDTMF = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false

    guard let provider else {
      cleanupCall(record)
      completion()
      return
    }

    provider.reportNewIncomingCall(with: callUUID, update: update) { [weak self] error in
      defer { completion() }

      guard let self else {
        return
      }

      if error != nil {
        self.cleanupCall(record)
        return
      }

      guard self.isEnabled else {
        provider.reportCall(with: record.uuid, endedAt: Date(), reason: .failed)
        self.cleanupCall(record)
        return
      }

      self.enqueueEvent(type: "incoming", record: record)
      self.scheduleTimeout(for: record)
    }
  }

  public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard var record = callsByUUID[action.callUUID] else {
      action.fail()
      return
    }

    record.answered = true
    callsById[record.callId] = record
    callsByUUID[record.uuid] = record
    cancelTimeout(for: record.uuid)
    enqueueEvent(type: "answer", record: record)
    action.fulfill()
  }

  public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    guard let record = callsByUUID[action.callUUID] else {
      action.fulfill()
      return
    }

    enqueueEvent(type: record.answered ? "end" : "reject", record: record)
    cleanupCall(record)
    action.fulfill()
  }

  public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    var options: AVAudioSession.CategoryOptions = [.defaultToSpeaker]
    #if compiler(>=6.2)
    options.insert(.allowBluetoothHFP)
    #else
    options.insert(.allowBluetooth)
    #endif
    try? audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: options)
    try? audioSession.setActive(true)
  }

  public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    try? audioSession.setActive(false, options: [.notifyOthersOnDeactivation])
  }

  public func providerDidReset(_ provider: CXProvider) {
    timeoutTasks.values.forEach { $0.cancel() }
    timeoutTasks.removeAll()
    callsById.removeAll()
    callsByUUID.removeAll()
  }

  private func scheduleTimeout(for record: CallRecord) {
    let task = DispatchWorkItem { [weak self] in
      guard let self, let current = self.callsByUUID[record.uuid], !current.answered else {
        return
      }

      self.provider?.reportCall(with: current.uuid, endedAt: Date(), reason: .unanswered)
      self.enqueueEvent(type: "timeout", record: current)
      self.cleanupCall(current)
    }

    timeoutTasks[record.uuid] = task
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.callTimeout, execute: task)
  }

  private func cancelTimeout(for uuid: UUID) {
    timeoutTasks.removeValue(forKey: uuid)?.cancel()
  }

  private func cleanupCall(_ record: CallRecord) {
    cancelTimeout(for: record.uuid)
    callsById.removeValue(forKey: record.callId)
    callsByUUID.removeValue(forKey: record.uuid)
  }

  private func enqueueEvent(type: String, record: CallRecord) {
    var event: [String: Any] = [
      "eventId": UUID().uuidString,
      "type": type,
      "callId": record.callId,
      "callUUID": record.uuid.uuidString,
      "callerName": record.callerName,
      "createdAt": Date().timeIntervalSince1970 * 1000
    ]

    if let callerId = record.callerId {
      event["callerId"] = callerId
    }
    if let callerAvatar = record.callerAvatar {
      event["callerAvatar"] = callerAvatar
    }

    lock.lock()
    var events = loadPendingEventsLocked()
    events.append(event)
    savePendingEventsLocked(events)
    lock.unlock()

    NotificationCenter.default.post(
      name: Self.callEventNotification,
      object: nil,
      userInfo: event
    )
  }

  private func loadPendingEventsLocked() -> [[String: Any]] {
    guard
      let data = UserDefaults.standard.data(forKey: Self.eventsStorageKey),
      let events = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return []
    }
    return events
  }

  private func savePendingEventsLocked(_ events: [[String: Any]]) {
    guard let data = try? JSONSerialization.data(withJSONObject: events) else {
      return
    }
    UserDefaults.standard.set(data, forKey: Self.eventsStorageKey)
  }

  private func normalizedNotificationData(_ userInfo: [AnyHashable: Any]) -> [String: Any]? {
    let data = userInfo.reduce(into: [String: Any]()) { result, pair in
      if let key = pair.key as? String {
        result[key] = pair.value
      }
    }

    return normalizedNotificationDictionary(data)
  }

  private func normalizedNotificationDictionary(_ data: [String: Any]) -> [String: Any]? {
    if stringValue(data["type"]) != nil {
      return data
    }

    for key in ["data", "body"] {
      if
        let nestedData = data[key] as? [String: Any],
        let normalizedData = normalizedNotificationDictionary(nestedData)
      {
        return normalizedData
      }
    }

    for key in ["body", "dataString"] {
      guard
        let json = data[key] as? String,
        let jsonData = json.data(using: .utf8),
        let decoded = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
      else {
        continue
      }
      if let normalizedData = normalizedNotificationDictionary(decoded) {
        return normalizedData
      }
    }

    return nil
  }

  private var isEnabled: Bool {
    UserDefaults.standard.bool(forKey: Self.enabledStorageKey)
  }

  private func stringValue(_ value: Any?) -> String? {
    switch value {
    case let value as String:
      return value
    case let value as NSNumber:
      return value.stringValue
    default:
      return nil
    }
  }
}

private struct CallRecord {
  let callId: String
  let uuid: UUID
  let callerId: String?
  let callerName: String
  let callerAvatar: String?
  var answered: Bool
}
