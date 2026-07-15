import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/services/diary_command_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('parses combined glucose insulin carbs state and note command', () {
    const service = DiaryCommandService();
    final state = AppState()
      ..glucoseUnitPreference = GlucoseUnitPreference.mmolL;
    final now = DateTime(2026, 7, 9, 12, 30);

    final command = service.parse(
      'Запиши сахар 7.8, Лиспро 6 единиц, углеводы 45, после еды, чувствую слабость',
      now: now,
    )!;
    final entry = command.toEntry(state, now);

    expect(entry.type, DiaryLogType.glucose);
    expect(entry.glucoseMmol, 7.8);
    expect(entry.insulinUnits, 6);
    expect(entry.carbs, 45);
    expect(entry.note, contains('Lispro'));
    expect(entry.note, contains('after meal'));
    expect(entry.note, contains('слабость'));
    expect(
      command.confirmationText(state, now, l10n: const AppLocalizations('ru')),
      anyOf(contains('Лиспро'), contains('Lispro')),
    );
  });

  test('treats impossible mmol glucose as mg/dL when units are omitted', () {
    const service = DiaryCommandService();
    final state = AppState()
      ..glucoseUnitPreference = GlucoseUnitPreference.mmolL;

    final entry =
        service.parse('сахар 140')!.toEntry(state, DateTime(2026, 7, 9));

    expect(entry.glucoseMmol, closeTo(7.77, 0.01));
  });

  test('parses insulin names carbs food and notes', () {
    const service = DiaryCommandService();
    final state = AppState();

    final lispro = service
        .parse('Запиши инсулин 6 единиц Лиспро')!
        .toEntry(state, DateTime(2026, 7, 9));
    final short = service
        .parse('Вколол 8 единиц короткого инсулина')!
        .toEntry(state, DateTime(2026, 7, 9));
    final lantus = service
        .parse('Добавь 10 единиц Лантус на ночь')!
        .toEntry(state, DateTime(2026, 7, 9));
    final carbs = service
        .parse('Съел 45 грамм углеводов')!
        .toEntry(state, DateTime(2026, 7, 9));
    final dinner = service
        .parse('На ужин было 60 углеводов')!
        .toEntry(state, DateTime(2026, 7, 9));
    final note = service
        .parse('Добавь примечание: плохо себя чувствую')!
        .toEntry(state, DateTime(2026, 7, 9));

    expect(lispro.insulinUnits, 6);
    expect(lispro.note, contains('Lispro'));
    expect(short.note, contains('short insulin'));
    expect(lantus.insulinUnits, 10);
    expect(lantus.note, contains('Lantus'));
    expect(lantus.note, contains('bedtime'));
    expect(carbs.carbs, 45);
    expect(dinner.carbs, 60);
    expect(dinner.note, contains('dinner'));
    expect(note.type, DiaryLogType.note);
    expect(note.note, contains('плохо себя чувствую'));
  });

  test(
    'parses spoken insulin dose words and does not treat bare units as glucose',
    () {
      const service = DiaryCommandService();
      final state = AppState();

      final insulin = service
          .parse('Запиши инсулин шесть единиц')!
          .toEntry(state, DateTime(2026, 7, 9));

      expect(insulin.type, DiaryLogType.insulin);
      expect(insulin.insulinUnits, 6);
      expect(service.parse('Запиши 145 единиц'), isNull);
      expect(
        service.clarificationKey('Запиши 145 единиц'),
        'diaryVoiceAskInsulinDose',
      );
    },
  );

  test('parses relative time phrases', () {
    const service = DiaryCommandService();
    final now = DateTime(2026, 7, 9, 12, 30);

    final yesterdayEvening = service.parse(
      'вчера вечером инсулин 6 единиц',
      now: now,
    )!;
    final todayMorning = service.parse('сегодня утром сахар 6.1', now: now)!;

    expect(yesterdayEvening.entryTime, DateTime(2026, 7, 8, 19));
    expect(todayMorning.entryTime, DateTime(2026, 7, 9, 8));
  });

  test('clarifies missing values and blocks dose advice', () {
    const service = DiaryCommandService();

    expect(
      service.clarificationKey('запиши инсулин'),
      'diaryVoiceAskInsulinDose',
    );
    expect(service.clarificationKey('углеводы'), 'diaryVoiceAskCarbs');
    expect(service.clarificationKey('добавь примечание'), 'diaryVoiceAskNote');
    expect(
      service.looksLikeMedicalDoseAdviceRequest('сколько мне уколоть инсулина'),
      isTrue,
    );
  });

  test('parses food and blood pressure diary commands', () {
    const service = DiaryCommandService();
    final state = AppState();

    final meal =
        service.parse('ел хлеб и суп')!.toEntry(state, DateTime(2026, 7, 9));
    final pressure =
        service.parse('давление 130/85')!.toEntry(state, DateTime(2026, 7, 9));

    expect(meal.type, DiaryLogType.meal);
    expect(meal.note, contains('хлеб'));
    expect(pressure.type, DiaryLogType.note);
    expect(pressure.title, 'Blood pressure');
    expect(pressure.note, contains('130/85'));
  });
}
