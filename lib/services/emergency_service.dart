import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../l10n/emergency_card_value_translations.dart';
import '../l10n/emergency_profile_translations.dart';
import '../l10n/lock_screen_sos_english.dart';
import '../l10n/sos_translations.dart';
import '../models/app_state.dart';
import '../platform/sos_geolocation.dart';
import 'sos_public_service.dart';

class EmergencyTriggerResult {
  final bool isPreview;
  final List<String> plannedActions;

  const EmergencyTriggerResult({
    required this.isPreview,
    required this.plannedActions,
  });
}

abstract class EmergencyService {
  Future<EmergencyTriggerResult> triggerPreview(AppState state);
}

class MockEmergencyService implements EmergencyService {
  const MockEmergencyService();

  @override
  Future<EmergencyTriggerResult> triggerPreview(AppState state) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final locationActions = await _locationActions(state);
    return EmergencyTriggerResult(
      isPreview: true,
      plannedActions: [
        sosText(state.languageCode, 'enabled'),
        if (state.showEmergencyOnLockScreen)
          emergencyProfileText(state.languageCode, 0),
        if (state.sosSmsEnabled)
          '${emergencyProfileText(state.languageCode, 1)}: ${state.emergencyContactPhone}',
        ...locationActions,
        if (state.sosAutoCallEnabled)
          '${emergencyProfileText(state.languageCode, 3)}: ${state.sosEscalationMinutes}',
      ],
    );
  }

  Future<List<String>> _locationActions(AppState state) async {
    if (!state.sosLocationEnabled) return const [];
    final location = await getCurrentSosLocation();
    if (location == null) {
      return [emergencyProfileText(state.languageCode, 2)];
    }

    if (state.sosPublicToken.isNotEmpty) {
      try {
        await SosPublicService().sendScanLocation(
          token: state.sosPublicToken,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        );
      } catch (_) {
        // Preview still shows the location action when delivery is unavailable.
      }
    }

    return [
      '${emergencyProfileText(state.languageCode, 2)}: ${location.mapsUrl}',
    ];
  }
}

class AndroidEmergencyService implements EmergencyService {
  static const _channel = MethodChannel('glucotrack/emergency');

  @override
  Future<EmergencyTriggerResult> triggerPreview(AppState state) async {
    try {
      await showAlert(state);
    } on MissingPluginException {
      // The web build has no Android method channel.
    }
    return const MockEmergencyService().triggerPreview(state);
  }

  Future<void> showAlert(AppState state) async {
    await _channel.invokeMethod<void>('showEmergencyAlert', _payload(state));
  }

  Future<void> updateLockScreenCard(AppState state) async {
    try {
      await _channel.invokeMethod<void>('updateLockScreenCard', {
        'enabled': state.showEmergencyOnLockScreen,
        ..._lockScreenPayload(state),
      });
    } on MissingPluginException {
      // Available only in the Android application.
    }
  }

  Map<String, String> _lockScreenPayload(AppState state) {
    const labels = lockScreenSosEnglishLabels;
    final glucoseMmol = state.latestSosGlucoseMmol;
    final glucoseUpdatedAt = state.latestSosGlucoseAt;
    final allergyStatus = state.hasAllergies ? 'YES' : 'NO';
    return {
      'languageCode': 'en',
      'name': state.fullName,
      'contactName': state.emergencyContactName,
      'contactPhone': state.emergencyContactPhone,
      'diabetesType': state.diabetesType.name,
      'bloodType': lockScreenSosEnglishSystemValue(state.bloodType),
      'insulinName': lockScreenSosEnglishSystemValue(state.insulinName),
      'allergyStatusCode': state.hasAllergies ? 'yes' : 'no',
      'allergyStatus': allergyStatus,
      'allergies': allergyStatus,
      'glucose': glucoseMmol == null
          ? labels['noData']!
          : state.formatGlucose(glucoseMmol),
      'glucoseUpdatedAt': glucoseUpdatedAt == null
          ? ''
          : state.formatSosGlucoseUpdatedAt(glucoseUpdatedAt),
      'publicUrl': SosPublicService().publicUrl(state.sosPublicToken),
      'cardTitle': labels['cardTitle']!,
      'sosTitle': labels['sosTitle']!,
      'holdToActivateLabel': labels['holdToActivateLabel']!,
      'emergencyMedicalCardLabel': labels['emergencyMedicalCardLabel']!,
      'medicalInfoLabel': labels['medicalInfoLabel']!,
      'emergencyHelpCardLabel': labels['emergencyHelpCardLabel']!,
      'nameLabel': labels['nameLabel']!,
      'glucoseLabel': labels['glucoseLabel']!,
      'lastUpdatedLabel': labels['lastUpdatedLabel']!,
      'diabetesLabel': labels['diabetesLabel']!,
      'diabetesText': lockScreenSosEnglishDiabetesType(state.diabetesType),
      'bloodLabel': labels['bloodLabel']!,
      'insulinLabel': labels['insulinLabel']!,
      'allergiesLabel': labels['allergiesLabel']!,
      'contactLabel': labels['contactLabel']!,
      'phoneLabel': labels['phoneLabel']!,
      'instructionTitle': labels['instructionTitle']!,
      'instructionText':
          lockScreenSosEnglishEmergencyInstruction(state.emergencyInstructions),
      'call112Label': labels['call112Label']!,
      'myLocationLabel': labels['myLocationLabel']!,
      'callContactLabel': labels['callContactLabel']!,
      'showQrLabel': labels['showQrLabel']!,
      'medicalCardLabel': labels['medicalCardLabel']!,
      'sendLocationActionLabel': labels['sendLocationActionLabel']!,
      'openMapLabel': labels['openMapLabel']!,
      'sendSmsLabel':
          '${labels['callContactLabel']}${labels['separator']}${labels['sendLocationActionLabel']}',
      'closeLabel': labels['closeLabel']!,
      'openCardLabel': labels['openCardLabel']!,
      'qrDescription': labels['qrDescription']!,
      'locationUnavailable': labels['locationUnavailable']!,
      'smsUnavailable': labels['smsUnavailable']!,
      'locationPermissionRequired': labels['locationPermissionRequired']!,
      'notificationChannelName': labels['notificationChannelName']!,
      'notificationChannelDescription':
          labels['notificationChannelDescription']!,
      'qrLabel': labels['qrLabel']!,
    };
  }

  Map<String, String> _payload(AppState state) {
    final l10n = AppLocalizations(state.languageCode);
    final glucoseMmol = state.latestSosGlucoseMmol;
    final glucoseUpdatedAt = state.latestSosGlucoseAt;
    final allergyStatus =
        state.hasAllergies ? l10n.t('sos.yes') : l10n.t('sos.no');
    return {
      'languageCode': state.languageCode,
      'name': state.fullName,
      'contactName': state.emergencyContactName,
      'contactPhone': state.emergencyContactPhone,
      'diabetesType': state.diabetesType.name,
      'bloodType': state.bloodType,
      'insulinName': state.insulinName,
      'allergyStatusCode': state.hasAllergies ? 'yes' : 'no',
      'allergyStatus': allergyStatus,
      'allergies': allergyStatus,
      'glucose': glucoseMmol == null
          ? l10n.t('sos.noData')
          : state.formatGlucose(glucoseMmol),
      'glucoseUpdatedAt': glucoseUpdatedAt == null
          ? ''
          : state.formatSosGlucoseUpdatedAt(glucoseUpdatedAt),
      'publicUrl': SosPublicService().publicUrl(state.sosPublicToken),
      'cardTitle': l10n.t('emergencyCard'),
      'sosTitle': l10n.t('sos.cardTitle'),
      'holdToActivateLabel': l10n.t('sos.holdToActivate'),
      'emergencyMedicalCardLabel': l10n.t('sos.emergencyMedicalCard'),
      'medicalInfoLabel': l10n.t('sos.medicalInformation'),
      'emergencyHelpCardLabel': l10n.t('sos.emergencyHelpCard'),
      'nameLabel': l10n.t('name'),
      'glucoseLabel': l10n.t('currentGlucose'),
      'lastUpdatedLabel': l10n.t('sos.lastUpdated'),
      'diabetesLabel': l10n.t('diabetesType'),
      'diabetesText': l10n.diabetesType(state.diabetesType),
      'bloodLabel': l10n.t('ui.text.4ddfa1aa5aae'),
      'insulinLabel': l10n.t('ui.text.095b53d7bc3d'),
      'allergiesLabel': l10n.t('ui.text.e6a77479f56d'),
      'contactLabel': l10n.t('ui.text.3e94778f0e1e'),
      'phoneLabel': l10n.t('phone'),
      'instructionTitle': l10n.t('emergencyInfo'),
      'instructionText': emergencyInstructionText(state.languageCode),
      'call112Label': l10n.t('ui.text.62b398e1a490'),
      'myLocationLabel': l10n.t('sos.myLocation'),
      'callContactLabel': l10n.t('ui.text.3e94778f0e1e'),
      'showQrLabel': l10n.t('sos.showQr'),
      'medicalCardLabel': l10n.t('sos.medicalCard'),
      'sendLocationActionLabel': l10n.t('sos.sendLocation'),
      'openMapLabel': l10n.t('sos.openMap'),
      'sendSmsLabel': '${emergencyProfileText(state.languageCode, 1)} - '
          '${emergencyProfileText(state.languageCode, 2)}',
      'closeLabel': l10n.t('ui.text.a11f046ebe12'),
      'openCardLabel': l10n.t('ui.text.4660c05f61ac'),
      'qrDescription': l10n.t('emergencyInfo'),
      'locationUnavailable': l10n.t('sos.locationUnavailable'),
      'smsUnavailable': l10n.t('sos.smsUnavailable'),
      'locationPermissionRequired': l10n.t('sos.locationPermissionRequired'),
      'notificationChannelName': l10n.t('emergencyCard'),
      'notificationChannelDescription': l10n.t('emergencyInfo'),
      'qrLabel': l10n.t('emergencyCard'),
    };
  }

  Future<void> dial(String phone) async {
    await _channel.invokeMethod<void>('dial', {'phone': phone});
  }

  Future<void> composeSms(String phone, String message) async {
    await _channel.invokeMethod<void>('composeSms', {
      'phone': phone,
      'message': message,
    });
  }
}
