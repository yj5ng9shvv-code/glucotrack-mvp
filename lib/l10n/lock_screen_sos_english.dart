import '../models/app_state.dart';
import 'emergency_card_value_translations.dart';

const lockScreenSosEnglishLabels = <String, String>{
  'cardTitle': 'Emergency Medical Card',
  'sosTitle': 'SOS',
  'holdToActivateLabel': 'Hold for 2 seconds to activate SOS',
  'emergencyMedicalCardLabel': 'Emergency Medical Card',
  'medicalInfoLabel': 'Medical Information',
  'emergencyHelpCardLabel': 'Emergency Medical Card',
  'nameLabel': 'Name',
  'glucoseLabel': 'Current Glucose',
  'lastUpdatedLabel': 'Last updated',
  'diabetesLabel': 'Diabetes Type',
  'bloodLabel': 'Blood Type',
  'insulinLabel': 'Insulin',
  'allergiesLabel': 'ALLERGY',
  'contactLabel': 'Emergency Contact',
  'phoneLabel': 'Phone',
  'instructionTitle': 'Notes',
  'call112Label': 'Call 112',
  'myLocationLabel': 'My Location',
  'callContactLabel': 'Call Emergency Contact',
  'showQrLabel': 'Show QR',
  'medicalCardLabel': 'Medical Card',
  'sendLocationActionLabel': 'Send Location',
  'openMapLabel': 'Open Map',
  'closeLabel': 'Close',
  'openCardLabel': 'Open Card',
  'qrDescription': 'Emergency Information',
  'locationUnavailable': 'Location unavailable',
  'smsUnavailable': 'SMS unavailable',
  'locationPermissionRequired': 'Location permission is required',
  'notificationChannelName': 'Emergency Medical Card',
  'notificationChannelDescription': 'Emergency Information',
  'qrLabel': 'Emergency Medical Card',
  'yes': 'Yes',
  'no': 'No',
  'noData': 'No data',
  'separator': ' · ',
};

String lockScreenSosEnglishDiabetesType(DiabetesType type) {
  return switch (type) {
    DiabetesType.type1 => 'Type 1 Diabetes',
    DiabetesType.type2 => 'Type 2 Diabetes',
    DiabetesType.gestational => 'Gestational Diabetes',
  };
}

String lockScreenSosEnglishEmergencyInstruction(String value) {
  if (isDefaultEmergencyInstruction(value)) {
    return emergencyInstructionText('en');
  }
  return value.trim();
}

String lockScreenSosEnglishAllergies(String value) {
  final normalized = _normalizedSystemValue(value);
  if (_isNoneValue(normalized)) return 'No allergies';
  return value.trim();
}

String lockScreenSosEnglishSystemValue(String value) {
  final normalized = _normalizedSystemValue(value);
  if (normalized.isEmpty) return '';
  if (_isNoneValue(normalized)) return 'None';
  if (isInsulinAndTabletsValue(value)) return insulinAndTabletsText('en');
  return value.trim();
}

bool _isNoneValue(String normalized) {
  return normalized.isEmpty ||
      normalized == 'no' ||
      normalized == 'none' ||
      normalized == 'нет' ||
      normalized == 'brak' ||
      normalized == 'не';
}

String _normalizedSystemValue(String value) => value.trim().toLowerCase();
