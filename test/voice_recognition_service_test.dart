import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/services/voice_recognition_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('glucotrack/voice');
  const service = VoiceRecognitionService();

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('returns recognized text from native channel', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'listen');
      return 'What is my glucose trend?';
    });

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, 'What is my glucose trend?');
    expect(result.error, isNull);
  });

  test('maps microphone permission denial', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async {
      throw PlatformException(code: 'permission_denied');
    });

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, isNull);
    expect(result.error, VoiceListenError.permissionDenied);
  });

  test('maps permanently denied microphone permission', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async {
      throw PlatformException(code: 'permission_permanently_denied');
    });

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, isNull);
    expect(result.error, VoiceListenError.permissionPermanentlyDenied);
  });

  test('maps busy recognizer', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async {
      throw PlatformException(code: 'busy');
    });

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, isNull);
    expect(result.error, VoiceListenError.busy);
  });

  test('maps empty recognition result separately from unavailable microphone',
      () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async => '');

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, isNull);
    expect(result.error, VoiceListenError.noMatch);
  });

  test('maps no speech recognition result', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async {
      throw PlatformException(code: 'no_match');
    });

    final result = await service.listen('en', prompt: 'Ask AI');

    expect(result.text, isNull);
    expect(result.error, VoiceListenError.noMatch);
  });

  test('microphone permission messages resolve in every supported language',
      () {
    for (final language in AppState.supportedLanguages) {
      final l10n = AppLocalizations(language.code);
      for (final key in const [
        'voiceMicPermissionDenied',
        'voiceMicPermanentlyDenied',
        'voiceOpenSettings',
        'voiceRecognizerBusy',
        'voiceNoSpeechRecognized',
      ]) {
        expect(l10n.t(key), isNot(key), reason: '${language.code}: $key');
        expect(l10n.t(key).trim(), isNotEmpty,
            reason: '${language.code}: $key');
      }
    }
  });
}
