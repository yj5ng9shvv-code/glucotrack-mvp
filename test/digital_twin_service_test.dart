import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/models/diary_log_entry.dart';
import 'package:glucotrack/models/sensor_reading.dart';
import 'package:glucotrack/services/digital_twin_service.dart';

DiaryLogEntry entry(int minute, {double glucose = 6, int carbs = 0}) =>
    DiaryLogEntry(
      id: '$minute-$carbs',
      time: DateTime(2026, 1, 1).add(Duration(minutes: minute)),
      type: DiaryLogType.glucose,
      glucoseMmol: glucose,
      carbs: carbs,
      insulinUnits: 0,
      title: '',
      note: '',
      source: SensorBrand.manual,
    );

void main() {
  test('does not report personal readiness without enough personal cases', () {
    const service = DigitalTwinService(minimumReadings: 3, minimumCases: 2);
    final profile = service.profileFor([
      entry(0, carbs: 30),
      entry(60, glucose: 8),
      entry(120, glucose: 7),
    ]);
    expect(profile.readiness, DigitalTwinReadiness.preliminary);
  });

  test('recognises matched user-specific diary cases', () {
    const service = DigitalTwinService(minimumReadings: 3, minimumCases: 2);
    final profile = service.profileFor([
      entry(0, carbs: 30), entry(60, glucose: 8),
      entry(240, carbs: 20), entry(300, glucose: 7),
    ]);
    expect(profile.readiness, DigitalTwinReadiness.personal);
    expect(profile.matchedCases, 2);
  });
}
