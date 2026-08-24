import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:glucotrack/models/app_state.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/screens/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('daily progress starts from zero on a new calendar day', (
    tester,
  ) async {
    final state = AppState()
      ..languageCode = 'en'
      ..dailyInsulinGoalUnits = 20
      ..dailyCarbsGoalGrams = 180;
    final yesterday = DateTime.now().subtract(const Duration(days: 1));

    state.diaryEntries.addAll([
      DiaryLogEntry(
        id: 'old-glucose',
        time: yesterday,
        type: DiaryLogType.glucose,
        glucoseMmol: 6.2,
        carbs: 0,
        insulinUnits: 0,
        title: 'Glucose',
        note: '',
        source: SensorBrand.manual,
      ),
      DiaryLogEntry(
        id: 'old-insulin',
        time: yesterday,
        type: DiaryLogType.insulin,
        glucoseMmol: 0,
        carbs: 0,
        insulinUnits: 8,
        title: 'Insulin',
        note: '',
        source: SensorBrand.manual,
      ),
      DiaryLogEntry(
        id: 'old-meal',
        time: yesterday,
        type: DiaryLogType.meal,
        glucoseMmol: 0,
        carbs: 90,
        insulinUnits: 0,
        title: 'Meal',
        note: '',
        source: SensorBrand.manual,
      ),
    ]);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(home: HomeScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('0%'), findsNWidgets(3));
    expect(state.diaryEntries, hasLength(3));
    expect(state.diaryEntries.map((entry) => entry.id), contains('old-meal'));
  });
}
