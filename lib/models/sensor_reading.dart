enum SensorBrand {
  freestyleLibre,
  dexcom,
  medtronicGuardian,
  accuChek,
  contour,
  yuwellAnytime,
  appleHealth,
  healthConnect,
  manual,
}

enum SensorTrend { risingFast, rising, steady, falling, fallingFast, unknown }

class SensorReading {
  final DateTime time;
  final double glucoseMmol;
  final SensorBrand brand;
  final SensorTrend trend;
  final String sourceId;
  final String note;

  const SensorReading({
    required this.time,
    required this.glucoseMmol,
    required this.brand,
    required this.trend,
    required this.sourceId,
    required this.note,
  });

  Map<String, dynamic> toJson() {
    return {
      'time': time.toIso8601String(),
      'glucoseMmol': glucoseMmol,
      'brand': brand.name,
      'trend': trend.name,
      'sourceId': sourceId,
      'note': note,
    };
  }

  factory SensorReading.fromJson(Map<String, dynamic> json) {
    return SensorReading(
      time: DateTime.tryParse(json['time']?.toString() ?? '') ?? DateTime.now(),
      glucoseMmol: _doubleValue(json['glucoseMmol']),
      brand: _enumValue(
        SensorBrand.values,
        json['brand']?.toString(),
        SensorBrand.manual,
      ),
      trend: _enumValue(
        SensorTrend.values,
        json['trend']?.toString(),
        SensorTrend.unknown,
      ),
      sourceId: json['sourceId']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
    );
  }

  static double _doubleValue(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value.replaceAll(',', '.')) ?? 0;
    }
    return 0;
  }

  static T _enumValue<T extends Enum>(
    List<T> values,
    String? name,
    T fallback,
  ) {
    for (final value in values) {
      if (value.name == name) {
        return value;
      }
    }
    return fallback;
  }
}
