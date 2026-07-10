import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../services/ai_doctor_service.dart';

class AiDoctorScreen extends StatefulWidget {
  const AiDoctorScreen({super.key});

  @override
  State<AiDoctorScreen> createState() => _AiDoctorScreenState();
}

class _AiDoctorScreenState extends State<AiDoctorScreen> {
  final _service = AiDoctorService();
  final _picker = ImagePicker();
  final _medications = TextEditingController();
  final _context = TextEditingController();

  Uint8List? _image;
  String _mimeType = 'image/jpeg';
  String? _labResult;
  String? _medicationResult;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _service.close();
    _medications.dispose();
    _context.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    final file = await _picker.pickImage(
      source: source,
      imageQuality: 88,
      maxWidth: 2000,
    );
    if (!mounted || file == null) return;

    final bytes = await file.readAsBytes();
    if (!mounted) return;

    setState(() {
      _image = bytes;
      _mimeType =
          file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      _labResult = null;
      _error = null;
    });
  }

  Future<void> _analyzeLab() async {
    final image = _image;
    if (image == null || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final text = await _service.analyzeLabPhoto(
        imageBytes: image,
        mimeType: _mimeType,
        state: context.read<AppState>(),
      );
      if (mounted) setState(() => _labResult = text);
    } catch (error) {
      if (mounted) {
        setState(() => _error = context.l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkMedications() async {
    if (_medications.text.trim().length < 2 || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final text = await _service.checkMedications(
        medications: _medications.text.trim(),
        context: _context.text.trim(),
        state: context.read<AppState>(),
      );
      if (mounted) setState(() => _medicationResult = text);
    } catch (error) {
      if (mounted) {
        setState(() => _error = context.l10n.t('networkUnavailable'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.t('homeSectionAiDoctor')),
          bottom: TabBar(
            tabs: [
              Tab(
                icon: const Icon(Icons.biotech),
                text: l10n.t('aiDoctorLabTab'),
              ),
              Tab(
                icon: const Icon(Icons.medication),
                text: l10n.t('aiDoctorMedsTab'),
              ),
            ],
          ),
        ),
        body: Column(
          children: [
            const _MedicalWarning(),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            Expanded(
              child: TabBarView(
                children: [_labTab(), _medicationsTab()],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _labTab() {
    final l10n = context.l10n;
    final hasImage = _image != null;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Text(l10n.t('aiDoctorLabHelp')),
        const SizedBox(height: 10),
        if (hasImage)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.memory(
              _image!,
              height: 210,
              fit: BoxFit.contain,
            ),
          )
        else
          const _EmptyPhotoBox(),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : () => _pick(ImageSource.camera),
                icon: const Icon(Icons.camera_alt),
                label: Text(l10n.t('camera')),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: Text(l10n.t('gallery')),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: hasImage && !_busy ? _analyzeLab : null,
          icon: const Icon(Icons.auto_awesome),
          label: Text(l10n.t('aiDoctorAnalyze')),
        ),
        if (_labResult != null) _ResultCard(text: _labResult!),
      ],
    );
  }

  Widget _medicationsTab() {
    final l10n = context.l10n;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        TextField(
          controller: _medications,
          minLines: 4,
          maxLines: 7,
          decoration: InputDecoration(
            labelText: l10n.t('aiDoctorMedsLabel'),
            hintText: l10n.t('aiDoctorMedsHint'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _context,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(
            labelText: l10n.t('aiDoctorContextLabel'),
            hintText: l10n.t('aiDoctorContextHint'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: _busy ? null : _checkMedications,
          icon: const Icon(Icons.health_and_safety),
          label: Text(l10n.t('aiDoctorCheckMeds')),
        ),
        if (_medicationResult != null) _ResultCard(text: _medicationResult!),
      ],
    );
  }
}

class _MedicalWarning extends StatelessWidget {
  const _MedicalWarning();

  @override
  Widget build(BuildContext context) => Card(
        color: const Color(0xFFFFF4E5),
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 6),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Text(context.l10n.t('aiDoctorWarning')),
        ),
      );
}

class _EmptyPhotoBox extends StatelessWidget {
  const _EmptyPhotoBox();

  @override
  Widget build(BuildContext context) => Container(
        height: 150,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD6DEEA)),
          color: const Color(0xFFF6F8FC),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.biotech, size: 42, color: Color(0xFF075BBB)),
              const SizedBox(height: 8),
              Text(context.l10n.t('aiDoctorEmptyPhoto')),
            ],
          ),
        ),
      );
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(top: 12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: SelectableText(
            text,
            style: const TextStyle(height: 1.4),
          ),
        ),
      );
}
