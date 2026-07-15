import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import '../l10n/emergency_card_value_translations.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_state.dart';
import '../platform/sos_geolocation.dart';
import '../widgets/responsive_two_column_list.dart';
import '../services/emergency_service.dart';
import '../services/sos_public_service.dart';

class EmergencyCardScreen extends StatefulWidget {
  const EmergencyCardScreen({super.key});

  @override
  State<EmergencyCardScreen> createState() => _EmergencyCardScreenState();
}

class _EmergencyCardScreenState extends State<EmergencyCardScreen> {
  final _emergencyService = AndroidEmergencyService();
  final _publicService = SosPublicService();
  String? _languageOverride;
  bool _unlocked = false;
  bool _publishing = false;
  bool _sendingSosSms = false;

  Future<void> _publish(AppState state) async {
    setState(() => _publishing = true);
    try {
      final token = await _publicService.publish(state);
      await state.setSosPublicToken(token);
      if (mounted) _message(context.l10n.t('patientCard.settingsSaved'));
    } catch (error) {
      if (mounted) _message(context.l10n.t('patientCard.networkUnavailable'));
    } finally {
      if (mounted) setState(() => _publishing = false);
    }
  }

  Future<void> _unlock(AppState state) async {
    final controller = TextEditingController();
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.t('patientCard.fullAccess')),
        content: TextField(
          controller: controller,
          autofocus: true,
          obscureText: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: context.l10n.t('patientCard.relativeDoctorPin'),
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.t('patientCard.cancel')),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, controller.text == state.sosAccessPin),
            child: Text(context.l10n.t('patientCard.open')),
          ),
        ],
      ),
    );
    controller.dispose();
    if (accepted == true) {
      setState(() => _unlocked = true);
    } else if (accepted == false && mounted) {
      _message(context.l10n.t('patientCard.pinHint'));
    }
  }

  Future<void> _printPdf(AppState state) async {
    final url = _publicService.publicUrl(state.sosPublicToken);
    if (url.isEmpty) return;
    final uri = Uri.parse(url).replace(queryParameters: {'print': '1'});
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      _message(context.l10n.t('patientCard.networkUnavailable'));
    }
  }

  Future<void> _sendSosSmsWithLocation(AppState state) async {
    final phone = state.emergencyContactPhone.trim();
    if (phone.isEmpty) {
      _message(context.l10n.t('patientCard.phone'));
      return;
    }
    final patientLabel = context.l10n.t('patientCard.patient');
    final savedLabel = context.l10n.t('patientCard.settingsSaved');
    final networkUnavailableLabel = context.l10n.t(
      'patientCard.networkUnavailable',
    );
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.t('patientCard.sendSmsQuestion')),
        content: Text(context.l10n.t('patientCard.smsLocationConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.t('patientCard.cancel')),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.sms),
            label: Text(context.l10n.t('patientCard.createSms')),
          ),
        ],
      ),
    );
    if (accepted != true) return;

    setState(() => _sendingSosSms = true);
    try {
      final location = await getCurrentSosLocation();
      if (!mounted) return;
      if (location == null) {
        _message(networkUnavailableLabel);
        return;
      }

      if (state.sosPublicToken.isNotEmpty) {
        try {
          await _publicService.sendScanLocation(
            token: state.sosPublicToken,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          );
        } catch (_) {
          // SMS composition remains available when location delivery fails.
        }
      }

      final latitude = location.latitude.toStringAsFixed(6);
      final longitude = location.longitude.toStringAsFixed(6);
      final name =
          state.fullName.trim().isEmpty ? patientLabel : state.fullName.trim();
      final message = 'SOS GlucoTrack: $name. '
          '$latitude, $longitude. ${location.mapsUrl}.';

      await _emergencyService.composeSms(phone, message);
      if (mounted) {
        _message(savedLabel);
      }
    } catch (error) {
      if (mounted) _message(networkUnavailableLabel);
    } finally {
      if (mounted) setState(() => _sendingSosSms = false);
    }
  }

  void _message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cardLanguage = _languageOverride ?? state.languageCode;
    final l10n = AppLocalizations(cardLanguage);
    final text = {
      'title': l10n.t('patientCard.title'),
      'patient': l10n.t('patientCard.patient'),
      'years': l10n.t('patientCard.years'),
      'diabetes': l10n.t('patientCard.diabetes'),
      'currentGlucose': l10n.t('patientCard.currentGlucose'),
      'lastUpdated': l10n.t('patientCard.lastUpdated'),
      'noData': l10n.t('patientCard.noData'),
      'treatment': l10n.t('patientCard.treatment'),
      'blood': l10n.t('patientCard.bloodType'),
      'languages': l10n.t('patientCard.languages'),
      'diagnoses': l10n.t('patientCard.diagnoses'),
      'insulin': l10n.t('patientCard.insulin'),
      'allergies': l10n.t('patientCard.allergies'),
      'allergyStatus': l10n.t('patientCard.allergyStatus'),
      'allergyDetails': l10n.t('patientCard.allergyDetails'),
      'yes': l10n.t('patientCard.yes'),
      'no': l10n.t('patientCard.no'),
      'medications': l10n.t('patientCard.medications'),
      'doctor': l10n.t('patientCard.doctorClinic'),
      'otherContacts': l10n.t('patientCard.otherRelatives'),
      'hidden': l10n.t('patientCard.sensitiveHidden'),
      'call112': l10n.format('sosPublicCard.callEmergencyWithNumber', {
        'number': '112',
      }),
      'callClose': l10n.t('sosPublicCard.callRelative'),
    };
    final sensitiveVisible =
        !state.hideSensitiveSosData || _unlocked || state.sosAccessPin.isEmpty;
    final publicUrl = _publicService.publicUrl(state.sosPublicToken);
    final sosGlucoseMmol = state.latestSosGlucoseMmol;
    final sosGlucoseAt = state.latestSosGlucoseAt;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFB42318),
        foregroundColor: Colors.white,
        title: Text(text['title']!),
        actions: [
          PopupMenuButton<String>(
            initialValue: cardLanguage,
            tooltip: context.l10n.t('patientCard.language'),
            onSelected: (value) => setState(() => _languageOverride = value),
            itemBuilder: (_) => AppState.supportedLanguages
                .map(
                  (language) => PopupMenuItem(
                    value: language.code,
                    child: Text('${language.flag} ${language.label}'),
                  ),
                )
                .toList(),
            icon: const Icon(Icons.translate),
          ),
        ],
      ),
      body: ResponsiveTwoColumnList(
        padding: const EdgeInsets.all(10),
        wideLastChildOnRight: true,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 38,
                backgroundColor: const Color(0xFFFFE9E7),
                backgroundImage: state.profilePhotoBytes == null
                    ? null
                    : MemoryImage(state.profilePhotoBytes!),
                child: state.profilePhotoBytes == null
                    ? const Icon(
                        Icons.person,
                        size: 44,
                        color: Color(0xFFB42318),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.fullName.isEmpty
                          ? text['patient']!
                          : state.fullName,
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (state.age > 0) Text('${state.age} ${text['years']}'),
                    Text(
                      '${text['diabetes']}: ${_localizedDiabetesType(l10n, state.diabetesType)}',
                      style: const TextStyle(
                        color: Color(0xFFB42318),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            color: const Color(0xFFFFE9E7),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Text(
                _localizedInstruction(l10n, state.emergencyInstructions),
                style: const TextStyle(
                  fontSize: 16,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          _row(
            text['currentGlucose']!,
            sosGlucoseMmol == null
                ? text['noData']!
                : state.formatGlucose(sosGlucoseMmol),
          ),
          if (sosGlucoseAt != null)
            _row(
              text['lastUpdated']!,
              state.formatSosGlucoseUpdatedAt(sosGlucoseAt),
            ),
          _row(
            text['treatment']!,
            _localizedTreatment(cardLanguage, state.diabetesTreatment),
          ),
          _row(text['blood']!, state.bloodType),
          _row(text['languages']!, state.communicationLanguages),
          if (sensitiveVisible) ...[
            _row(text['diagnoses']!, state.importantDiagnoses),
            _row(text['insulin']!, state.insulinName),
            _row(
              text['allergyStatus']!,
              state.hasAllergies ? text['yes']! : text['no']!,
            ),
            if (state.hasAllergies)
              _row(text['allergyDetails']!, state.allergies),
            _row(text['medications']!, state.medications),
            _row(text['doctor']!, state.doctorContact),
            _row(text['otherContacts']!, state.additionalEmergencyContacts),
          ] else
            Card(
              child: ListTile(
                leading: const Icon(Icons.lock),
                title: Text(text['hidden']!),
                trailing: FilledButton(
                  onPressed: () => _unlock(state),
                  child: Text(context.l10n.t('patientCard.pin')),
                ),
              ),
            ),
          const SizedBox(height: 10),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB42318),
              minimumSize: const Size.fromHeight(42),
            ),
            onPressed: () => _emergencyService.dial('112'),
            icon: const Icon(Icons.call),
            label: Text(text['call112']!),
          ),
          if (state.emergencyContactPhone.isNotEmpty) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () =>
                  _emergencyService.dial(state.emergencyContactPhone),
              icon: const Icon(Icons.contact_phone),
              label: Text(
                state.emergencyContactName.trim().isEmpty
                    ? text['callClose']!
                    : l10n.format('sosPublicCard.callRelativeWithName', {
                        'name': state.emergencyContactName.trim(),
                      }),
              ),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF067647),
                minimumSize: const Size.fromHeight(42),
              ),
              onPressed:
                  _sendingSosSms ? null : () => _sendSosSmsWithLocation(state),
              icon: _sendingSosSms
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(
                context.l10n.t('sosPublicCard.sendSosSmsWithLocation'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                children: [
                  if (publicUrl.isNotEmpty) ...[
                    QrImageView(
                      data: publicUrl,
                      size: 170,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                    ),
                    const SizedBox(height: 8),
                    SelectableText(
                      publicUrl,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ] else
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Icon(Icons.qr_code_2, size: 100),
                    ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: _publishing ? null : () => _publish(state),
                    icon: _publishing
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload),
                    label: Text(
                      publicUrl.isEmpty
                          ? l10n.t('patientCard.createPublicQr')
                          : l10n.t('sosPublicCard.refreshPublicCard'),
                    ),
                  ),
                  if (publicUrl.isNotEmpty)
                    TextButton.icon(
                      onPressed: () => _printPdf(state),
                      icon: const Icon(Icons.print),
                      label: Text(l10n.t('sosPublicCard.printablePdfCard')),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _row(String label, String value) {
    if (value.trim().isEmpty) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 125,
              child: Text(
                label,
                style: const TextStyle(color: Color(0xFF667085)),
              ),
            ),
            Expanded(
              child: Text(
                value.trim(),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _localizedInstruction(AppLocalizations l10n, String custom) {
    if (isDefaultEmergencyInstruction(custom)) {
      return emergencyInstructionText(l10n.languageCode);
    }
    return custom.trim();
  }

  static String _localizedTreatment(String languageCode, String value) {
    if (isInsulinAndTabletsValue(value)) {
      return insulinAndTabletsText(languageCode);
    }
    return value;
  }

  static String _localizedDiabetesType(
    AppLocalizations l10n,
    DiabetesType type,
  ) {
    return switch (type) {
      DiabetesType.type1 => l10n.t('patientCard.diabetesType1'),
      DiabetesType.type2 => l10n.t('patientCard.diabetesType2'),
      DiabetesType.gestational => l10n.t('patientCard.diabetesGestational'),
    };
  }
}
