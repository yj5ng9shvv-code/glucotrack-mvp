import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:provider/provider.dart';

import '../models/app_state.dart';
import '../widgets/localized_text.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  DiabetesType _diabetesType = DiabetesType.type1;
  GlucoseUnitPreference _unitPreference = GlucoseUnitPreference.auto;
  bool _accepted = false;

  Future<void> _finish() async {
    final state = context.read<AppState>();
    await state.completeOnboarding(_diabetesType, _unitPreference, _accepted);
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, '/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const LocalizedText('ui.text.ec9193411347')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: LocalizedText(
                'ui.text.cc7ee0fa9050',
                style: TextStyle(fontSize: 16),
              ),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<DiabetesType>(
            initialValue: _diabetesType,
            decoration: InputDecoration(
              labelText: context.l10n.t('ui.text.ee46a522f9f4'),
              border: const OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                  value: DiabetesType.type1,
                  child: LocalizedText('ui.text.a5c918604521')),
              DropdownMenuItem(
                  value: DiabetesType.type2,
                  child: LocalizedText('ui.text.db6138718c9a')),
              DropdownMenuItem(
                  value: DiabetesType.gestational,
                  child: LocalizedText('ui.text.995ea19354df')),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _diabetesType = value);
              }
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<GlucoseUnitPreference>(
            initialValue: _unitPreference,
            decoration: InputDecoration(
              labelText: context.l10n.t('ui.text.e66be3ccdf73'),
              border: const OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                  value: GlucoseUnitPreference.auto,
                  child: LocalizedText('ui.text.1c1921ef109b')),
              DropdownMenuItem(
                  value: GlucoseUnitPreference.mmolL,
                  child: LocalizedText('ui.text.d6a79b500727')),
              DropdownMenuItem(
                  value: GlucoseUnitPreference.mgDl,
                  child: LocalizedText('ui.text.699731e8953c')),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _unitPreference = value);
              }
            },
          ),
          const SizedBox(height: 12),
          CheckboxListTile(
            value: _accepted,
            onChanged: (value) => setState(() => _accepted = value ?? false),
            title: const LocalizedText('ui.text.e611839cd13c'),
            subtitle: const LocalizedText(
              'ui.text.8e912253dde0',
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _accepted ? _finish : null,
            child: const LocalizedText('ui.text.add8309b980d'),
          ),
        ],
      ),
    );
  }
}
