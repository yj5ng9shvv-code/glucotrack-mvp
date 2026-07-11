import AVFoundation
import CoreLocation
import Flutter
import Speech
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let locationProvider = EmergencyLocationProvider()
  private let speechProvider = IosSpeechProvider()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    guard let controller = window?.rootViewController as? FlutterViewController else {
      return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    FlutterMethodChannel(
      name: "glucotrack/emergency",
      binaryMessenger: controller.binaryMessenger
    ).setMethodCallHandler { [locationProvider] call, result in
      switch call.method {
      case "getCurrentLocation":
        locationProvider.request(result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    FlutterMethodChannel(
      name: "glucotrack/voice",
      binaryMessenger: controller.binaryMessenger
    ).setMethodCallHandler { [speechProvider] call, result in
      switch call.method {
      case "listen":
        let args = call.arguments as? [String: Any]
        let language = args?["language"] as? String ?? "en"
        speechProvider.listen(languageCode: language, result: result)
      case "openAppSettings":
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
          result(nil)
          return
        }
        UIApplication.shared.open(url)
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

private final class EmergencyLocationProvider: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var pendingResult: FlutterResult?

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
  }

  func request(_ result: @escaping FlutterResult) {
    if pendingResult != nil {
      result(FlutterError(code: "busy", message: "Location request is already running.", details: nil))
      return
    }

    guard CLLocationManager.locationServicesEnabled() else {
      result(nil)
      return
    }

    pendingResult = result

    switch currentAuthorizationStatus() {
    case .notDetermined:
      manager.requestWhenInUseAuthorization()
    case .authorizedAlways, .authorizedWhenInUse:
      manager.requestLocation()
    case .denied, .restricted:
      finish(nil)
    @unknown default:
      finish(nil)
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard pendingResult != nil else { return }
    switch currentAuthorizationStatus() {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.requestLocation()
    case .denied, .restricted:
      finish(nil)
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else {
      finish(nil)
      return
    }
    finish([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
    ])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finish(nil)
  }

  private func finish(_ value: Any?) {
    let result = pendingResult
    pendingResult = nil
    result?(value)
  }

  private func currentAuthorizationStatus() -> CLAuthorizationStatus {
    if #available(iOS 14.0, *) {
      return manager.authorizationStatus
    }
    return CLLocationManager.authorizationStatus()
  }
}

private final class IosSpeechProvider: NSObject {
  private let audioEngine = AVAudioEngine()
  private var recognitionTask: SFSpeechRecognitionTask?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var pendingResult: FlutterResult?
  private var timeoutTimer: Timer?
  private var recognizedText = ""

  func listen(languageCode: String, result: @escaping FlutterResult) {
    if pendingResult != nil {
      result(FlutterError(code: "busy", message: "Speech recognition is already running.", details: nil))
      return
    }

    pendingResult = result
    recognizedText = ""
    requestPermissions { [weak self] granted in
      guard let self else { return }
      guard granted else {
        self.finish(errorCode: "permission_denied")
        return
      }
      self.startRecognition(languageCode: languageCode)
    }
  }

  private func requestPermissions(_ completion: @escaping (Bool) -> Void) {
    SFSpeechRecognizer.requestAuthorization { speechStatus in
      guard speechStatus == .authorized else {
        DispatchQueue.main.async { completion(false) }
        return
      }

      AVAudioSession.sharedInstance().requestRecordPermission { micGranted in
        DispatchQueue.main.async { completion(micGranted) }
      }
    }
  }

  private func startRecognition(languageCode: String) {
    let locale = Locale(identifier: speechLocale(languageCode))
    guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
      finish(errorCode: "unavailable")
      return
    }

    recognitionTask?.cancel()
    recognitionTask = nil

    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.record, mode: .measurement, options: [.duckOthers, .allowBluetooth])
      try session.setMode(.measurement)
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      finish(errorCode: "unavailable")
      return
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    recognitionRequest = request

    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
      request.append(buffer)
    }

    audioEngine.prepare()
    do {
      try audioEngine.start()
    } catch {
      finish(errorCode: "unavailable")
      return
    }

    timeoutTimer = Timer.scheduledTimer(withTimeInterval: 12, repeats: false) { [weak self] _ in
      self?.finishRecognizedOrNoMatch()
    }

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] speechResult, error in
      guard let self else { return }
      if let speechResult {
        let text = speechResult.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty {
          self.recognizedText = text
        }
        if speechResult.isFinal {
          self.finishRecognizedOrNoMatch()
          return
        }
      }

      if error != nil {
        self.finishRecognizedOrNoMatch()
      }
    }
  }

  private func finishRecognizedOrNoMatch() {
    let text = recognizedText.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty {
      finish(errorCode: "no_match")
    } else {
      finish(value: text)
    }
  }

  private func finish(value: String? = nil, errorCode: String? = nil) {
    timeoutTimer?.invalidate()
    timeoutTimer = nil
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    recognitionTask?.cancel()
    recognitionTask = nil
    recognizedText = ""

    let result = pendingResult
    pendingResult = nil

    if let value {
      result?(value)
    } else {
      result?(FlutterError(code: errorCode ?? "unavailable", message: nil, details: nil))
    }
  }

  private func speechLocale(_ languageCode: String) -> String {
    switch languageCode {
    case "ru": return "ru-RU"
    case "pl": return "pl-PL"
    case "uk": return "uk-UA"
    case "de": return "de-DE"
    case "fr": return "fr-FR"
    case "es": return "es-ES"
    case "it": return "it-IT"
    case "pt": return "pt-PT"
    case "nl": return "nl-NL"
    case "cs": return "cs-CZ"
    case "sk": return "sk-SK"
    case "hu": return "hu-HU"
    case "sv": return "sv-SE"
    case "da": return "da-DK"
    case "fi": return "fi-FI"
    case "no": return "nb-NO"
    case "el": return "el-GR"
    case "tr": return "tr-TR"
    case "bg": return "bg-BG"
    case "hr": return "hr-HR"
    case "sl": return "sl-SI"
    case "lt": return "lt-LT"
    case "lv": return "lv-LV"
    case "et": return "et-EE"
    case "sr": return "sr-RS"
    case "sq": return "sq-AL"
    case "mk": return "mk-MK"
    case "is": return "is-IS"
    default: return "en-US"
    }
  }
}
