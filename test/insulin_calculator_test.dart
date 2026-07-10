import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/insulin_calculator.dart';

void main() {
  test('blocks bolus when glucose is low', () {
    final result = InsulinCalculator.calculate(
      carbs: 60,
      currentGlucose: 3.4,
      targetGlucose: 6,
      insulinToCarbRatio: 10,
      correctionFactor: 2,
    );

    expect(result.totalDose, 0);
    expect(result.warningKeys, contains('lowPattern'));
  });

  test('calculates meal and correction bolus', () {
    final result = InsulinCalculator.calculate(
      carbs: 45,
      currentGlucose: 8,
      targetGlucose: 6,
      insulinToCarbRatio: 10,
      correctionFactor: 2,
    );

    expect(result.mealBolus, 4.5);
    expect(result.correctionBolus, 1);
    expect(result.totalDose, 5.5);
  });
}
