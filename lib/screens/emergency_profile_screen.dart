import 'dart:async';

import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import '../l10n/emergency_card_value_translations.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../services/emergency_service.dart';
import '../services/sos_public_service.dart';
import '../widgets/allergy_input_card.dart';
import '../widgets/responsive_two_column_list.dart';

class EmergencyProfileScreen extends StatefulWidget {
  const EmergencyProfileScreen({super.key});

  @override
  State<EmergencyProfileScreen> createState() => _EmergencyProfileScreenState();
}

class _EmergencyProfileScreenState extends State<EmergencyProfileScreen> {
  final _bloodType = TextEditingController();
  final _insulin = TextEditingController();
  final _allergies = TextEditingController();
  final _diagnoses = TextEditingController();
  final _treatment = TextEditingController();
  final _medications = TextEditingController();
  final _doctor = TextEditingController();
  final _languages = TextEditingController();
  final _instructions = TextEditingController();
  final _contactName = TextEditingController();
  final _contactPhone = TextEditingController();
  final _additionalContacts = TextEditingController();
  final _pin = TextEditingController();

  bool _initialized = false;
  bool _saving = false;
  bool _sosEnabled = false;
  bool _lockScreen = false;
  bool _sms = false;
  bool _location = false;
  bool _autoCall = false;
  bool _hideSensitive = true;
  bool _hasAllergies = false;
  double _threshold = 3.1;
  int _minutes = 3;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    final state = context.read<AppState>();
    _bloodType.text = state.bloodType;
    _insulin.text = state.insulinName;
    _hasAllergies = state.hasAllergies;
    _allergies.text = state.allergies;
    _diagnoses.text = state.importantDiagnoses;
    _treatment.text = state.diabetesTreatment;
    _medications.text = state.medications;
    _doctor.text = state.doctorContact;
    _languages.text = state.communicationLanguages;
    _instructions.text =
        isDefaultEmergencyInstruction(state.emergencyInstructions)
            ? ''
            : state.emergencyInstructions;
    _contactName.text = state.emergencyContactName;
    _contactPhone.text = state.emergencyContactPhone;
    _additionalContacts.text = state.additionalEmergencyContacts;
    _pin.text = state.sosAccessPin;
    _sosEnabled = state.sosEnabled;
    _lockScreen = state.showEmergencyOnLockScreen;
    _sms = state.sosSmsEnabled;
    _location = state.sosLocationEnabled;
    _autoCall = state.sosAutoCallEnabled;
    _hideSensitive = state.hideSensitiveSosData;
    _threshold = state.sosThresholdMmol;
    _minutes = state.sosEscalationMinutes;
    _initialized = true;
  }

  @override
  void dispose() {
    for (final controller in [
      _bloodType,
      _insulin,
      _allergies,
      _diagnoses,
      _treatment,
      _medications,
      _doctor,
      _languages,
      _instructions,
      _contactName,
      _contactPhone,
      _additionalContacts,
      _pin,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if ((_sms || _autoCall) && _contactPhone.text.trim().isEmpty) {
      _message(context.l10n.t('patientCard.phone'));
      return;
    }
    if (_hideSensitive && !RegExp(r'^\d{4,8}$').hasMatch(_pin.text)) {
      _message(context.l10n.t('patientCard.pinHint'));
      return;
    }
    setState(() => _saving = true);
    final state = context.read<AppState>();
    await state.updateEmergencyProfile(
      bloodType: _bloodType.text,
      insulinName: _insulin.text,
      hasAllergies: _hasAllergies,
      allergies: _allergies.text,
      importantDiagnoses: _diagnoses.text,
      diabetesTreatment: _treatment.text,
      medications: _medications.text,
      doctorContact: _doctor.text,
      communicationLanguages: _languages.text,
      emergencyInstructions: _instructions.text,
      emergencyContactName: _contactName.text,
      emergencyContactPhone: _contactPhone.text,
      additionalEmergencyContacts: _additionalContacts.text,
      hideSensitiveSosData: _hideSensitive,
      sosAccessPin: _pin.text,
      sosEnabled: _sosEnabled,
      showEmergencyOnLockScreen: _lockScreen,
      sosSmsEnabled: _sms,
      sosLocationEnabled: _location,
      sosAutoCallEnabled: _autoCall,
      sosThresholdMmol: _threshold,
      sosEscalationMinutes: _minutes,
    );
    await AndroidEmergencyService().updateLockScreenCard(state);
    await _publishSosProfileBestEffort(state);
    if (!mounted) return;
    setState(() => _saving = false);
    _message(context.l10n.t('patientCard.settingsSaved'));
  }

  Future<void> _publishSosProfileBestEffort(AppState state) async {
    if (state.accountToken.isEmpty) return;
    try {
      final token = await SosPublicService().publish(state);
      if (token.isNotEmpty && token != state.sosPublicToken) {
        await state.setSosPublicToken(token);
      }
    } catch (_) {
      // Offline saves still update the local lock-screen card immediately.
    }
  }

  void _message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  void _setHasAllergies(bool value) {
    final shouldClearDetails = value && _isNegativeAllergyText(_allergies.text);
    if (value != _hasAllergies || shouldClearDetails) {
      setState(() {
        _hasAllergies = value;
        if (shouldClearDetails) {
          _allergies.clear();
        }
      });
    }
    unawaited(
      context.read<AppState>().updateAllergyProfile(
            hasAllergies: value,
            allergies: _allergies.text,
          ),
    );
  }

  bool _isNegativeAllergyText(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized == 'no' ||
        normalized == 'none' ||
        normalized == 'no allergies' ||
        normalized == '\u043d\u0435\u0442' ||
        normalized ==
            '\u043d\u0435\u0442 \u0430\u043b\u043b\u0435\u0440\u0433\u0438\u0438' ||
        normalized == '\u043d\u0456' ||
        normalized == 'brak';
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final thresholdDisplay = state.glucoseToDisplay(_threshold);
    final thresholdDecimals = state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1;
    final thresholdLabel =
        '${thresholdDisplay.toStringAsFixed(thresholdDecimals)} ${state.glucoseUnitLabel}';
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('patientCard.title'))),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(10),
        children: [
          Card(
            color: const Color(0xFFFFF4E8),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Text(l10n.t('patientCard.publicNotice')),
            ),
          ),
          _Section(
            title: l10n.t('patientCard.medicalInformation'),
            icon: Icons.medical_information,
            children: [
              _Field(
                controller: _bloodType,
                label: l10n.t('patientCard.bloodType'),
              ),
              _Field(
                controller: _treatment,
                label: l10n.t('patientCard.treatment'),
              ),
              _Field(
                controller: _insulin,
                label: l10n.t('patientCard.insulin'),
              ),
              AllergyInputCard(
                hasAllergies: _hasAllergies,
                detailsController: _allergies,
                onChanged: _setHasAllergies,
              ),
              _Field(
                controller: _diagnoses,
                label: l10n.t('patientCard.diagnoses'),
                lines: 3,
              ),
              _Field(
                controller: _medications,
                label: l10n.t('patientCard.medications'),
                lines: 4,
              ),
              _Field(
                controller: _languages,
                label: l10n.t('patientCard.languages'),
              ),
            ],
          ),
          _Section(
            title: l10n.t('patientCard.contacts'),
            icon: Icons.contact_phone,
            children: [
              _Field(
                controller: _contactName,
                label: l10n.t('patientCard.name'),
              ),
              _Field(
                controller: _contactPhone,
                label: l10n.t('patientCard.phone'),
                keyboardType: TextInputType.phone,
              ),
              _Field(
                controller: _additionalContacts,
                label: l10n.t('patientCard.otherRelatives'),
                lines: 3,
              ),
              _Field(
                controller: _doctor,
                label: l10n.t('patientCard.doctorClinic'),
                lines: 2,
              ),
            ],
          ),
          _Section(
            title: l10n.t('patientCard.emergencyInstruction'),
            icon: Icons.warning_amber_rounded,
            children: [
              _Field(
                controller: _instructions,
                label: l10n.t('patientCard.emergencyInstruction'),
                hint: emergencyInstructionText(state.languageCode),
                lines: 4,
              ),
            ],
          ),
          _Section(
            title: l10n.t('patientCard.privacy'),
            icon: Icons.privacy_tip,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.t('patientCard.hideSensitiveData')),
                subtitle: Text(l10n.t('patientCard.pinNotice')),
                value: _hideSensitive,
                onChanged: (value) => setState(() => _hideSensitive = value),
              ),
              if (_hideSensitive)
                _Field(
                  controller: _pin,
                  label: l10n.t('patientCard.relativeDoctorPin'),
                  hint: l10n.t('patientCard.pinHint'),
                  obscureText: true,
                  keyboardType: TextInputType.number,
                ),
            ],
          ),
          _Section(
            title: l10n.t('patientCard.mode'),
            icon: Icons.sos,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.t('patientCard.enableMonitoring')),
                value: _sosEnabled,
                onChanged: (value) => setState(() => _sosEnabled = value),
              ),
              Text(
                '${l10n.t('patientCard.criticalThreshold')}: $thresholdLabel',
              ),
              Slider(
                value: _threshold,
                min: 2.2,
                max: 3.9,
                divisions: 17,
                label: thresholdLabel,
                onChanged: (value) => setState(() => _threshold = value),
              ),
              _switch(
                l10n.t('patientCard.showOnLockScreen'),
                _lockScreen,
                (value) => _lockScreen = value,
              ),
              _switch(
                l10n.t('patientCard.prepareSms'),
                _sms,
                (value) => _sms = value,
              ),
              _switch(
                l10n.t('patientCard.addLocation'),
                _location,
                (value) => _location = value,
              ),
              _switch(
                l10n.t('patientCard.autoCallLovedOne'),
                _autoCall,
                (value) => _autoCall = value,
              ),
              if (_autoCall)
                DropdownButtonFormField<int>(
                  initialValue: _minutes,
                  decoration: InputDecoration(
                    labelText: l10n.t('patientCard.autoCallDelay'),
                    border: const OutlineInputBorder(),
                  ),
                  items: const [1, 2, 3, 5, 10]
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text('$value'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _minutes = value ?? _minutes),
                ),
            ],
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.save),
            label: Text(
              l10n.t(
                _saving ? 'patientCard.saving' : 'patientCard.saveSosProfile',
              ),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.pushNamed(context, '/emergency-card'),
            icon: const Icon(Icons.qr_code_2),
            label: Text(l10n.t('patientCard.openCardQr')),
          ),
        ],
      ),
    );
  }

  Widget _switch(String title, bool value, ValueChanged<bool> assign) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(title),
      value: value,
      onChanged: (next) => setState(() => assign(next)),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(top: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: const Color(0xFF075BBB)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LayoutBuilder(
                builder: (context, constraints) {
                  final useTwoColumns =
                      constraints.maxWidth >= 760 && children.length > 1;
                  if (!useTwoColumns) {
                    return Column(children: children);
                  }
                  const gap = 10.0;
                  final itemWidth = (constraints.maxWidth - gap) / 2;
                  return Wrap(
                    spacing: gap,
                    runSpacing: 0,
                    children: children
                        .map(
                            (child) => SizedBox(width: itemWidth, child: child))
                        .toList(),
                  );
                },
              ),
            ],
          ),
        ),
      );
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    this.hint,
    this.lines = 1,
    this.keyboardType,
    this.obscureText = false,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final int lines;
  final TextInputType? keyboardType;
  final bool obscureText;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: TextField(
          controller: controller,
          minLines: lines,
          maxLines: lines,
          keyboardType: keyboardType,
          obscureText: obscureText,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            alignLabelWithHint: lines > 1,
            border: const OutlineInputBorder(),
          ),
        ),
      );
}
