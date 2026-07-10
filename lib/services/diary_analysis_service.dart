import '../models/diary_entry.dart';

class DiaryAnalysis {
  final double averageGlucose;
  final double minGlucose;
  final double maxGlucose;
  final int inRangeCount;
  final int lowCount;
  final int highCount;
  final int totalCount;
  final List<String> patterns;
  final List<String> recommendations;

  const DiaryAnalysis({
    required this.averageGlucose,
    required this.minGlucose,
    required this.maxGlucose,
    required this.inRangeCount,
    required this.lowCount,
    required this.highCount,
    required this.totalCount,
    required this.patterns,
    required this.recommendations,
  });

  double get inRangePercent =>
      totalCount == 0 ? 0 : inRangeCount / totalCount * 100;
}

class DiaryAnalysisService {
  const DiaryAnalysisService();

  DiaryAnalysis analyze(List<DiaryEntry> entries) {
    if (entries.isEmpty) {
      return const DiaryAnalysis(
        averageGlucose: 0,
        minGlucose: 0,
        maxGlucose: 0,
        inRangeCount: 0,
        lowCount: 0,
        highCount: 0,
        totalCount: 0,
        patterns: ['recentEntries'],
        recommendations: ['doctorRecommendation'],
      );
    }

    final values = entries.map((entry) => entry.glucoseMmol).toList();
    final lowCount = values.where((value) => value < 3.9).length;
    final highCount = values.where((value) => value > 10.0).length;
    final inRangeCount =
        values.where((value) => value >= 3.9 && value <= 10.0).length;
    final average = values.reduce((a, b) => a + b) / values.length;
    final afterMeal = entries
        .where((entry) => entry.type == DiaryEntryType.afterMeal)
        .toList();
    final afterMealAverage = afterMeal.isEmpty
        ? 0.0
        : afterMeal.map((entry) => entry.glucoseMmol).reduce((a, b) => a + b) /
            afterMeal.length;

    final patterns = <String>[
      if (afterMealAverage > 8.5) 'afterMealHighPattern',
      if (lowCount > 0) 'lowPattern',
      if (highCount > 0) 'highValues',
      if (inRangeCount == entries.length) 'inRange',
    ];

    final recommendations = <String>[
      'afterMealHighPattern',
      'illnessStressHelp',
      'doctorRecommendation',
    ];

    return DiaryAnalysis(
      averageGlucose: average,
      minGlucose: values.reduce((a, b) => a < b ? a : b),
      maxGlucose: values.reduce((a, b) => a > b ? a : b),
      inRangeCount: inRangeCount,
      lowCount: lowCount,
      highCount: highCount,
      totalCount: entries.length,
      patterns: patterns,
      recommendations: recommendations,
    );
  }
}
