import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../models/diary_entry.dart';
import 'diary_analysis_service.dart';

class DoctorReportService {
  const DoctorReportService();

  String buildReport({
    required AppState appState,
    required DiaryAnalysis analysis,
    required List<DiaryEntry> entries,
  }) {
    final l10n = AppLocalizations(appState.languageCode);
    final totalCarbs = entries.fold<int>(0, (sum, entry) => sum + entry.carbs);
    final totalInsulin = entries.fold<double>(
      0,
      (sum, entry) => sum + entry.insulinUnits,
    );
    final period = _periodLabel(entries, l10n);

    final lines = <String>[
      'GlukoTrack: ${l10n.t('doctorReport')}',
      '${l10n.t('summary')}: $period',
      '',
      l10n.t('profile'),
      '- ${l10n.t('diabetesType')}: ${l10n.diabetesType(appState.diabetesType)}',
      '- ${l10n.t('targetGlucose')}: ${appState.formatGlucose(appState.targetGlucose)}',
      '- ${l10n.t('carbRatio')}: 1 ${l10n.t('insulinUnits')} / ${appState.insulinToCarbRatio.toStringAsFixed(0)} ${l10n.t('grams')}',
      '- ${l10n.t('correctionFactor')}: ${appState.glucoseToDisplay(appState.correctionFactor).toStringAsFixed(appState.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1)} ${appState.glucoseUnitLabel}',
      '',
      l10n.t('diaryAnalysis'),
      '- ${l10n.t('averageGlucose')}: ${appState.formatGlucose(analysis.averageGlucose)}',
      '- ${l10n.t('minimum')}: ${appState.formatGlucose(analysis.minGlucose)}',
      '- ${l10n.t('maximum')}: ${appState.formatGlucose(analysis.maxGlucose)}',
      '- ${l10n.t('inRange')}: ${analysis.inRangePercent.toStringAsFixed(0)}%',
      '- ${l10n.t('low')}: ${analysis.lowCount}',
      '- ${l10n.t('highValues')}: ${analysis.highCount}',
      '- ${l10n.t('carbs')}: $totalCarbs ${l10n.t('grams')}',
      '- ${l10n.t('activeInsulin')}: ${totalInsulin.toStringAsFixed(1)}',
      '',
      l10n.t('reportDisclaimer'),
    ];

    return lines.join('\n');
  }

  String _periodLabel(List<DiaryEntry> entries, AppLocalizations l10n) {
    if (entries.isEmpty) {
      return l10n.t('noData');
    }
    final sorted = [...entries]..sort((a, b) => a.time.compareTo(b.time));
    return '${_dateLabel(sorted.first.time, l10n)} - '
        '${_dateLabel(sorted.last.time, l10n)}';
  }

  String _dateLabel(DateTime value, AppLocalizations l10n) =>
      l10n.formatDateTime(value);
}
