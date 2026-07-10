import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../platform/voice_recognition.dart';

enum VoiceListenError {
  unavailable,
  permissionDenied,
  permissionPermanentlyDenied,
  busy,
  noMatch,
}

class VoiceListenResult {
  const VoiceListenResult._({this.text, this.error});

  const VoiceListenResult.text(String value) : this._(text: value);

  const VoiceListenResult.error(VoiceListenError value) : this._(error: value);

  final String? text;
  final VoiceListenError? error;

  bool get hasText => text != null && text!.trim().isNotEmpty;
}

class VoiceRecognitionService {
  const VoiceRecognitionService();

  static const _channel = MethodChannel('glucotrack/voice');

  Future<VoiceListenResult> listen(
    String languageCode, {
    required String prompt,
    String? accountToken,
  }) async {
    try {
      final platformResult = await listenWithPlatformSpeech(
        languageCode,
        prompt: prompt,
        accountToken: accountToken,
      );
      if (platformResult != null && platformResult.trim().isNotEmpty) {
        return VoiceListenResult.text(platformResult);
      }
      if (kIsWeb) {
        return const VoiceListenResult.error(VoiceListenError.noMatch);
      }
    } on PlatformException catch (error) {
      return VoiceListenResult.error(_mapError(error.code));
    }

    try {
      final result = await _channel.invokeMethod<String>(
        'listen',
        {'language': languageCode, 'prompt': prompt},
      );
      if (result == null || result.trim().isEmpty) {
        return const VoiceListenResult.error(VoiceListenError.noMatch);
      }
      return VoiceListenResult.text(result);
    } on MissingPluginException {
      return const VoiceListenResult.error(VoiceListenError.unavailable);
    } on PlatformException catch (error) {
      return VoiceListenResult.error(_mapError(error.code));
    }
  }

  Future<void> openAppSettings() async {
    try {
      await _channel.invokeMethod<void>('openAppSettings');
    } on MissingPluginException {
      // Android-only action.
    } on PlatformException {
      // Settings can fail on unusual Android shells; the UI message remains.
    }
  }

  VoiceListenError _mapError(String code) {
    return switch (code) {
      'permission_denied' => VoiceListenError.permissionDenied,
      'permission_permanently_denied' =>
        VoiceListenError.permissionPermanentlyDenied,
      'busy' => VoiceListenError.busy,
      'no_match' => VoiceListenError.noMatch,
      _ => VoiceListenError.unavailable,
    };
  }
}
