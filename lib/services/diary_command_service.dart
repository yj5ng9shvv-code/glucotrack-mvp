import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../models/diary_log_entry.dart';
import '../models/sensor_reading.dart';

enum GlucoseInputUnit { mmolL, mgDl }

class DiaryCommand {
  final double? glucoseValue;
  final GlucoseInputUnit? glucoseUnit;
  final String? stateLabel;
  final String? mealLabel;
  final String? food;
  final int? carbsGrams;
  final double? insulinUnits;
  final String? insulinName;
  final int? systolic;
  final int? diastolic;
  final String note;
  final DateTime? entryTime;

  const DiaryCommand({
    this.glucoseValue,
    this.glucoseUnit,
    this.stateLabel,
    this.mealLabel,
    this.food,
    this.carbsGrams,
    this.insulinUnits,
    this.insulinName,
    this.systolic,
    this.diastolic,
    this.note = '',
    this.entryTime,
  });

  bool get hasGlucose => glucoseValue != null;
  bool get hasInsulin => insulinUnits != null && insulinUnits! > 0;
  bool get hasFood => food != null && food!.trim().isNotEmpty;
  bool get hasCarbs => carbsGrams != null && carbsGrams! > 0;
  bool get hasPressure => systolic != null && diastolic != null;
  bool get hasNote => note.trim().isNotEmpty;
  bool get hasData =>
      hasGlucose || hasInsulin || hasFood || hasCarbs || hasPressure || hasNote;

  DiaryLogEntry toEntry(AppState state, DateTime now) {
    final glucoseMmol = _glucoseMmol(state);
    if (glucoseValue != null && (glucoseMmol < 1.0 || glucoseMmol > 35.0)) {
      throw ArgumentError('Glucose value is outside the supported range');
    }
    final type = hasGlucose
        ? DiaryLogType.glucose
        : hasInsulin
            ? DiaryLogType.insulin
            : (hasFood || hasCarbs)
                ? DiaryLogType.meal
                : DiaryLogType.note;
    final time = entryTime ?? now;
    return DiaryLogEntry(
      id: 'ai-diary-${time.microsecondsSinceEpoch}',
      time: time,
      type: type,
      glucoseMmol: glucoseMmol,
      carbs: carbsGrams ?? 0,
      insulinUnits: insulinUnits ?? 0,
      title: _title(type),
      note: _entryNote(),
      source: SensorBrand.manual,
    );
  }

  String confirmationText(
    AppState state,
    DateTime now, {
    required AppLocalizations l10n,
  }) {
    final lines = <String>[l10n.t('diaryVoiceConfirmHeader')];
    if (hasGlucose) {
      lines.add(
        '${l10n.t('diaryVoiceGlucose')}: ${_formatNumber(glucoseValue!)} ${_displayUnit(state)}',
      );
    }
    if (hasInsulin) {
      final name = insulinName?.trim();
      final value = name == null || name.isEmpty
          ? '${_formatNumber(insulinUnits!)} ${l10n.t('diaryVoiceUnitsShort')}'
          : '$name ${_formatNumber(insulinUnits!)} ${l10n.t('diaryVoiceUnitsShort')}';
      lines.add('${l10n.t('diaryVoiceInsulin')}: $value');
    }
    if (hasCarbs) {
      lines.add('${l10n.t('diaryVoiceCarbs')}: $carbsGrams ${l10n.t('grams')}');
    }
    if (hasFood) {
      lines.add('${l10n.t('diaryVoiceFood')}: ${food!.trim()}');
    }
    if (mealLabel != null && mealLabel!.isNotEmpty) {
      lines.add('${l10n.t('diaryVoiceMeal')}: $mealLabel');
    }
    if (stateLabel != null && stateLabel!.isNotEmpty) {
      lines.add('${l10n.t('diaryVoiceState')}: $stateLabel');
    }
    if (hasPressure) {
      lines.add('${l10n.t('diaryVoicePressure')}: $systolic/$diastolic');
    }
    if (hasNote) {
      lines.add('${l10n.t('diaryVoiceNote')}: ${note.trim()}');
    }
    lines.add(
      '${l10n.t('diaryVoiceTime')}: ${_timeLabel(entryTime, now, l10n)}?',
    );
    return lines.join('\n');
  }

  double _glucoseMmol(AppState state) {
    final value = glucoseValue;
    if (value == null) return 0;
    final unit = glucoseUnit ?? (value > 35 ? GlucoseInputUnit.mgDl : null);
    if (unit == GlucoseInputUnit.mgDl) return value / 18.0182;
    if (unit == GlucoseInputUnit.mmolL) return value;
    return state.glucoseFromDisplay(value);
  }

  String _displayUnit(AppState state) {
    final value = glucoseValue ?? 0;
    final unit = glucoseUnit ?? (value > 35 ? GlucoseInputUnit.mgDl : null);
    if (unit == GlucoseInputUnit.mgDl) return 'mg/dL';
    if (unit == GlucoseInputUnit.mmolL) return 'mmol/L';
    return state.glucoseUnitLabel;
  }

  String _entryNote() {
    final parts = <String>[];
    if (insulinName != null && insulinName!.trim().isNotEmpty) {
      parts.add('Insulin: ${insulinName!.trim()}');
    }
    if (mealLabel != null && mealLabel!.trim().isNotEmpty) {
      parts.add('Meal: ${mealLabel!.trim()}');
    }
    if (stateLabel != null && stateLabel!.trim().isNotEmpty) {
      parts.add('State: ${stateLabel!.trim()}');
    }
    if (hasFood) parts.add('Food: ${food!.trim()}');
    if (hasPressure) parts.add('Blood pressure: $systolic/$diastolic');
    if (hasNote) parts.add(note.trim());
    return parts.join('. ');
  }

  String _title(DiaryLogType type) {
    final multi = [
      hasGlucose,
      hasInsulin,
      hasCarbs || hasFood,
      hasNote,
    ].where((value) => value).length;
    if (multi > 1) return 'Diary entry';
    return switch (type) {
      DiaryLogType.glucose => 'Glucose measurement',
      DiaryLogType.meal => 'Meal',
      DiaryLogType.insulin => 'Insulin',
      DiaryLogType.activity => 'Activity',
      DiaryLogType.note => hasPressure ? 'Blood pressure' : 'Note',
    };
  }

  static String _timeLabel(
    DateTime? value,
    DateTime now,
    AppLocalizations l10n,
  ) {
    final time = value ?? now;
    if (_isSameMinute(time, now)) return l10n.t('diaryVoiceNow');
    final day = time.day.toString().padLeft(2, '0');
    final month = time.month.toString().padLeft(2, '0');
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '$day.$month $hour:$minute';
  }

  static bool _isSameMinute(DateTime a, DateTime b) {
    return a.year == b.year &&
        a.month == b.month &&
        a.day == b.day &&
        a.hour == b.hour &&
        a.minute == b.minute;
  }

  static String _formatNumber(double value) {
    return value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(1);
  }
}

class DiaryCommandService {
  const DiaryCommandService();

  DiaryCommand? parse(
    String input, {
    String languageCode = 'ru',
    DateTime? now,
  }) {
    final original = input.trim();
    if (original.isEmpty) return null;
    final normalized = _normalize(original);
    final baseNow = now ?? DateTime.now();

    final pressure = RegExp(
      r'\b(\d{2,3})\s*/\s*(\d{2,3})\b',
    ).firstMatch(normalized);
    final systolic = pressure == null ? null : int.tryParse(pressure.group(1)!);
    final diastolic =
        pressure == null ? null : int.tryParse(pressure.group(2)!);

    final stateLabel = _stateLabel(normalized);
    final mealLabel = _mealLabel(normalized);
    final glucoseValue = _glucoseValue(normalized, stateLabel);
    final insulinUnits = _insulinUnits(normalized);
    final carbs = _carbs(normalized);
    final food = _food(normalized);
    final note = _note(normalized, original);
    final hasPressure =
        pressure != null && _has(normalized, const ['давлен', 'pressure']);

    final command = DiaryCommand(
      glucoseValue: glucoseValue,
      glucoseUnit: _glucoseUnit(normalized),
      stateLabel: stateLabel,
      mealLabel: mealLabel,
      food: food,
      carbsGrams: carbs,
      insulinUnits: insulinUnits,
      insulinName: insulinUnits == null ? null : _insulinName(normalized),
      systolic: hasPressure ? systolic : null,
      diastolic: hasPressure ? diastolic : null,
      note: note ?? '',
      entryTime: _entryTime(normalized, baseNow),
    );
    return command.hasData ? command : null;
  }

  String? clarificationKey(String input) {
    final text = _normalize(input);
    if (_has(text, const ['сколько', 'доз', 'уколоть', 'назнач', 'how much']) &&
        _has(text, const ['инсулин', 'insulin'])) {
      return 'diaryVoiceMedicalAdviceWarning';
    }
    if (_has(text, const ['инсулин', 'вколол', 'уколол', 'insulin']) &&
        _insulinUnits(text) == null) {
      return 'diaryVoiceAskInsulinDose';
    }
    if (_has(text, const ['единиц', 'ед.', 'units', 'unit']) &&
        !_has(text, const ['инсулин', 'вколол', 'уколол', 'insulin'])) {
      return 'diaryVoiceAskInsulinDose';
    }
    if (_has(text, const ['углевод', 'carb', 'carbs', 'bread unit']) &&
        _carbs(text) == null) {
      return 'diaryVoiceAskCarbs';
    }
    if (_has(text, const ['примечание', 'заметка', 'note']) &&
        _note(text, input) == null) {
      return 'diaryVoiceAskNote';
    }
    return null;
  }

  bool looksLikeMedicalDoseAdviceRequest(String input) {
    return clarificationKey(input) == 'diaryVoiceMedicalAdviceWarning';
  }

  double? _glucoseValue(String text, String? stateLabel) {
    if (!_looksLikeGlucose(text, stateLabel)) return null;
    final hasExplicitGlucose = _has(text, const [
      'сахар',
      'глюкоз',
      'glucose',
      'sugar',
    ]);
    if (!hasExplicitGlucose &&
        _has(text, const ['инсулин', 'вколол', 'единиц', 'углевод', 'carb'])) {
      return null;
    }
    final match = RegExp(
      '(?:сахар|глюкоз[аы]?|glucose|sugar)?\\s*($_numberToken)',
      unicode: true,
    ).firstMatch(text);
    return match == null ? null : _numberValue(match.group(1)!);
  }

  bool _looksLikeGlucose(String text, String? stateLabel) {
    return _has(text, const [
          'сахар',
          'глюкоз',
          'glucose',
          'sugar',
          'glycemia',
          'glycaemia',
        ]) ||
        (stateLabel != null && _firstNumber(text) != null);
  }

  double? _insulinUnits(String text) {
    if (!_hasInsulinContext(text)) {
      return null;
    }
    final patterns = [
      RegExp(
        '($_numberToken)\\s*(?:единиц[ауы]?|ед\\.?|units?|u)',
        unicode: true,
      ),
      RegExp(
        '(?:инсулин|вколол|уколол|колол|добавь|insulin)\\D{0,24}($_numberToken)',
        unicode: true,
      ),
    ];
    for (final pattern in patterns) {
      final match = pattern.firstMatch(text);
      if (match != null) return _numberValue(match.group(1)!);
    }
    return null;
  }

  int? _carbs(String text) {
    final patterns = [
      RegExp(
        '($_numberToken)\\s*(?:грамм\\s*)?(?:углевод[а-я]*|carbs?|carbohydrates?)',
        unicode: true,
      ),
      RegExp('(?:углевод[а-я]*|carbs?)\\D{0,12}($_numberToken)', unicode: true),
    ];
    for (final pattern in patterns) {
      final match = pattern.firstMatch(text);
      if (match != null) {
        return _numberValue(match.group(1)!)?.round();
      }
    }
    return null;
  }

  String? _insulinName(String text) {
    const known = {
      'лиспро': 'Lispro',
      'lispro': 'Lispro',
      'лантус': 'Lantus',
      'lantus': 'Lantus',
      'новорапид': 'Novorapid',
      'novorapid': 'Novorapid',
      'хумалог': 'Humalog',
      'humalog': 'Humalog',
      'короткого инсулина': 'short insulin',
      'short insulin': 'short insulin',
      'long insulin': 'long insulin',
      'длинного инсулина': 'long insulin',
    };
    for (final entry in known.entries) {
      if (text.contains(entry.key)) return entry.value;
    }
    return null;
  }

  bool _hasInsulinContext(String text) {
    return _has(text, const [
          'инсулин',
          'вколол',
          'уколол',
          'колол',
          'добавь',
          'insulin',
        ]) ||
        _insulinName(text) != null;
  }

  GlucoseInputUnit? _glucoseUnit(String text) {
    if (_has(text, const ['mg/dl', 'mgdl', 'мг/дл', 'мг дл'])) {
      return GlucoseInputUnit.mgDl;
    }
    if (_has(text, const ['mmol', 'ммоль', 'ммол', 'mmol/l'])) {
      return GlucoseInputUnit.mmolL;
    }
    return null;
  }

  String? _stateLabel(String text) {
    if (_has(text, const ['натощак', 'fasting'])) return 'fasting';
    if (_has(text, const ['после еды', 'after meal', 'after eating'])) {
      return 'after meal';
    }
    if (_has(text, const ['до еды', 'перед едой', 'before meal'])) {
      return 'before meal';
    }
    if (_has(text, const [
      'перед сном',
      'на ночь',
      'bedtime',
      'before sleep',
    ])) {
      return 'bedtime';
    }
    if (_has(text, const ['ночью', 'night'])) return 'night';
    return null;
  }

  String? _mealLabel(String text) {
    if (_has(text, const ['завтрак', 'утром', 'breakfast'])) return 'breakfast';
    if (_has(text, const ['обед', 'lunch'])) return 'lunch';
    if (_has(text, const ['ужин', 'dinner', 'supper'])) return 'dinner';
    if (_has(text, const ['перекус', 'snack'])) return 'snack';
    return null;
  }

  String? _food(String text) {
    final patterns = [
      RegExp(r'(?:ел|ела|съел|съела|кушал|кушала)\s+([^,.]+)', unicode: true),
      RegExp(
        r'(?:на завтрак|на обед|на ужин|food|ate)\s+(?:было\s*)?([^,.]+)',
        unicode: true,
      ),
    ];
    for (final pattern in patterns) {
      final match = pattern.firstMatch(text);
      if (match != null) {
        final value = _trimNoise(match.group(1)!);
        if (value.isNotEmpty && !_has(value, const ['углевод'])) return value;
      }
    }
    return null;
  }

  String? _note(String normalized, String original) {
    final patterns = [
      RegExp(r'(?:примечание|заметка|note)\s*[:\-]?\s*(.+)$', unicode: true),
      RegExp(r'(?:чувствую|была|было)\s+([^,.]+)$', unicode: true),
    ];
    for (final pattern in patterns) {
      final match = pattern.firstMatch(normalized);
      if (match != null) {
        final value = _trimNoise(match.group(1)!);
        return value.isEmpty ? null : value;
      }
    }
    if (_has(normalized, const ['плохо себя чувствую'])) {
      return 'плохо себя чувствую';
    }
    return null;
  }

  DateTime? _entryTime(String text, DateTime now) {
    DateTime date = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute,
    );
    if (_has(text, const ['вчера', 'yesterday'])) {
      date = date.subtract(const Duration(days: 1));
    }
    if (_has(text, const ['утром', 'morning'])) {
      return DateTime(date.year, date.month, date.day, 8);
    }
    if (_has(text, const ['днем', 'днём', 'afternoon'])) {
      return DateTime(date.year, date.month, date.day, 14);
    }
    if (_has(text, const ['вечером', 'evening'])) {
      return DateTime(date.year, date.month, date.day, 19);
    }
    if (_has(text, const ['на ночь', 'перед сном', 'bedtime'])) {
      return DateTime(date.year, date.month, date.day, 22);
    }
    final time = RegExp(r'\b(\d{1,2})[:.](\d{2})\b').firstMatch(text);
    if (time != null) {
      final hour = int.tryParse(time.group(1)!);
      final minute = int.tryParse(time.group(2)!);
      if (hour != null && minute != null && hour < 24 && minute < 60) {
        return DateTime(date.year, date.month, date.day, hour, minute);
      }
    }
    return null;
  }

  double? _firstNumber(String text) {
    final match = RegExp(
      '\\b($_numberToken)\\b',
      unicode: true,
    ).firstMatch(text);
    return match == null ? null : _numberValue(match.group(1)!);
  }

  String _normalize(String value) =>
      value.toLowerCase().replaceAll(',', '.').replaceAll('ё', 'е');

  static const _numberToken =
      r'\d+(?:\.\d+)?|ноль|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|six|one|two|three|four|five|seven|eight|nine|ten|eleven|twelve';

  double? _numberValue(String raw) {
    final value = raw.trim().toLowerCase().replaceAll(',', '.');
    final parsed = double.tryParse(value);
    if (parsed != null) return parsed;
    return const <String, double>{
      'ноль': 0,
      'один': 1,
      'одна': 1,
      'одно': 1,
      'два': 2,
      'две': 2,
      'три': 3,
      'четыре': 4,
      'пять': 5,
      'шесть': 6,
      'семь': 7,
      'восемь': 8,
      'девять': 9,
      'десять': 10,
      'одиннадцать': 11,
      'двенадцать': 12,
      'тринадцать': 13,
      'четырнадцать': 14,
      'пятнадцать': 15,
      'one': 1,
      'two': 2,
      'three': 3,
      'four': 4,
      'five': 5,
      'six': 6,
      'seven': 7,
      'eight': 8,
      'nine': 9,
      'ten': 10,
      'eleven': 11,
      'twelve': 12,
    }[value];
  }

  String _trimNoise(String value) {
    return value
        .replaceAll(RegExp(r'\b(?:и|and|после еды|до еды|перед сном)\b'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  bool _has(String text, List<String> variants) {
    return variants.any(text.contains);
  }
}
