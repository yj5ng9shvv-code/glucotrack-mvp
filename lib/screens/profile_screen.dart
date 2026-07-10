import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/sos_public_service.dart';
import '../widgets/allergy_input_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _picker = ImagePicker();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _ageController = TextEditingController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _targetController = TextEditingController();
  final _ratioController = TextEditingController();
  final _correctionController = TextEditingController();
  final _allergyDetailsController = TextEditingController();

  DiabetesType _diabetesType = DiabetesType.type1;
  bool _hasAllergies = false;
  bool _synced = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _ageController.dispose();
    _weightController.dispose();
    _heightController.dispose();
    _targetController.dispose();
    _ratioController.dispose();
    _correctionController.dispose();
    _allergyDetailsController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_synced) {
      return;
    }
    _syncControllers(context.read<AppState>());
    _synced = true;
  }

  void _syncControllers(AppState state) {
    _nameController.text = state.fullName;
    _emailController.text = state.email;
    _phoneController.text = state.phone;
    _ageController.text = state.age == 0 ? '' : state.age.toString();
    _weightController.text =
        state.weightKg == 0 ? '' : state.weightKg.toStringAsFixed(1);
    _heightController.text =
        state.heightCm == 0 ? '' : state.heightCm.toStringAsFixed(0);
    _targetController.text = state
        .glucoseToDisplay(state.targetGlucose)
        .toStringAsFixed(state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1);
    _ratioController.text = state.insulinToCarbRatio.toStringAsFixed(1);
    _correctionController.text = state
        .glucoseToDisplay(state.correctionFactor)
        .toStringAsFixed(state.glucoseUnit == GlucoseUnit.mgDl ? 0 : 1);
    _diabetesType = state.diabetesType;
    _hasAllergies = state.hasAllergies;
    _allergyDetailsController.text = state.allergies;
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final image = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 900,
    );
    if (image == null || !mounted) {
      return;
    }
    final bytes = await image.readAsBytes();
    if (!mounted) {
      return;
    }
    await context.read<AppState>().setProfilePhoto(bytes);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final state = context.read<AppState>();
    await state.updateUserProfile(
      fullName: _nameController.text,
      email: _emailController.text,
      phone: _phoneController.text,
      age: int.tryParse(_ageController.text.trim()) ?? 0,
      weightKg: _parseDouble(_weightController.text),
      heightCm: _parseDouble(_heightController.text),
    );
    await state.updateMedicalSettings(
      diabetesType: _diabetesType,
      targetGlucose:
          state.glucoseFromDisplay(_parseDouble(_targetController.text)),
      insulinToCarbRatio: _parseDouble(_ratioController.text),
      correctionFactor:
          state.glucoseFromDisplay(_parseDouble(_correctionController.text)),
    );
    await state.updateAllergyProfile(
      hasAllergies: _hasAllergies,
      allergies: _allergyDetailsController.text,
    );
    await _publishSosProfileBestEffort(state);
    if (!mounted) {
      return;
    }
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.t('profile.settingsSaved'))),
    );
  }

  double _parseDouble(String value) {
    return double.tryParse(value.trim().replaceAll(',', '.')) ?? 0;
  }

  Future<void> _publishSosProfileBestEffort(AppState state) async {
    if (state.accountToken.isEmpty) return;
    try {
      final token = await SosPublicService().publish(state);
      if (token.isNotEmpty && token != state.sosPublicToken) {
        await state.setSosPublicToken(token);
      }
    } catch (_) {
      // Offline saves keep the local profile and lock-screen card in sync.
    }
  }

  void _setHasAllergies(bool value) {
    final shouldClearDetails =
        value && _isNegativeAllergyText(_allergyDetailsController.text);
    if (value != _hasAllergies || shouldClearDetails) {
      setState(() {
        _hasAllergies = value;
        if (shouldClearDetails) {
          _allergyDetailsController.clear();
        }
      });
    }
    unawaited(
      context.read<AppState>().updateAllergyProfile(
            hasAllergies: value,
            allergies: _allergyDetailsController.text,
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

  String _profileDiabetesTypeLabel(AppLocalizations l10n, DiabetesType type) {
    return switch (type) {
      DiabetesType.type1 => l10n.t('profile.diabetesType1'),
      DiabetesType.type2 => l10n.t('profile.diabetesType2'),
      DiabetesType.gestational => l10n.t('profile.diabetesGestational'),
    };
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('profile.title'))),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 820;
          final children = <Widget>[
            _AvatarCard(
              state: state,
              onCamera: () => _pickPhoto(ImageSource.camera),
              onGallery: () => _pickPhoto(ImageSource.gallery),
              onRemove: state.profilePhotoBytes == null
                  ? null
                  : () => context.read<AppState>().removeProfilePhoto(),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: l10n.t('profile.userData'),
              icon: Icons.person_outline,
              children: [
                _TextField(
                  controller: _nameController,
                  label: l10n.t('profile.name'),
                ),
                _TextField(
                  controller: _emailController,
                  label: l10n.t('profile.email'),
                  keyboardType: TextInputType.emailAddress,
                ),
                _TextField(
                  controller: _phoneController,
                  label: l10n.t('profile.phone'),
                  keyboardType: TextInputType.phone,
                ),
                Row(
                  children: [
                    Expanded(
                      child: _TextField(
                        controller: _ageController,
                        label: l10n.t('profile.age'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _TextField(
                        controller: _weightController,
                        label: l10n.t('profile.weightKg'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _TextField(
                        controller: _heightController,
                        label: l10n.t('profile.heightCm'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: l10n.t('profile.medicalSettings'),
              icon: Icons.monitor_heart_outlined,
              children: [
                DropdownButtonFormField<GlucoseUnitPreference>(
                  initialValue: state.glucoseUnitPreference,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.t('profile.glucoseUnits'),
                    border: const OutlineInputBorder(),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: GlucoseUnitPreference.auto,
                      child: Text(l10n.t('profile.glucoseUnitAuto')),
                    ),
                    DropdownMenuItem(
                      value: GlucoseUnitPreference.mmolL,
                      child: Text(l10n.t('profile.glucoseUnitMmol')),
                    ),
                    DropdownMenuItem(
                      value: GlucoseUnitPreference.mgDl,
                      child: Text(l10n.t('profile.glucoseUnitMgdl')),
                    ),
                  ],
                  onChanged: (value) {
                    if (value == null) {
                      return;
                    }
                    context.read<AppState>().setGlucoseUnitPreference(value);
                    final unit = state.glucoseUnitForPreference(value);
                    final target = unit == GlucoseUnit.mgDl
                        ? state.targetGlucose * 18.0182
                        : state.targetGlucose;
                    final correction = unit == GlucoseUnit.mgDl
                        ? state.correctionFactor * 18.0182
                        : state.correctionFactor;
                    _targetController.text = target
                        .toStringAsFixed(unit == GlucoseUnit.mgDl ? 0 : 1);
                    _correctionController.text = correction
                        .toStringAsFixed(unit == GlucoseUnit.mgDl ? 0 : 1);
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<DiabetesType>(
                  initialValue: _diabetesType,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.t('profile.diabetesType'),
                    border: const OutlineInputBorder(),
                  ),
                  items: DiabetesType.values
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(_profileDiabetesTypeLabel(l10n, type)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null) {
                      return;
                    }
                    setState(() => _diabetesType = value);
                  },
                ),
                const SizedBox(height: 10),
                _TextField(
                  controller: _targetController,
                  label:
                      '${l10n.t('profile.targetGlucose')}, ${state.glucoseUnitLabel}',
                  keyboardType: TextInputType.number,
                ),
                _TextField(
                  controller: _ratioController,
                  label: l10n.t('profile.carbRatioLong'),
                  keyboardType: TextInputType.number,
                ),
                _TextField(
                  controller: _correctionController,
                  label:
                      '${l10n.t('profile.correctionFactor')}, ${state.glucoseUnitLabel} / 1',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 4),
                AllergyInputCard(
                  hasAllergies: _hasAllergies,
                  detailsController: _allergyDetailsController,
                  onChanged: _setHasAllergies,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: l10n.t('profile.languageSection'),
              icon: Icons.language,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: state.languageCode,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.t('profile.appLanguage'),
                    border: const OutlineInputBorder(),
                  ),
                  items: AppState.supportedLanguages
                      .map(
                        (language) => DropdownMenuItem(
                          value: language.code,
                          child: Text(language.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null) {
                      return;
                    }
                    context.read<AppState>().setLanguage(value);
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  l10n
                      .t('profile.selectedLanguage')
                      .replaceAll('{language}', state.languageLabel),
                  style:
                      const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(
                      Icons.health_and_safety,
                      color: Color(0xFFB91C1C),
                    ),
                    title: Text(l10n.t('profile.sosProfileTitle')),
                    subtitle: Text(l10n.t('profile.sosProfileSubtitle')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        Navigator.pushNamed(context, '/emergency-profile'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(
                      Icons.emergency,
                      color: Color(0xFFB91C1C),
                    ),
                    title: Text(l10n.t('profile.emergencyCardTitle')),
                    subtitle: Text(l10n.t('profile.emergencyCardSubtitle')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        Navigator.pushNamed(context, '/emergency-card'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.sensors, color: Color(0xFF075BBB)),
                title: Text(l10n.t('profile.sensorsTitle')),
                subtitle: Text(l10n.t('profile.sensorsSubtitle')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.pushNamed(context, '/sensors'),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save),
              label: Text(
                _saving
                    ? l10n.t('profile.saving')
                    : l10n.t('profile.saveSettings'),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () async {
                await context.read<AppState>().logout();
                if (!context.mounted) return;
                Navigator.pushNamedAndRemoveUntil(context, '/', (_) => false);
              },
              icon: const Icon(Icons.logout),
              label: Text(l10n.t('profile.logout')),
            ),
            const SizedBox(height: 12),
            const _PrivacyNote(),
          ];
          if (!wide) {
            return ListView(
              padding: const EdgeInsets.all(10),
              children: children,
            );
          }
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1180),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(10, 8, 5, 10),
                      children: [
                        children[0],
                        children[1],
                        children[2],
                        children[3],
                        children[4],
                      ],
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(5, 8, 10, 10),
                      children: children.sublist(5),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _AvatarCard extends StatelessWidget {
  final AppState state;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback? onRemove;

  const _AvatarCard({
    required this.state,
    required this.onCamera,
    required this.onGallery,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final photo = state.profilePhotoBytes;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: const Color(0xFFEAF3FF),
              backgroundImage: photo == null ? null : MemoryImage(photo),
              child: photo == null
                  ? const Icon(Icons.person, size: 42, color: Color(0xFF075BBB))
                  : null,
            ),
            const SizedBox(height: 8),
            Text(
              state.fullName.isEmpty
                  ? l10n.t('profile.yourProfile')
                  : state.fullName,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: onCamera,
                  icon: const Icon(Icons.camera_alt),
                  label: Text(l10n.t('profile.camera')),
                ),
                OutlinedButton.icon(
                  onPressed: onGallery,
                  icon: const Icon(Icons.photo_library),
                  label: Text(l10n.t('profile.gallery')),
                ),
                if (onRemove != null)
                  TextButton.icon(
                    onPressed: onRemove,
                    icon: const Icon(Icons.delete_outline),
                    label: Text(l10n.t('profile.remove')),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF075BBB)),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _TextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;

  const _TextField({
    required this.controller,
    required this.label,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      color: const Color(0xFFFFF7E6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.lock_outline, color: Colors.orange),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l10n.t('profile.privacyNote'),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
