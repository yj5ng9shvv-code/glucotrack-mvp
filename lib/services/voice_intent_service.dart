import '../l10n/app_localizations.dart';

enum VoiceIntentType {
  askAi,
  recordGlucose,
  recordInsulin,
  openTrends,
  openDoctorReport,
  openMedications,
  familyStatus,
  sos,
}

class VoiceIntent {
  const VoiceIntent(this.type, {this.value});

  final VoiceIntentType type;
  final double? value;
}

class VoiceIntentService {
  const VoiceIntentService();

  VoiceIntent parse(String input, {String languageCode = 'ru'}) {
    final text = input.toLowerCase().replaceAll(',', '.');
    final l10n = AppLocalizations(languageCode);
    final number = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(text);
    final value = number == null ? null : double.tryParse(number.group(1)!);
    final hasBareUnits = _has(text, ['единиц', 'ед.', 'units', 'unit']) &&
        !_has(text, ['инсулин', 'вколол', 'уколол', 'insulin']);
    if (hasBareUnits) {
      return const VoiceIntent(VoiceIntentType.askAi);
    }

    if (_has(text, ['запиши сахар', 'записать сахар', 'record glucose']) ||
        (value != null && _matchesLabel(text, l10n.t('currentGlucose')))) {
      return VoiceIntent(VoiceIntentType.recordGlucose, value: value);
    }
    if ((_has(text, ['уколол', 'инсулин', 'insulin']) ||
            _matchesLabel(text, l10n.t('activeInsulin')) ||
            _matchesLabel(text, l10n.t('insulinUnits'))) &&
        value != null) {
      return VoiceIntent(VoiceIntentType.recordInsulin, value: value);
    }
    if (_has(text, ['график', 'тренд', 'chart', 'trend']) ||
        _matchesLabel(text, l10n.t('trends'))) {
      return const VoiceIntent(VoiceIntentType.openTrends);
    }
    if (_has(text, ['doctor report', 'informe m'])) {
      return const VoiceIntent(VoiceIntentType.openDoctorReport);
    }
    if (_has(text, ['покажи врачу', 'отчет врачу', 'doctor report']) ||
        _matchesLabel(text, l10n.t('doctorReport'))) {
      return const VoiceIntent(VoiceIntentType.openDoctorReport);
    }
    if (_has(text, ['лекарств', 'medication']) ||
        _matchesLabel(text, l10n.t('medications'))) {
      return const VoiceIntent(VoiceIntentType.openMedications);
    }
    if (_has(text, ['dost']) && _has(text, ['rodzin'])) {
      return const VoiceIntent(VoiceIntentType.familyStatus);
    }
    if (_has(text, ['у сына', 'у дочери', 'у ребенка', 'family glucose']) ||
        _matchesLabel(text, l10n.t('familyControl'))) {
      return const VoiceIntent(VoiceIntentType.familyStatus);
    }
    if (_has(text, ['позови', 'позвони', 'нужна помощь', 'sos', 'геолокац']) ||
        _matchesLabel(text, l10n.t('sosMode'))) {
      return const VoiceIntent(VoiceIntentType.sos);
    }
    return const VoiceIntent(VoiceIntentType.askAi);
  }

  bool _has(String text, List<String> variants) {
    return variants.any(text.contains);
  }

  bool _matchesLabel(String text, String label) {
    final normalized = label.toLowerCase();
    final words = RegExp(r'[\p{L}\p{N}]+', unicode: true)
        .allMatches(normalized)
        .map((match) => match.group(0)!)
        .where((word) => word.length >= 4)
        .toList();
    return words.any((word) {
      final stem = word.length > 6 ? word.substring(0, 6) : word;
      return text.contains(word) || text.contains(stem);
    });
  }
}
