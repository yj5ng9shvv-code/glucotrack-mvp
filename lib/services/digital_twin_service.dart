import '../models/diary_log_entry.dart';

enum DigitalTwinReadiness { insufficient, preliminary, personal }

class DigitalTwinProfile {
  const DigitalTwinProfile({
    required this.readiness,
    required this.glucoseReadings,
    required this.matchedCases,
  });

  final DigitalTwinReadiness readiness;
  final int glucoseReadings;
  final int matchedCases;
}

class DigitalTwinPrediction {
  const DigitalTwinPrediction({
    required this.lowerMmol,
    required this.upperMmol,
    required this.confidence,
    required this.sampleCount,
  });

  final double lowerMmol;
  final double upperMmol;
  final double confidence;
  final int sampleCount;
}

/// Computes only descriptive, user-specific statistics from the supplied
/// diary. It never proposes a treatment or an insulin dose.
class DigitalTwinService {
  const DigitalTwinService({this.minimumReadings = 12, this.minimumCases = 3});

  final int minimumReadings;
  final int minimumCases;

  DigitalTwinProfile profileFor(List<DiaryLogEntry> entries) {
    final glucose = entries.where((entry) => entry.glucoseMmol > 0).toList()
      ..sort((a, b) => a.time.compareTo(b.time));
    final cases = _matchedCases(entries);
    final readiness = glucose.length < minimumReadings
        ? DigitalTwinReadiness.insufficient
        : cases < minimumCases
            ? DigitalTwinReadiness.preliminary
            : DigitalTwinReadiness.personal;
    return DigitalTwinProfile(
      readiness: readiness,
      glucoseReadings: glucose.length,
      matchedCases: cases,
    );
  }

  /// Estimates a 30-180 minute glucose range from comparable personal meal
  /// cases. Returns null instead of inventing a number when evidence is thin.
  DigitalTwinPrediction? predictForCarbs(
    List<DiaryLogEntry> entries, {
    required double currentGlucoseMmol,
    required int carbs,
  }) {
    if (currentGlucoseMmol <= 0 || carbs < 0) return null;
    final ordered = [...entries]..sort((a, b) => a.time.compareTo(b.time));
    final deltas = <double>[];
    for (var index = 0; index < ordered.length; index++) {
      final meal = ordered[index];
      if (meal.carbs <= 0 || (meal.carbs - carbs).abs() > 15) continue;
      final baseline = ordered.take(index).lastWhere(
        (entry) => entry.glucoseMmol > 0,
        orElse: () => meal,
      );
      final followUp = ordered.skip(index + 1).cast<DiaryLogEntry?>().firstWhere(
        (entry) {
          if (entry == null) return false;
          final minutes = entry.time.difference(meal.time).inMinutes;
          return entry.glucoseMmol > 0 && minutes >= 30 && minutes <= 180;
        },
        orElse: () => null,
      );
      if (baseline == meal || followUp == null) continue;
      deltas.add(followUp.glucoseMmol - baseline.glucoseMmol);
    }
    if (deltas.length < minimumCases) return null;
    final mean = deltas.reduce((a, b) => a + b) / deltas.length;
    final variance = deltas
            .map((delta) => (delta - mean) * (delta - mean))
            .reduce((a, b) => a + b) /
        deltas.length;
    final spread = math.sqrt(variance) + 0.4;
    return DigitalTwinPrediction(
      lowerMmol:
          (currentGlucoseMmol + mean - spread).clamp(1.0, 35.0).toDouble(),
      upperMmol:
          (currentGlucoseMmol + mean + spread).clamp(1.0, 35.0).toDouble(),
      confidence: (deltas.length / 12).clamp(0.0, 0.8).toDouble(),
      sampleCount: deltas.length,
    );
  }

  int _matchedCases(List<DiaryLogEntry> entries) {
    final ordered = [...entries]..sort((a, b) => a.time.compareTo(b.time));
    var count = 0;
    for (var index = 0; index < ordered.length; index++) {
      final event = ordered[index];
      if (event.carbs <= 0 && event.insulinUnits <= 0) continue;
      final followUp = ordered.skip(index + 1).any((entry) {
        final elapsed = entry.time.difference(event.time).inMinutes;
        return entry.glucoseMmol > 0 && elapsed >= 30 && elapsed <= 180;
      });
      if (followUp) count++;
    }
    return count;
  }
}
import 'dart:math' as math;
