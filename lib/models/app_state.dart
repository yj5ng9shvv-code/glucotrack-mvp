import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../platform/language_query.dart';
import '../l10n/emergency_card_value_translations.dart';
import 'diary_log_entry.dart';
import 'sensor_reading.dart';
import '../services/auth_service.dart';

enum DiabetesType { type1, type2, gestational }

enum GlucoseUnitPreference { auto, mmolL, mgDl }

enum GlucoseUnit { mmolL, mgDl }

class AppLanguage {
  final String code;
  final String label;
  final String flag;
  final Locale locale;

  const AppLanguage({
    required this.code,
    required this.label,
    required this.flag,
    required this.locale,
  });
}

typedef EmergencyCardUpdater = Future<void> Function(AppState state);

class AppState extends ChangeNotifier {
  AppState({AuthService? authService, this.emergencyCardUpdater})
      : _authService = authService ?? AuthService();

  final AuthService _authService;
  EmergencyCardUpdater? emergencyCardUpdater;
  static const supportedLanguages = <AppLanguage>[
    AppLanguage(code: 'en', label: 'English', flag: 'GB', locale: Locale('en')),
    AppLanguage(code: 'de', label: 'Deutsch', flag: 'DE', locale: Locale('de')),
    AppLanguage(
        code: 'fr', label: 'Fran\u00E7ais', flag: 'FR', locale: Locale('fr')),
    AppLanguage(
        code: 'es', label: 'Espa\u00F1ol', flag: 'ES', locale: Locale('es')),
    AppLanguage(
        code: 'it', label: 'Italiano', flag: 'IT', locale: Locale('it')),
    AppLanguage(code: 'pl', label: 'Polski', flag: 'PL', locale: Locale('pl')),
    AppLanguage(
        code: 'uk',
        label: '\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430',
        flag: 'UA',
        locale: Locale('uk')),
    AppLanguage(
        code: 'ru',
        label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439',
        flag: 'RU',
        locale: Locale('ru')),
    AppLanguage(
        code: 'pt', label: 'Portugu\u00EAs', flag: 'PT', locale: Locale('pt')),
    AppLanguage(
        code: 'nl', label: 'Nederlands', flag: 'NL', locale: Locale('nl')),
    AppLanguage(
        code: 'ro',
        label: 'Rom\u00E2n\u0103',
        flag: 'RO',
        locale: Locale('ro')),
    AppLanguage(
        code: 'cs',
        label: '\u010Ce\u0161tina',
        flag: 'CZ',
        locale: Locale('cs')),
    AppLanguage(
        code: 'sk', label: 'Sloven\u010Dina', flag: 'SK', locale: Locale('sk')),
    AppLanguage(code: 'hu', label: 'Magyar', flag: 'HU', locale: Locale('hu')),
    AppLanguage(code: 'sv', label: 'Svenska', flag: 'SE', locale: Locale('sv')),
    AppLanguage(code: 'da', label: 'Dansk', flag: 'DK', locale: Locale('da')),
    AppLanguage(code: 'fi', label: 'Suomi', flag: 'FI', locale: Locale('fi')),
    AppLanguage(code: 'no', label: 'Norsk', flag: 'NO', locale: Locale('no')),
    AppLanguage(
        code: 'el',
        label: '\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC',
        flag: 'GR',
        locale: Locale('el')),
    AppLanguage(
        code: 'tr',
        label: 'T\u00FCrk\u00E7e',
        flag: 'TR',
        locale: Locale('tr')),
    AppLanguage(
        code: 'bg',
        label: '\u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438',
        flag: 'BG',
        locale: Locale('bg')),
    AppLanguage(
        code: 'hr', label: 'Hrvatski', flag: 'HR', locale: Locale('hr')),
    AppLanguage(
        code: 'sl',
        label: 'Sloven\u0161\u010Dina',
        flag: 'SI',
        locale: Locale('sl')),
    AppLanguage(
        code: 'lt', label: 'Lietuvi\u0173', flag: 'LT', locale: Locale('lt')),
    AppLanguage(
        code: 'lv', label: 'Latvie\u0161u', flag: 'LV', locale: Locale('lv')),
    AppLanguage(code: 'et', label: 'Eesti', flag: 'EE', locale: Locale('et')),
    AppLanguage(
        code: 'sr',
        label: '\u0421\u0440\u043F\u0441\u043A\u0438',
        flag: 'RS',
        locale: Locale('sr')),
    AppLanguage(code: 'sq', label: 'Shqip', flag: 'AL', locale: Locale('sq')),
    AppLanguage(
        code: 'mk',
        label: '\u041C\u0430\u043A\u0435\u0434\u043E\u043D\u0441\u043A\u0438',
        flag: 'MK',
        locale: Locale('mk')),
    AppLanguage(
        code: 'is', label: '\u00CDslenska', flag: 'IS', locale: Locale('is')),
  ];

  static String normalizeLanguageCode(String? value) {
    final candidate = (value ?? '').trim().replaceAll('_', '-').toLowerCase();
    if (candidate.isEmpty) return supportedLanguages.first.code;
    for (final language in supportedLanguages) {
      if (language.code.toLowerCase() == candidate) return language.code;
    }
    final base = candidate.split('-').first;
    for (final language in supportedLanguages) {
      if (language.code.toLowerCase() == base) return language.code;
    }
    return supportedLanguages.first.code;
  }

  DiabetesType diabetesType = DiabetesType.type1;
  double glucoseMmol = 6.2;
  double insulinToCarbRatio = 10; // 1 unit per 10 g carbs
  double correctionFactor = 2.0; // 1 unit lowers glucose by 2 mmol/L
  double targetGlucose = 6.0;
  bool premium = false;
  String premiumStatus = 'inactive';
  String? premiumPlan;
  DateTime? premiumUntil;
  String languageCode = 'ru';
  GlucoseUnitPreference glucoseUnitPreference = GlucoseUnitPreference.auto;

  String fullName = '';
  String email = '';
  String phone = '';
  int age = 0;
  double weightKg = 0;
  double heightCm = 0;
  String bloodType = '';
  String insulinName = '';
  bool hasAllergies = false;
  String allergies = '';
  String importantDiagnoses = '';
  String diabetesTreatment = '';
  String medications = '';
  String doctorContact = '';
  String communicationLanguages = '';
  String emergencyInstructions = defaultEmergencyInstructionSource;
  String emergencyContactName = '';
  String emergencyContactPhone = '';
  String additionalEmergencyContacts = '';
  bool hideSensitiveSosData = true;
  String sosAccessPin = '';
  String sosPublicToken = '';
  bool sosEnabled = false;
  bool showEmergencyOnLockScreen = false;
  bool sosSmsEnabled = false;
  bool sosLocationEnabled = false;
  bool sosAutoCallEnabled = false;
  double sosThresholdMmol = 3.1;
  int sosEscalationMinutes = 3;
  Uint8List? profilePhotoBytes;
  SensorBrand? connectedSensorBrand;
  DateTime? lastSensorSyncAt;
  List<SensorReading> sensorReadings = [];
  List<DiaryLogEntry> diaryEntries = [];
  bool onboardingCompleted = false;
  bool medicalDisclaimerAccepted = false;
  bool cloudSyncEnabled = false;
  DateTime? lastCloudSyncAt;

  String _accountEmail = '';
  String _accountToken = '';
  String _accountRefreshToken = '';
  bool _authenticated = false;

  bool _loaded = false;

  bool get loaded => _loaded;
  bool get hasAccount => _accountEmail.isNotEmpty;
  bool get isAuthenticated => _authenticated;
  String get accountEmail => _accountEmail;
  String get accountToken => _accountToken;
  bool get isTrialing => premiumStatus == 'trialing';
  bool get isTrialEndingTomorrow {
    final until = premiumUntil;
    if (!isTrialing || until == null) return false;
    final remaining = until.difference(DateTime.now());
    return remaining > Duration.zero && remaining <= const Duration(days: 1);
  }

  Locale get locale => supportedLanguages
      .firstWhere(
        (language) => language.code == languageCode,
        orElse: () => supportedLanguages.first,
      )
      .locale;

  String get languageLabel => supportedLanguages
      .firstWhere(
        (language) => language.code == languageCode,
        orElse: () => supportedLanguages.first,
      )
      .label;

  GlucoseUnit get glucoseUnit {
    return glucoseUnitForPreference(glucoseUnitPreference);
  }

  GlucoseUnit glucoseUnitForPreference(GlucoseUnitPreference preference) {
    return switch (preference) {
      GlucoseUnitPreference.mmolL => GlucoseUnit.mmolL,
      GlucoseUnitPreference.mgDl => GlucoseUnit.mgDl,
      GlucoseUnitPreference.auto =>
        _defaultGlucoseUnitForLanguage(languageCode),
    };
  }

  String get glucoseUnitLabel {
    return glucoseUnit == GlucoseUnit.mgDl ? 'mg/dL' : 'mmol/L';
  }

  double glucoseToDisplay(double mmolValue) {
    return glucoseUnit == GlucoseUnit.mgDl ? mmolValue * 18.0182 : mmolValue;
  }

  double glucoseFromDisplay(double displayValue) {
    return glucoseUnit == GlucoseUnit.mgDl
        ? displayValue / 18.0182
        : displayValue;
  }

  String formatGlucose(double mmolValue) {
    final value = glucoseToDisplay(mmolValue);
    final decimals = glucoseUnit == GlucoseUnit.mgDl ? 0 : 1;
    return '${value.toStringAsFixed(decimals)} $glucoseUnitLabel';
  }

  DiaryLogEntry? get latestGlucoseDiaryEntry {
    for (final entry in diaryEntries) {
      if (entry.glucoseMmol > 0) return entry;
    }
    return null;
  }

  SensorReading? get latestSensorGlucoseReading {
    for (final reading in sensorReadings) {
      if (reading.glucoseMmol > 0) return reading;
    }
    return null;
  }

  double? get latestSosGlucoseMmol {
    final diaryEntry = latestGlucoseDiaryEntry;
    if (diaryEntry != null) return diaryEntry.glucoseMmol;
    final sensorReading = latestSensorGlucoseReading;
    if (sensorReading != null) return sensorReading.glucoseMmol;
    return glucoseMmol > 0 ? glucoseMmol : null;
  }

  DateTime? get latestSosGlucoseAt {
    final diaryEntry = latestGlucoseDiaryEntry;
    if (diaryEntry != null) return diaryEntry.time;
    final sensorReading = latestSensorGlucoseReading;
    if (sensorReading != null) return sensorReading.time;
    return null;
  }

  String formatSosGlucoseUpdatedAt(DateTime time) {
    String two(int value) => value.toString().padLeft(2, '0');
    return '${two(time.day)}.${two(time.month)}.${time.year} '
        '${two(time.hour)}:${two(time.minute)}';
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _accountEmail = prefs.getString('accountEmail') ?? '';
    _accountToken = prefs.getString('accountToken') ?? '';
    _accountRefreshToken = prefs.getString('accountRefreshToken') ?? '';
    final restoredSession = _accountToken.isEmpty
        ? null
        : await _authService.restoreSession(
            _accountToken,
            refreshToken: _accountRefreshToken,
          );
    _authenticated = restoredSession != null;
    if (!_authenticated) {
      _accountToken = '';
      _accountRefreshToken = '';
      await prefs.remove('accountToken');
      await prefs.remove('accountRefreshToken');
    }
    if (restoredSession != null) {
      _accountToken = restoredSession.token;
      _accountRefreshToken =
          restoredSession.refreshToken ?? _accountRefreshToken;
      _applyAuthSession(restoredSession);
      await _persistAuthTokens(prefs);
    }
    final diabetesTypeIndex = prefs.getInt('diabetesType') ?? 0;
    diabetesType =
        diabetesTypeIndex >= 0 && diabetesTypeIndex < DiabetesType.values.length
            ? DiabetesType.values[diabetesTypeIndex]
            : DiabetesType.type1;
    glucoseMmol = prefs.getDouble('glucoseMmol') ?? glucoseMmol;
    insulinToCarbRatio =
        prefs.getDouble('insulinToCarbRatio') ?? insulinToCarbRatio;
    correctionFactor = prefs.getDouble('correctionFactor') ?? correctionFactor;
    targetGlucose = prefs.getDouble('targetGlucose') ?? targetGlucose;
    final storedLanguage = prefs.getString('languageCode');
    languageCode = normalizeLanguageCode(storedLanguage ?? languageCode);
    if (storedLanguage != languageCode) {
      await prefs.setString('languageCode', languageCode);
    }
    final requestedLanguage = requestedLanguageCode();
    if (requestedLanguage != null) {
      languageCode = normalizeLanguageCode(requestedLanguage);
      await prefs.setString('languageCode', languageCode);
    }
    onboardingCompleted =
        prefs.getBool('onboardingCompleted') ?? onboardingCompleted;
    medicalDisclaimerAccepted =
        prefs.getBool('medicalDisclaimerAccepted') ?? medicalDisclaimerAccepted;
    cloudSyncEnabled = prefs.getBool('cloudSyncEnabled') ?? cloudSyncEnabled;
    final cloudSyncText = prefs.getString('lastCloudSyncAt');
    lastCloudSyncAt =
        cloudSyncText == null ? null : DateTime.tryParse(cloudSyncText);
    glucoseUnitPreference = _enumValue(
      GlucoseUnitPreference.values,
      prefs.getString('glucoseUnitPreference') ?? glucoseUnitPreference.name,
      GlucoseUnitPreference.auto,
    );
    // Server profile is authoritative after cache loss or stale local values.

    fullName = prefs.getString('fullName') ?? fullName;
    email = prefs.getString('email') ?? email;
    phone = prefs.getString('phone') ?? phone;
    age = prefs.getInt('age') ?? age;
    weightKg = prefs.getDouble('weightKg') ?? weightKg;
    heightCm = prefs.getDouble('heightCm') ?? heightCm;
    bloodType = prefs.getString('bloodType') ?? bloodType;
    insulinName = prefs.getString('insulinName') ?? insulinName;
    allergies = prefs.getString('allergies') ?? allergies;
    hasAllergies =
        prefs.getBool('hasAllergies') ?? _legacyAllergyTextMeansYes(allergies);
    importantDiagnoses =
        prefs.getString('importantDiagnoses') ?? importantDiagnoses;
    diabetesTreatment =
        prefs.getString('diabetesTreatment') ?? diabetesTreatment;
    medications = prefs.getString('medications') ?? medications;
    doctorContact = prefs.getString('doctorContact') ?? doctorContact;
    communicationLanguages =
        prefs.getString('communicationLanguages') ?? communicationLanguages;
    emergencyInstructions =
        prefs.getString('emergencyInstructions') ?? emergencyInstructions;
    emergencyContactName =
        prefs.getString('emergencyContactName') ?? emergencyContactName;
    emergencyContactPhone =
        prefs.getString('emergencyContactPhone') ?? emergencyContactPhone;
    additionalEmergencyContacts = prefs.getString(
          'additionalEmergencyContacts',
        ) ??
        additionalEmergencyContacts;
    hideSensitiveSosData =
        prefs.getBool('hideSensitiveSosData') ?? hideSensitiveSosData;
    sosAccessPin = prefs.getString('sosAccessPin') ?? sosAccessPin;
    sosPublicToken = prefs.getString('sosPublicToken') ?? sosPublicToken;
    sosEnabled = prefs.getBool('sosEnabled') ?? sosEnabled;
    showEmergencyOnLockScreen =
        prefs.getBool('showEmergencyOnLockScreen') ?? showEmergencyOnLockScreen;
    sosSmsEnabled = prefs.getBool('sosSmsEnabled') ?? sosSmsEnabled;
    sosLocationEnabled =
        prefs.getBool('sosLocationEnabled') ?? sosLocationEnabled;
    sosAutoCallEnabled =
        prefs.getBool('sosAutoCallEnabled') ?? sosAutoCallEnabled;
    sosThresholdMmol = prefs.getDouble('sosThresholdMmol') ?? sosThresholdMmol;
    sosEscalationMinutes =
        prefs.getInt('sosEscalationMinutes') ?? sosEscalationMinutes;
    final lockScreenMigrationVersion =
        prefs.getInt('lockScreenCardMigrationVersion') ?? 0;
    if (lockScreenMigrationVersion < 2) {
      showEmergencyOnLockScreen = true;
      await prefs.setBool(
        'showEmergencyOnLockScreen',
        showEmergencyOnLockScreen,
      );
      await prefs.setInt('lockScreenCardMigrationVersion', 2);
    }

    final photoBase64 = prefs.getString('profilePhotoBase64');
    if (photoBase64 != null && photoBase64.isNotEmpty) {
      profilePhotoBytes = base64Decode(photoBase64);
    }
    final sensorBrandName = prefs.getString('connectedSensorBrand');
    connectedSensorBrand = sensorBrandName == null
        ? null
        : _enumValue(SensorBrand.values, sensorBrandName, SensorBrand.manual);
    final lastSyncText = prefs.getString('lastSensorSyncAt');
    lastSensorSyncAt =
        lastSyncText == null ? null : DateTime.tryParse(lastSyncText);
    final readingsJson = prefs.getString('sensorReadings');
    if (readingsJson != null && readingsJson.isNotEmpty) {
      final decoded = jsonDecode(readingsJson);
      if (decoded is List) {
        sensorReadings = decoded
            .whereType<Map>()
            .map((item) => SensorReading.fromJson(
                  item.map((key, value) => MapEntry(key.toString(), value)),
                ))
            .toList()
          ..sort((a, b) => b.time.compareTo(a.time));
      }
    }
    final diaryJson = prefs.getString('diaryEntries');
    if (diaryJson != null && diaryJson.isNotEmpty) {
      final decoded = jsonDecode(diaryJson);
      if (decoded is List) {
        diaryEntries = decoded
            .whereType<Map>()
            .map((item) => DiaryLogEntry.fromJson(
                  item.map((key, value) => MapEntry(key.toString(), value)),
                ))
            .toList()
          ..sort((a, b) => b.time.compareTo(a.time));
      }
    }
    _syncCachedGlucoseFromLatestSource(clearIfMissing: false);

    _loaded = true;
    notifyListeners();
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty || password.length < 8) {
      throw ArgumentError('Invalid registration data');
    }

    final session = await _authService.register(
      name: name.trim(),
      email: normalizedEmail,
      password: password,
      locale: languageCode,
    );
    _accountEmail = session.email;
    _accountToken = session.token;
    _accountRefreshToken = session.refreshToken ?? '';
    _authenticated = true;
    fullName = session.fullName;
    this.email = session.email;
    _applyPremium(
      active: session.premium,
      status: session.premiumStatus,
      plan: session.premiumPlan,
      until: session.premiumUntil,
    );
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accountEmail', _accountEmail);
    await prefs.setString('accountToken', _accountToken);
    await _persistAuthTokens(prefs);
    await prefs.setString('fullName', fullName);
    await prefs.setString('email', email);
  }

  Future<bool> login({required String email, required String password}) async {
    final session = await _authService.login(
      email: email.trim().toLowerCase(),
      password: password,
      locale: languageCode,
    );
    _accountEmail = session.email;
    _accountToken = session.token;
    _accountRefreshToken = session.refreshToken ?? '';
    _applyAuthSession(session);
    _authenticated = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accountEmail', _accountEmail);
    await prefs.setString('accountToken', _accountToken);
    await _persistAuthTokens(prefs);
    return true;
  }

  Future<void> loginWithGoogle(String idToken) async {
    final session = await _authService.loginWithGoogle(
      idToken,
      locale: languageCode,
    );
    _accountEmail = session.email;
    _accountToken = session.token;
    _accountRefreshToken = session.refreshToken ?? '';
    _authenticated = true;
    _applyAuthSession(session);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accountEmail', _accountEmail);
    await prefs.setString('accountToken', _accountToken);
    await _persistAuthTokens(prefs);
    await prefs.setString('fullName', fullName);
    await prefs.setString('email', email);
  }

  Future<void> loginWithApple(
    String identityToken, {
    String? email,
    String? fullName,
  }) async {
    final session = await _authService.loginWithApple(
      identityToken,
      email: email,
      fullName: fullName,
      locale: languageCode,
    );
    _accountEmail = session.email;
    _accountToken = session.token;
    _accountRefreshToken = session.refreshToken ?? '';
    _authenticated = true;
    _applyAuthSession(session);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accountEmail', _accountEmail);
    await prefs.setString('accountToken', _accountToken);
    await _persistAuthTokens(prefs);
    await prefs.setString('fullName', this.fullName);
    await prefs.setString('email', this.email);
  }

  Future<void> logout() async {
    final token = _accountToken;
    if (token.isNotEmpty) {
      try {
        await _authService.logout(
          token,
          refreshToken:
              _accountRefreshToken.isNotEmpty ? _accountRefreshToken : null,
        );
      } on Exception {
        // Local logout must still complete when the network is unavailable.
      }
    }
    _authenticated = false;
    _accountToken = '';
    _accountRefreshToken = '';
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accountToken');
    await prefs.remove('accountRefreshToken');
  }

  Future<void> useDeviceManagementToken(String token) async {
    _accountToken = token;
    _accountRefreshToken = '';
    _authenticated = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accountToken', token);
    await prefs.remove('accountRefreshToken');
    notifyListeners();
  }

  Future<void> setGlucose(double value) async {
    glucoseMmol = value;
    notifyListeners();
    await _saveDouble('glucoseMmol', value);
  }

  Future<void> recordGlucoseMeasurement(double displayValue) async {
    final mmolValue = glucoseFromDisplay(displayValue);
    if (mmolValue < 1.0 || mmolValue > 35.0) {
      throw ArgumentError('Glucose value is outside the supported range');
    }
    await addDiaryEntry(
      DiaryLogEntry(
        id: 'glucose-${DateTime.now().microsecondsSinceEpoch}',
        time: DateTime.now(),
        type: DiaryLogType.glucose,
        glucoseMmol: mmolValue,
        carbs: 0,
        insulinUnits: 0,
        title: 'Glucose measurement',
        note: 'Manual measurement',
        source: SensorBrand.manual,
      ),
    );
  }

  Future<void> setDiabetesType(DiabetesType value) async {
    diabetesType = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('diabetesType', value.index);
    await _refreshEmergencyCard();
  }

  Future<void> _persistAuthTokens(SharedPreferences prefs) async {
    await prefs.setString('accountToken', _accountToken);
    if (_accountRefreshToken.isEmpty) {
      await prefs.remove('accountRefreshToken');
    } else {
      await prefs.setString('accountRefreshToken', _accountRefreshToken);
    }
  }

  void updateServerSubscription({
    required bool active,
    required String status,
    String? plan,
    DateTime? until,
  }) {
    _applyPremium(active: active, status: status, plan: plan, until: until);
    notifyListeners();
  }

  void _applyPremium({
    required bool active,
    required String status,
    String? plan,
    DateTime? until,
  }) {
    premium = active;
    premiumStatus = status;
    premiumPlan = plan;
    premiumUntil = until;
  }

  void _applyAuthSession(AuthSession session) {
    _accountEmail = session.email;
    if (session.fullName.isNotEmpty) fullName = session.fullName;
    email = session.email;
    _applyPremium(
      active: session.premium,
      status: session.premiumStatus,
      plan: session.premiumPlan,
      until: session.premiumUntil,
    );
    if (session.onboardingCompleted) {
      diabetesType = _enumValue(
          DiabetesType.values, session.diabetesType ?? '', diabetesType);
      glucoseUnitPreference = _enumValue(GlucoseUnitPreference.values,
          session.glucoseUnit ?? '', glucoseUnitPreference);
      onboardingCompleted = true;
    }
  }

  Future<void> completeOnboarding(
      DiabetesType type, GlucoseUnitPreference unit, bool accepted) async {
    await _authService.saveOnboardingProfile(
        _accountToken, type.name, unit.name);
    await setDiabetesType(type);
    await setGlucoseUnitPreference(unit);
    await setMedicalDisclaimerAccepted(accepted);
    await setOnboardingCompleted(true);
  }

  Future<void> setOnboardingCompleted(bool value) async {
    onboardingCompleted = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboardingCompleted', value);
  }

  Future<void> setMedicalDisclaimerAccepted(bool value) async {
    medicalDisclaimerAccepted = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('medicalDisclaimerAccepted', value);
  }

  Future<void> setCloudSyncEnabled(bool value) async {
    cloudSyncEnabled = value;
    lastCloudSyncAt = value ? DateTime.now() : null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('cloudSyncEnabled', value);
    if (lastCloudSyncAt == null) {
      await prefs.remove('lastCloudSyncAt');
    } else {
      await prefs.setString(
          'lastCloudSyncAt', lastCloudSyncAt!.toIso8601String());
    }
  }

  Future<void> setLanguage(String value) async {
    languageCode = normalizeLanguageCode(value);
    updateRequestedLanguageCode(languageCode);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('languageCode', languageCode);
    await _refreshEmergencyCard();
  }

  Future<void> _refreshEmergencyCard() async {
    final updater = emergencyCardUpdater;
    if (updater == null) return;
    try {
      await updater(this);
    } catch (_) {
      // Android presentation refresh is best-effort on non-Android builds.
    }
  }

  Future<void> setGlucoseUnitPreference(GlucoseUnitPreference value) async {
    glucoseUnitPreference = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('glucoseUnitPreference', value.name);
    await _refreshEmergencyCard();
  }

  Future<void> updateUserProfile({
    required String fullName,
    required String email,
    required String phone,
    required int age,
    required double weightKg,
    required double heightCm,
  }) async {
    this.fullName = fullName.trim();
    this.email = email.trim();
    this.phone = phone.trim();
    this.age = age < 0 ? 0 : age;
    this.weightKg = weightKg < 0 ? 0 : weightKg;
    this.heightCm = heightCm < 0 ? 0 : heightCm;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('fullName', this.fullName);
    await prefs.setString('email', this.email);
    await prefs.setString('phone', this.phone);
    await prefs.setInt('age', this.age);
    await prefs.setDouble('weightKg', this.weightKg);
    await prefs.setDouble('heightCm', this.heightCm);
    await _refreshEmergencyCard();
  }

  Future<void> updateMedicalSettings({
    required DiabetesType diabetesType,
    required double targetGlucose,
    required double insulinToCarbRatio,
    required double correctionFactor,
  }) async {
    this.diabetesType = diabetesType;
    this.targetGlucose = targetGlucose > 0 ? targetGlucose : this.targetGlucose;
    this.insulinToCarbRatio =
        insulinToCarbRatio > 0 ? insulinToCarbRatio : this.insulinToCarbRatio;
    this.correctionFactor =
        correctionFactor > 0 ? correctionFactor : this.correctionFactor;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('diabetesType', this.diabetesType.index);
    await prefs.setDouble('targetGlucose', this.targetGlucose);
    await prefs.setDouble('insulinToCarbRatio', this.insulinToCarbRatio);
    await prefs.setDouble('correctionFactor', this.correctionFactor);
    await _refreshEmergencyCard();
  }

  Future<void> updateAllergyProfile({
    required bool hasAllergies,
    required String allergies,
  }) async {
    this.hasAllergies = hasAllergies;
    this.allergies = allergies.trim();
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('hasAllergies', this.hasAllergies);
    await prefs.setString('allergies', this.allergies);
    await _refreshEmergencyCard();
  }

  Future<void> updateEmergencyProfile({
    required String bloodType,
    required String insulinName,
    required bool hasAllergies,
    required String allergies,
    required String importantDiagnoses,
    required String diabetesTreatment,
    required String medications,
    required String doctorContact,
    required String communicationLanguages,
    required String emergencyInstructions,
    required String emergencyContactName,
    required String emergencyContactPhone,
    required String additionalEmergencyContacts,
    required bool hideSensitiveSosData,
    required String sosAccessPin,
    required bool sosEnabled,
    required bool showEmergencyOnLockScreen,
    required bool sosSmsEnabled,
    required bool sosLocationEnabled,
    required bool sosAutoCallEnabled,
    required double sosThresholdMmol,
    required int sosEscalationMinutes,
  }) async {
    this.bloodType = bloodType.trim();
    this.insulinName = insulinName.trim();
    this.hasAllergies = hasAllergies;
    this.allergies = allergies.trim();
    this.importantDiagnoses = importantDiagnoses.trim();
    this.diabetesTreatment = diabetesTreatment.trim();
    this.medications = medications.trim();
    this.doctorContact = doctorContact.trim();
    this.communicationLanguages = communicationLanguages.trim();
    this.emergencyInstructions = emergencyInstructions.trim();
    this.emergencyContactName = emergencyContactName.trim();
    this.emergencyContactPhone = emergencyContactPhone.trim();
    this.additionalEmergencyContacts = additionalEmergencyContacts.trim();
    this.hideSensitiveSosData = hideSensitiveSosData;
    this.sosAccessPin = sosAccessPin.trim();
    this.sosEnabled = sosEnabled;
    this.showEmergencyOnLockScreen = showEmergencyOnLockScreen;
    this.sosSmsEnabled = sosSmsEnabled;
    this.sosLocationEnabled = sosLocationEnabled;
    this.sosAutoCallEnabled = sosAutoCallEnabled;
    this.sosThresholdMmol =
        sosThresholdMmol > 0 ? sosThresholdMmol : this.sosThresholdMmol;
    this.sosEscalationMinutes = sosEscalationMinutes.clamp(1, 15).toInt();
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('bloodType', this.bloodType);
    await prefs.setString('insulinName', this.insulinName);
    await prefs.setBool('hasAllergies', this.hasAllergies);
    await prefs.setString('allergies', this.allergies);
    await prefs.setString('importantDiagnoses', this.importantDiagnoses);
    await prefs.setString('diabetesTreatment', this.diabetesTreatment);
    await prefs.setString('medications', this.medications);
    await prefs.setString('doctorContact', this.doctorContact);
    await prefs.setString(
      'communicationLanguages',
      this.communicationLanguages,
    );
    await prefs.setString(
      'emergencyInstructions',
      this.emergencyInstructions,
    );
    await prefs.setString('emergencyContactName', this.emergencyContactName);
    await prefs.setString('emergencyContactPhone', this.emergencyContactPhone);
    await prefs.setString(
      'additionalEmergencyContacts',
      this.additionalEmergencyContacts,
    );
    await prefs.setBool('hideSensitiveSosData', this.hideSensitiveSosData);
    await prefs.setString('sosAccessPin', this.sosAccessPin);
    await prefs.setBool('sosEnabled', this.sosEnabled);
    await prefs.setBool(
      'showEmergencyOnLockScreen',
      this.showEmergencyOnLockScreen,
    );
    await prefs.setBool('sosSmsEnabled', this.sosSmsEnabled);
    await prefs.setBool('sosLocationEnabled', this.sosLocationEnabled);
    await prefs.setBool('sosAutoCallEnabled', this.sosAutoCallEnabled);
    await prefs.setDouble('sosThresholdMmol', this.sosThresholdMmol);
    await prefs.setInt('sosEscalationMinutes', this.sosEscalationMinutes);
    await _refreshEmergencyCard();
  }

  Future<void> applyServerSnapshot(Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final localLanguage = prefs.getString('languageCode');

    final profile = payload['profile'];
    if (profile is Map) {
      final data = profile.map((key, value) => MapEntry(key.toString(), value));
      fullName = data['fullName']?.toString() ?? fullName;
      email = data['email']?.toString() ?? email;
      phone = data['phone']?.toString() ?? phone;
      age = (data['age'] as num?)?.toInt() ?? age;
      weightKg = (data['weightKg'] as num?)?.toDouble() ?? weightKg;
      heightCm = (data['heightCm'] as num?)?.toDouble() ?? heightCm;
      final requestedLanguage = requestedLanguageCode();
      final serverLanguage = data['languageCode']?.toString();
      languageCode = normalizeLanguageCode(
        requestedLanguage ?? localLanguage ?? serverLanguage ?? languageCode,
      );
      glucoseMmol = (data['glucoseMmol'] as num?)?.toDouble() ?? glucoseMmol;
      targetGlucose =
          (data['targetGlucoseMmol'] as num?)?.toDouble() ?? targetGlucose;
      insulinToCarbRatio = (data['insulinToCarbRatio'] as num?)?.toDouble() ??
          insulinToCarbRatio;
      correctionFactor =
          (data['correctionFactor'] as num?)?.toDouble() ?? correctionFactor;
      diabetesType = _enumValue(
        DiabetesType.values,
        data['diabetesType']?.toString() ?? '',
        diabetesType,
      );
      glucoseUnitPreference = _enumValue(
        GlucoseUnitPreference.values,
        data['glucoseUnitPreference']?.toString() ?? '',
        glucoseUnitPreference,
      );
      final photo = data['profilePhotoBase64']?.toString();
      if (photo != null && photo.isNotEmpty) {
        profilePhotoBytes = base64Decode(photo);
      }
    }

    final diary = payload['diaryEntries'];
    if (diary is List) {
      diaryEntries = diary
          .whereType<Map>()
          .map((item) => DiaryLogEntry.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ))
          .toList()
        ..sort((a, b) => b.time.compareTo(a.time));
    }
    final readings = payload['sensorReadings'];
    if (readings is List) {
      sensorReadings = readings
          .whereType<Map>()
          .map((item) => SensorReading.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ))
          .toList()
        ..sort((a, b) => b.time.compareTo(a.time));
    }
    final emergency = payload['emergency'];
    if (emergency is Map) {
      final data =
          emergency.map((key, value) => MapEntry(key.toString(), value));
      emergencyContactName =
          data['contactName']?.toString() ?? emergencyContactName;
      emergencyContactPhone =
          data['contactPhone']?.toString() ?? emergencyContactPhone;
      bloodType = data['bloodType']?.toString() ?? bloodType;
      insulinName = data['insulinName']?.toString() ?? insulinName;
      allergies = data['allergies']?.toString() ?? allergies;
      hasAllergies = _boolFromSnapshot(
            data['hasAllergy'],
            fallback: _boolFromSnapshot(data['hasAllergies']),
          ) ??
          _legacyAllergyTextMeansYes(allergies);
      importantDiagnoses =
          data['importantDiagnoses']?.toString() ?? importantDiagnoses;
      diabetesTreatment =
          data['diabetesTreatment']?.toString() ?? diabetesTreatment;
      medications = data['medications']?.toString() ?? medications;
      doctorContact = data['doctorContact']?.toString() ?? doctorContact;
      communicationLanguages =
          data['communicationLanguages']?.toString() ?? communicationLanguages;
      emergencyInstructions =
          data['emergencyInstructions']?.toString() ?? emergencyInstructions;
      additionalEmergencyContacts =
          data['additionalContacts']?.toString() ?? additionalEmergencyContacts;
      hideSensitiveSosData =
          data['hideSensitive'] as bool? ?? hideSensitiveSosData;
      sosPublicToken = data['publicToken']?.toString() ?? sosPublicToken;
      sosEnabled = data['sosEnabled'] as bool? ?? sosEnabled;
      showEmergencyOnLockScreen = data['showEmergencyOnLockScreen'] as bool? ??
          showEmergencyOnLockScreen;
    }

    await prefs.setString('fullName', fullName);
    await prefs.setString('email', email);
    await prefs.setString('phone', phone);
    await prefs.setInt('age', age);
    await prefs.setDouble('weightKg', weightKg);
    await prefs.setDouble('heightCm', heightCm);
    await prefs.setString('languageCode', languageCode);
    await prefs.setDouble('glucoseMmol', glucoseMmol);
    await prefs.setDouble('targetGlucose', targetGlucose);
    await prefs.setDouble('insulinToCarbRatio', insulinToCarbRatio);
    await prefs.setDouble('correctionFactor', correctionFactor);
    await prefs.setInt('diabetesType', diabetesType.index);
    await prefs.setString('glucoseUnitPreference', glucoseUnitPreference.name);
    await prefs.setString('bloodType', bloodType);
    await prefs.setString('insulinName', insulinName);
    await prefs.setBool('hasAllergies', hasAllergies);
    await prefs.setString('allergies', allergies);
    await prefs.setString('importantDiagnoses', importantDiagnoses);
    await prefs.setString('diabetesTreatment', diabetesTreatment);
    await prefs.setString('medications', medications);
    await prefs.setString('doctorContact', doctorContact);
    await prefs.setString('communicationLanguages', communicationLanguages);
    await prefs.setString('emergencyInstructions', emergencyInstructions);
    await prefs.setString(
      'additionalEmergencyContacts',
      additionalEmergencyContacts,
    );
    await prefs.setBool('hideSensitiveSosData', hideSensitiveSosData);
    await prefs.setString('sosPublicToken', sosPublicToken);
    await prefs.setBool(
      'showEmergencyOnLockScreen',
      showEmergencyOnLockScreen,
    );
    await prefs.setString(
      'diaryEntries',
      jsonEncode(diaryEntries.map((entry) => entry.toJson()).toList()),
    );
    await prefs.setString(
      'sensorReadings',
      jsonEncode(sensorReadings.map((reading) => reading.toJson()).toList()),
    );
    if (profilePhotoBytes != null) {
      await prefs.setString(
        'profilePhotoBase64',
        base64Encode(profilePhotoBytes!),
      );
    }
    notifyListeners();
    await _refreshEmergencyCard();
  }

  Future<void> setProfilePhoto(Uint8List bytes) async {
    profilePhotoBytes = bytes;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('profilePhotoBase64', base64Encode(bytes));
  }

  Future<void> removeProfilePhoto() async {
    profilePhotoBytes = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('profilePhotoBase64');
  }

  Future<void> setSosPublicToken(String value) async {
    sosPublicToken = value.trim();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('sosPublicToken', sosPublicToken);
  }

  Future<void> connectSensor(SensorBrand brand) async {
    connectedSensorBrand = brand;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('connectedSensorBrand', brand.name);
  }

  Future<void> disconnectSensor() async {
    connectedSensorBrand = null;
    lastSensorSyncAt = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('connectedSensorBrand');
    await prefs.remove('lastSensorSyncAt');
  }

  Future<void> addSensorReading(SensorReading reading) async {
    sensorReadings = [reading, ...sensorReadings]
      ..sort((a, b) => b.time.compareTo(a.time));
    if (sensorReadings.length > 288) {
      sensorReadings = sensorReadings.take(288).toList();
    }
    glucoseMmol = reading.glucoseMmol;
    notifyListeners();
    await _saveSensorState();
    await _saveDouble('glucoseMmol', glucoseMmol);
    await addDiaryEntry(
      DiaryLogEntry(
        id: 'sensor-${reading.time.microsecondsSinceEpoch}',
        time: reading.time,
        type: DiaryLogType.glucose,
        glucoseMmol: reading.glucoseMmol,
        carbs: 0,
        insulinUnits: 0,
        title: 'Sensor glucose',
        note: reading.note,
        source: reading.brand,
      ),
    );
  }

  Future<void> replaceSensorReadings(List<SensorReading> readings) async {
    final combined = [...readings, ...sensorReadings]
      ..sort((a, b) => b.time.compareTo(a.time));
    final byKey = <String, SensorReading>{};
    for (final reading in combined) {
      byKey['${reading.brand.name}-${reading.time.toIso8601String()}'] =
          reading;
    }
    sensorReadings = byKey.values.toList()
      ..sort((a, b) => b.time.compareTo(a.time));
    if (sensorReadings.length > 288) {
      sensorReadings = sensorReadings.take(288).toList();
    }
    if (sensorReadings.isNotEmpty) {
      glucoseMmol = sensorReadings.first.glucoseMmol;
    }
    lastSensorSyncAt = DateTime.now();
    notifyListeners();
    await _saveSensorState();
    await _saveDouble('glucoseMmol', glucoseMmol);
    await _refreshEmergencyCard();
  }

  Future<void> addDiaryEntry(DiaryLogEntry entry) async {
    diaryEntries = [entry, ...diaryEntries]
      ..sort((a, b) => b.time.compareTo(a.time));
    if (diaryEntries.length > 1000) {
      diaryEntries = diaryEntries.take(1000).toList();
    }
    final glucoseChanged =
        _syncCachedGlucoseFromLatestSource(clearIfMissing: false);
    notifyListeners();
    await _saveDiaryEntries();
    if (glucoseChanged || entry.glucoseMmol > 0) {
      await _saveDouble('glucoseMmol', glucoseMmol);
      await _refreshEmergencyCard();
    }
  }

  Future<void> removeDiaryEntry(String id) async {
    diaryEntries = diaryEntries.where((entry) => entry.id != id).toList();
    final glucoseChanged =
        _syncCachedGlucoseFromLatestSource(clearIfMissing: true);
    notifyListeners();
    await _saveDiaryEntries();
    if (glucoseChanged) {
      await _saveDouble('glucoseMmol', glucoseMmol);
      await _refreshEmergencyCard();
    }
  }

  Future<void> clearDiaryEntries() async {
    diaryEntries = [];
    final glucoseChanged =
        _syncCachedGlucoseFromLatestSource(clearIfMissing: true);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('diaryEntries');
    if (glucoseChanged) {
      await prefs.setDouble('glucoseMmol', glucoseMmol);
      await _refreshEmergencyCard();
    }
  }

  Future<void> clearSensorReadings() async {
    sensorReadings = [];
    final glucoseChanged =
        _syncCachedGlucoseFromLatestSource(clearIfMissing: true);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('sensorReadings');
    if (glucoseChanged) {
      await prefs.setDouble('glucoseMmol', glucoseMmol);
      await _refreshEmergencyCard();
    }
  }

  bool _syncCachedGlucoseFromLatestSource({required bool clearIfMissing}) {
    final diaryEntry = latestGlucoseDiaryEntry;
    final sensorReading = latestSensorGlucoseReading;
    final next = diaryEntry?.glucoseMmol ?? sensorReading?.glucoseMmol;
    if (next != null) {
      final changed = glucoseMmol != next;
      glucoseMmol = next;
      return changed;
    }
    if (clearIfMissing && glucoseMmol != 0) {
      glucoseMmol = 0;
      return true;
    }
    return false;
  }

  bool _legacyAllergyTextMeansYes(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized.isEmpty) return false;
    return normalized != 'no' &&
        normalized != 'none' &&
        normalized != '\u043d\u0435\u0442' &&
        normalized != '\u043d\u0456' &&
        normalized != 'brak';
  }

  bool? _boolFromSnapshot(Object? value, {bool? fallback}) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final normalized = value.trim().toLowerCase();
      if (normalized == 'true' ||
          normalized == 'yes' ||
          normalized == 'y' ||
          normalized == '1') {
        return true;
      }
      if (normalized == 'false' ||
          normalized == 'no' ||
          normalized == 'n' ||
          normalized == '0') {
        return false;
      }
    }
    return fallback;
  }

  Future<void> _saveDouble(String key, double value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(key, value);
  }

  Future<void> _saveSensorState() async {
    final prefs = await SharedPreferences.getInstance();
    if (connectedSensorBrand == null) {
      await prefs.remove('connectedSensorBrand');
    } else {
      await prefs.setString('connectedSensorBrand', connectedSensorBrand!.name);
    }
    if (lastSensorSyncAt == null) {
      await prefs.remove('lastSensorSyncAt');
    } else {
      await prefs.setString(
        'lastSensorSyncAt',
        lastSensorSyncAt!.toIso8601String(),
      );
    }
    await prefs.setString(
      'sensorReadings',
      jsonEncode(sensorReadings.map((reading) => reading.toJson()).toList()),
    );
  }

  Future<void> _saveDiaryEntries() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'diaryEntries',
      jsonEncode(diaryEntries.map((entry) => entry.toJson()).toList()),
    );
  }

  T _enumValue<T extends Enum>(List<T> values, String name, T fallback) {
    for (final value in values) {
      if (value.name == name) {
        return value;
      }
    }
    return fallback;
  }

  GlucoseUnit _defaultGlucoseUnitForLanguage(String code) {
    return switch (code) {
      'en' => GlucoseUnit.mgDl,
      _ => GlucoseUnit.mmolL,
    };
  }
}
