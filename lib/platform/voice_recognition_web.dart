// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use

import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:web/web.dart' as web;

import '../services/auth_service.dart';

Future<String?> listenWithPlatformSpeech(
  String languageCode, {
  required String prompt,
  String? accountToken,
}) async {
  try {
    return await _listenWithWebSpeech(languageCode);
  } on PlatformException catch (error) {
    if (error.code == 'permission_denied' ||
        error.code == 'permission_permanently_denied' ||
        error.code == 'no_match') {
      rethrow;
    }
    return _listenWithMediaRecorder(languageCode, accountToken: accountToken);
  }
}

Future<String?> _listenWithWebSpeech(String languageCode) async {
  final constructor =
      web.window.getProperty<JSAny?>('SpeechRecognition'.toJS) ??
          web.window.getProperty<JSAny?>('webkitSpeechRecognition'.toJS);
  if (constructor == null) {
    throw PlatformException(code: 'unavailable');
  }

  final completer = Completer<String?>();
  final recognition = (constructor as JSFunction).callAsConstructor<JSObject>();
  var completed = false;

  void finish(String? value) {
    if (completed) return;
    completed = true;
    completer.complete(value);
  }

  void fail(String code) {
    if (completed) return;
    completed = true;
    completer.completeError(PlatformException(code: code));
  }

  recognition.setProperty('lang'.toJS, _speechLocale(languageCode).toJS);
  recognition.setProperty('interimResults'.toJS, false.toJS);
  recognition.setProperty('continuous'.toJS, false.toJS);
  recognition.setProperty('maxAlternatives'.toJS, 1.toJS);
  recognition.setProperty(
    'onresult'.toJS,
    ((JSObject event) {
      try {
        final results = event.getProperty<JSObject>('results'.toJS);
        final firstResult = results.getProperty<JSObject>('0'.toJS);
        final firstAlternative = firstResult.getProperty<JSObject>('0'.toJS);
        final transcript =
            firstAlternative.getProperty<JSString?>('transcript'.toJS)?.toDart;
        if (transcript == null || transcript.trim().isEmpty) {
          fail('no_match');
          return;
        }
        finish(transcript);
      } catch (_) {
        fail('no_match');
      }
    }).toJS,
  );
  recognition.setProperty(
    'onerror'.toJS,
    ((JSObject event) {
      final error = event.getProperty<JSString?>('error'.toJS)?.toDart;
      fail(_mapSpeechError(error));
    }).toJS,
  );
  recognition.setProperty(
    'onnomatch'.toJS,
    ((JSObject _) => fail('no_match')).toJS,
  );
  recognition.setProperty('onend'.toJS, (() => fail('no_match')).toJS);

  try {
    recognition.callMethod('start'.toJS);
  } catch (_) {
    throw PlatformException(code: 'unavailable');
  }

  return completer.future.timeout(
    const Duration(seconds: 20),
    onTimeout: () {
      try {
        recognition.callMethod('abort'.toJS);
      } catch (_) {}
      throw PlatformException(code: 'no_match');
    },
  );
}

String _mapSpeechError(String? error) {
  return switch (error) {
    'not-allowed' || 'service-not-allowed' => 'permission_denied',
    'audio-capture' => 'unavailable',
    'no-speech' || 'aborted' => 'no_match',
    'network' => 'unavailable',
    _ => 'unavailable',
  };
}

String _speechLocale(String languageCode) {
  return switch (languageCode) {
    'en' => 'en-US',
    'de' => 'de-DE',
    'fr' => 'fr-FR',
    'es' => 'es-ES',
    'it' => 'it-IT',
    'pl' => 'pl-PL',
    'uk' => 'uk-UA',
    'ru' => 'ru-RU',
    'pt' => 'pt-PT',
    'nl' => 'nl-NL',
    'ro' => 'ro-RO',
    'cs' => 'cs-CZ',
    'sk' => 'sk-SK',
    'hu' => 'hu-HU',
    'sv' => 'sv-SE',
    'da' => 'da-DK',
    'fi' => 'fi-FI',
    'no' => 'nb-NO',
    'el' => 'el-GR',
    'tr' => 'tr-TR',
    'bg' => 'bg-BG',
    'hr' => 'hr-HR',
    'sl' => 'sl-SI',
    'lt' => 'lt-LT',
    'lv' => 'lv-LV',
    'et' => 'et-EE',
    'sr' => 'sr-RS',
    'sq' => 'sq-AL',
    'mk' => 'mk-MK',
    'is' => 'is-IS',
    _ => 'en-US',
  };
}

Future<String?> _listenWithMediaRecorder(
  String languageCode, {
  required String? accountToken,
}) async {
  final baseUrl = AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
  if (baseUrl.isEmpty) {
    throw PlatformException(code: 'unavailable');
  }

  html.MediaStream stream;
  try {
    stream = await html.window.navigator.mediaDevices!.getUserMedia({
      'audio': true,
    });
  } on html.DomException catch (error) {
    throw PlatformException(code: _mapMediaError(error.name));
  } catch (_) {
    throw PlatformException(code: 'unavailable');
  }

  final chunks = <html.Blob>[];
  final stopped = Completer<void>();
  late html.MediaRecorder recorder;
  try {
    recorder = html.MediaRecorder(stream, {'mimeType': 'audio/webm'});
  } catch (_) {
    _stopTracks(stream);
    throw PlatformException(code: 'unavailable');
  }

  recorder.addEventListener('dataavailable', (event) {
    final data = (event as html.BlobEvent).data;
    if (data != null && data.size > 0) chunks.add(data);
  });
  recorder.addEventListener('stop', (_) {
    if (!stopped.isCompleted) stopped.complete();
  });

  try {
    recorder.start();
    await Future.delayed(const Duration(seconds: 6));
    if (recorder.state != 'inactive') recorder.stop();
    await stopped.future.timeout(const Duration(seconds: 3));
  } catch (_) {
    throw PlatformException(code: 'busy');
  } finally {
    _stopTracks(stream);
  }

  if (chunks.isEmpty) throw PlatformException(code: 'no_match');

  final bytes = await _blobBytes(html.Blob(chunks, 'audio/webm'));
  if (bytes.isEmpty) throw PlatformException(code: 'no_match');

  final request =
      http.MultipartRequest('POST', Uri.parse('$baseUrl/ai/transcribe'))
        ..fields['language_code'] = languageCode
        ..files.add(
          http.MultipartFile.fromBytes('audio', bytes, filename: 'voice.webm'),
        );
  if (accountToken != null && accountToken.isNotEmpty) {
    request.headers['Authorization'] = 'Bearer $accountToken';
  }

  try {
    final response = await http.Response.fromStream(
      await request.send(),
    ).timeout(const Duration(seconds: 35));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlatformException(code: 'unavailable');
    }
    final decoded = jsonDecode(response.body);
    final text =
        decoded is Map ? (decoded['text'] ?? '').toString().trim() : '';
    if (text.isEmpty) throw PlatformException(code: 'no_match');
    return text;
  } on PlatformException {
    rethrow;
  } catch (_) {
    throw PlatformException(code: 'unavailable');
  }
}

Future<Uint8List> _blobBytes(html.Blob blob) {
  final completer = Completer<Uint8List>();
  final reader = html.FileReader();
  reader.onLoad.first.then((_) {
    final result = reader.result;
    if (result is ByteBuffer) {
      completer.complete(result.asUint8List());
    } else {
      completer.complete(Uint8List(0));
    }
  });
  reader.onError.first.then((_) {
    if (!completer.isCompleted) {
      completer.completeError(PlatformException(code: 'unavailable'));
    }
  });
  reader.readAsArrayBuffer(blob);
  return completer.future;
}

void _stopTracks(html.MediaStream stream) {
  for (final track in stream.getTracks()) {
    track.stop();
  }
}

String _mapMediaError(String? error) {
  return switch (error) {
    'NotAllowedError' || 'SecurityError' => 'permission_denied',
    'NotFoundError' || 'DevicesNotFoundError' => 'unavailable',
    'NotReadableError' || 'TrackStartError' => 'busy',
    _ => 'unavailable',
  };
}
