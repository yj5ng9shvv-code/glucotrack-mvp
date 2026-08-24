import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/journal_service.dart';

void main() {
  const service = JournalService();

  test('filters only the selected day and keeps oldest records first', () {
    final entries = [
      _entry('next', DateTime(2026, 7, 20, 8), glucose: 8),
      _entry('late', DateTime(2026, 7, 19, 20), glucose: 9),
      _entry('early', DateTime(2026, 7, 19, 7), glucose: 6),
      _entry('previous', DateTime(2026, 7, 18, 23), glucose: 5),
    ];

    final day = service.entriesForDay(entries, DateTime(2026, 7, 19));

    expect(day.map((entry) => entry.id), ['early', 'late']);
  });

  test('builds week and month summaries from existing diary entries', () {
    final state = AppState();
    final entries = [
      _entry('a', DateTime(2026, 7, 13, 8), glucose: 6, carbs: 30),
      _entry('b', DateTime(2026, 7, 19, 8), glucose: 12, insulin: 4),
      _entry('c', DateTime(2026, 7, 19, 12), glucose: 8, carbs: 45),
      _entry('other-month', DateTime(2026, 8, 1, 8), glucose: 7, carbs: 90),
    ];

    final week = service.lastSevenDays(entries, DateTime(2026, 7, 19));
    final month = service.summarizeMonth(entries, DateTime(2026, 7, 19), state);

    expect(week, hasLength(7));
    expect(week.first.date, DateTime(2026, 7, 13));
    expect(week.last.measurements, 2);
    expect(month.records, 3);
    expect(month.carbs, 75);
    expect(month.insulinUnits, 4);
    expect(month.averageGlucoseMmol, closeTo(8.67, 0.01));
  });

  test('AI analysis flags high glucose, carbs and insulin context', () {
    final state = AppState();
    final analysis = service.analyzeDay(
      [
        _entry('breakfast', DateTime(2026, 7, 19, 8), glucose: 6, carbs: 50),
        _entry('after', DateTime(2026, 7, 19, 10), glucose: 12, insulin: 3),
      ],
      state,
    );

    expect(analysis.insights, contains('journal.ai_high_glucose'));
    expect(analysis.insights, contains('journal.ai_sharp_change'));
    expect(analysis.insights, contains('journal.ai_carbs_present'));
    expect(analysis.insights, contains('journal.ai_insulin_present'));
  });
}

DiaryLogEntry _entry(
  String id,
  DateTime time, {
  double glucose = 0,
  int carbs = 0,
  double insulin = 0,
}) {
  return DiaryLogEntry(
    id: id,
    time: time,
    type: glucose > 0 ? DiaryLogType.glucose : DiaryLogType.note,
    glucoseMmol: glucose,
    carbs: carbs,
    insulinUnits: insulin,
    title: id,
    note: '',
    source: SensorBrand.manual,
  );
}
