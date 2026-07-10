import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/voice_intent_service.dart';

void main() {
  const service = VoiceIntentService();

  test('parses glucose recording', () {
    final intent = service.parse('Запиши сахар 146');
    expect(intent.type, VoiceIntentType.recordGlucose);
    expect(intent.value, 146);
  });

  test('parses insulin recording', () {
    final intent = service.parse('Я уколол 8 единиц инсулина');
    expect(intent.type, VoiceIntentType.recordInsulin);
    expect(intent.value, 8);
  });

  test('does not record bare units as glucose', () {
    final intent = service.parse('Запиши 145 единиц');
    expect(intent.type, VoiceIntentType.askAi);
  });

  test('requires SOS confirmation intent', () {
    expect(service.parse('Позвони жене').type, VoiceIntentType.sos);
  });

  test('parses localized navigation commands', () {
    expect(service.parse('Trends anzeigen', languageCode: 'de').type,
        VoiceIntentType.openTrends);
    expect(service.parse('Informe médico', languageCode: 'es').type,
        VoiceIntentType.openDoctorReport);
    expect(service.parse('Dostęp rodzinny', languageCode: 'pl').type,
        VoiceIntentType.familyStatus);
  });

  test('parses localized glucose and insulin values', () {
    expect(service.parse('Aktuelle Glukose 120', languageCode: 'de').type,
        VoiceIntentType.recordGlucose);
    expect(service.parse('insulina activa 6', languageCode: 'es').type,
        VoiceIntentType.recordInsulin);
  });
}
