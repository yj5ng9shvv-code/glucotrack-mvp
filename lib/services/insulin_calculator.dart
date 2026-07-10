enum ActivityLevel { none, light, planned }

enum HealthFactor { normal, stressOrIllness }

class InsulinResult {
  final double carbs;
  final double breadUnits;
  final double mealBolus;
  final double correctionBolus;
  final double activeInsulin;
  final double activityAdjustment;
  final double healthAdjustment;
  final double rawDose;
  final double totalDose;
  final List<String> warningKeys;

  const InsulinResult({
    required this.carbs,
    required this.breadUnits,
    required this.mealBolus,
    required this.correctionBolus,
    required this.activeInsulin,
    required this.activityAdjustment,
    required this.healthAdjustment,
    required this.rawDose,
    required this.totalDose,
    required this.warningKeys,
  });
}

class InsulinCalculator {
  static InsulinResult calculate({
    required double carbs,
    required double currentGlucose,
    required double targetGlucose,
    required double insulinToCarbRatio,
    required double correctionFactor,
    double activeInsulin = 0,
    ActivityLevel activityLevel = ActivityLevel.none,
    HealthFactor healthFactor = HealthFactor.normal,
  }) {
    final safeCarbs = carbs.isFinite && carbs > 0 ? carbs : 0.0;
    final safeRatio = insulinToCarbRatio.isFinite && insulinToCarbRatio > 0
        ? insulinToCarbRatio
        : 0.0;
    final safeCorrection = correctionFactor.isFinite && correctionFactor > 0
        ? correctionFactor
        : 0.0;
    final safeActiveInsulin =
        activeInsulin.isFinite && activeInsulin > 0 ? activeInsulin : 0.0;
    final safeCurrentGlucose =
        currentGlucose.isFinite ? currentGlucose : targetGlucose;
    final safeTargetGlucose =
        targetGlucose.isFinite ? targetGlucose : safeCurrentGlucose;

    final breadUnits = safeCarbs / 12.0;
    final mealBolus = safeRatio == 0 ? 0.0 : safeCarbs / safeRatio;
    final correctionBolus = safeCorrection == 0
        ? 0.0
        : ((safeCurrentGlucose - safeTargetGlucose) / safeCorrection)
            .clamp(0, 100)
            .toDouble();

    final subtotal = mealBolus + correctionBolus - safeActiveInsulin;
    final activityAdjustment = _activityAdjustment(subtotal, activityLevel);
    final healthAdjustment = _healthAdjustment(subtotal, healthFactor);
    final hypoglycemiaBlock = safeCurrentGlucose < 3.9;
    final rawDose = hypoglycemiaBlock
        ? 0.0
        : (subtotal + activityAdjustment + healthAdjustment)
            .clamp(0, 100)
            .toDouble();
    final totalDose = _roundToHalfUnit(rawDose);

    final warningKeys = <String>[
      if (safeCurrentGlucose < 3.9) 'lowPattern',
      if (safeCurrentGlucose > 13.9) 'afterMealHighPattern',
      if (safeActiveInsulin > mealBolus + correctionBolus) 'activeInsulinHelp',
      if (activityLevel == ActivityLevel.planned) 'doctorRecommendation',
    ];

    return InsulinResult(
      carbs: safeCarbs,
      breadUnits: breadUnits,
      mealBolus: mealBolus,
      correctionBolus: correctionBolus,
      activeInsulin: safeActiveInsulin,
      activityAdjustment: activityAdjustment,
      healthAdjustment: healthAdjustment,
      rawDose: rawDose,
      totalDose: totalDose,
      warningKeys: warningKeys,
    );
  }

  static double _activityAdjustment(double subtotal, ActivityLevel level) {
    return switch (level) {
      ActivityLevel.none => 0,
      ActivityLevel.light => subtotal * -0.10,
      ActivityLevel.planned => subtotal * -0.25,
    };
  }

  static double _healthAdjustment(double subtotal, HealthFactor factor) {
    return switch (factor) {
      HealthFactor.normal => 0,
      HealthFactor.stressOrIllness => subtotal * 0.15,
    };
  }

  static double _roundToHalfUnit(double value) {
    return (value * 2).roundToDouble() / 2;
  }
}
