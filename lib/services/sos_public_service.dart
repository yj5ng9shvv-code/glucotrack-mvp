import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/app_state.dart';
import '../l10n/app_localizations.dart';
import '../l10n/emergency_card_value_translations.dart';
import '../l10n/sos_translations.dart';
import 'auth_service.dart';

class SosPublicService {
  SosPublicService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String publicUrl(String token) {
    final base = AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
    return token.isEmpty ? '' : '$base/sos/$token';
  }

  Future<void> sendScanLocation({
    required String token,
    required double latitude,
    required double longitude,
    double? accuracy,
  }) async {
    if (token.trim().isEmpty || AuthService.apiBaseUrl.isEmpty) return;
    await _client
        .post(
          Uri.parse(
            '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}/sos/$token/scan',
          ),
          headers: {'Content-Type': 'application/json; charset=utf-8'},
          body: jsonEncode({
            'latitude': latitude,
            'longitude': longitude,
            if (accuracy != null) 'accuracy': accuracy,
          }),
        )
        .timeout(const Duration(seconds: 12));
  }

  Future<String> publish(AppState state) async {
    if (!state.isAuthenticated || AuthService.apiBaseUrl.isEmpty) {
      throw const SosPublishException('AUTH_REQUIRED');
    }
    final l10n = AppLocalizations(state.languageCode);
    final glucoseMmol = state.latestSosGlucoseMmol;
    final glucoseUpdatedAt = state.latestSosGlucoseAt;
    final response = await _client
        .post(
          Uri.parse(
            '${AuthService.apiBaseUrl.replaceFirst(RegExp(r'/$'), '')}/sos/profile',
          ),
          headers: {
            'Authorization': 'Bearer ${state.accountToken}',
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: jsonEncode({
            'pin': state.sosAccessPin,
            'hideSensitive': state.hideSensitiveSosData,
            'card': {
              'fullName': state.fullName,
              'age': state.age,
              'photoBase64': state.profilePhotoBytes == null
                  ? null
                  : base64Encode(state.profilePhotoBytes!),
              'diabetesType': state.diabetesType.name,
              'diabetesTreatment': state.diabetesTreatment,
              'insulinName': state.insulinName,
              'importantDiagnoses': state.importantDiagnoses,
              'hasAllergy': state.hasAllergies,
              'hasAllergies': state.hasAllergies,
              'allergyStatusCode': state.hasAllergies ? 'yes' : 'no',
              'allergyStatus': state.hasAllergies ? 'YES' : 'NO',
              'allergies': state.hasAllergies ? state.allergies : '',
              'medications': state.medications,
              'contactName': state.emergencyContactName,
              'contactPhone': state.emergencyContactPhone,
              'additionalContacts': state.additionalEmergencyContacts,
              'doctorContact': state.doctorContact,
              'bloodType': state.bloodType,
              'currentGlucose': glucoseMmol == null
                  ? l10n.t('sos.noData')
                  : state.formatGlucose(glucoseMmol),
              'currentGlucoseMmol': glucoseMmol,
              'glucoseUpdatedAt': glucoseUpdatedAt == null
                  ? ''
                  : state.formatSosGlucoseUpdatedAt(glucoseUpdatedAt),
              'communicationLanguages': state.communicationLanguages,
              'instructions': state.emergencyInstructions,
              'languageCode': state.languageCode,
              'labels': {
                'patient': l10n.t('sos.patient'),
                'diabetes': l10n.t('sos.diabetes'),
                'diabetesType': l10n.t('diabetesType'),
                'type1': l10n.t('diabetesType1'),
                'type2': l10n.t('diabetesType2'),
                'gestational': l10n.t('diabetesGestational'),
                'treatment': l10n.t('sos.treatment'),
                'bloodType': l10n.t('sos.blood_type'),
                'languages': l10n.t('sos.languages'),
                'call112': l10n.format(
                  'sosPublicCard.callEmergencyWithNumber',
                  {'number': '112'},
                ),
                'callRelative': l10n.t('sosPublicCard.callRelative'),
                'callRelativeWithName': l10n.t(
                  'sosPublicCard.callRelativeWithName',
                ),
                'sendSms': l10n.t('sosPublicCard.sendSosSmsWithLocation'),
                'geoConsent': l10n.t('sos.locationPermissionRequired'),
                'sensitiveHidden': l10n.t('sos.sensitive_hidden'),
                'pinPrompt': l10n.t('sos.relative_doctor_pin'),
                'open': l10n.t('ui.text.b8492630be62'),
                'disclaimer': l10n.t('medicalDisclaimer'),
                'name': l10n.t('name'),
                'currentGlucose': l10n.t('currentGlucose'),
                'lastUpdated': l10n.t('sos.lastUpdated'),
                'noData': l10n.t('sos.noData'),
                'age': l10n.t('age'),
                'diagnoses': l10n.t('sos.diagnoses'),
                'insulin': l10n.t('sos.insulin'),
                'allergies': l10n.t('sos.allergies'),
                'allergyStatus': l10n.t('sos.allergyStatus'),
                'allergyDetails': l10n.t('sos.allergyDetails'),
                'medications': l10n.t('sos.medications'),
                'doctor': l10n.t('sos.doctor_clinic'),
                'otherContacts': l10n.t('sos.other_relatives'),
                'checking': sosText(state.languageCode, 'checking'),
                'success': l10n.t('settingsSaved'),
                'error': l10n.t('networkUnavailable'),
                'instruction': emergencyInstructionText(state.languageCode),
              },
            },
          }),
        )
        .timeout(const Duration(seconds: 20));

    final body = jsonDecode(response.body);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body is! Map) {
      throw const SosPublishException('NETWORK_ERROR');
    }
    final token = body['token']?.toString() ?? '';
    if (token.isEmpty) {
      throw const SosPublishException('INVALID_RESPONSE');
    }
    return token;
  }
}

class SosPublishException implements Exception {
  const SosPublishException(this.message);

  final String message;

  @override
  String toString() => message;
}
