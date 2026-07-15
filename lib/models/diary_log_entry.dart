import 'sensor_reading.dart';

enum DiaryLogType { glucose, meal, insulin, activity, note }

class DiaryLogEntry {
  final String id;
  final DateTime time;
  final DiaryLogType type;
  final double glucoseMmol;
  final int carbs;
  final double insulinUnits;
  final String title;
  final String note;
  final SensorBrand source;

  const DiaryLogEntry({
    required this.id,
    required this.time,
    required this.type,
    required this.glucoseMmol,
    required this.carbs,
    required this.insulinUnits,
    required this.title,
    required this.note,
    required this.source,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'time': time.toIso8601String(),
      'type': type.name,
      'glucoseMmol': glucoseMmol,
      'carbs': carbs,
      'insulinUnits': insulinUnits,
      'title': title,
      'note': note,
      'source': source.name,
    };
  }

  factory DiaryLogEntry.fromJson(Map<String, dynamic> json) {
    return DiaryLogEntry(
      id: json['id']?.toString() ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      time: DateTime.tryParse(json['time']?.toString() ?? '') ?? DateTime.now(),
      type: _enumValue(
        DiaryLogType.values,
        json['type']?.toString(),
        DiaryLogType.note,
      ),
      glucoseMmol: _doubleValue(json['glucoseMmol']),
      carbs: _intValue(json['carbs']),
      insulinUnits: _doubleValue(json['insulinUnits']),
      title: json['title']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      source: _enumValue(
        SensorBrand.values,
        json['source']?.toString(),
        SensorBrand.manual,
      ),
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

  static int _intValue(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    if (value is String) {
      return int.tryParse(value) ?? 0;
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
