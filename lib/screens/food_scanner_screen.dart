import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../l10n/app_localizations.dart';
import '../models/app_state.dart';
import '../models/food_recognition_result.dart';
import '../services/food_recognition_service.dart';
import '../services/insulin_calculator.dart';

class FoodScannerScreen extends StatefulWidget {
  const FoodScannerScreen({super.key});

  @override
  State<FoodScannerScreen> createState() => _FoodScannerScreenState();
}

class _FoodScannerScreenState extends State<FoodScannerScreen> {
  final _picker = ImagePicker();
  final _recognitionService = FoodRecognitionService();

  Uint8List? _imageBytes;
  String? _imageName;
  String _mimeType = 'image/jpeg';
  bool _isAnalyzing = false;
  FoodRecognitionResult? _result;
  String? _error;

  @override
  void dispose() {
    _recognitionService.close();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final image = await _picker.pickImage(
      source: source,
      imageQuality: 82,
      maxWidth: 1600,
    );

    if (!mounted || image == null) {
      return;
    }

    final bytes = await image.readAsBytes();
    if (!mounted) {
      return;
    }

    setState(() {
      _imageBytes = bytes;
      _imageName = image.name;
      _mimeType = _mimeTypeFromName(image.name);
      _result = null;
      _error = null;
    });
  }

  Future<void> _analyzeFood() async {
    final bytes = _imageBytes;
    if (bytes == null || _isAnalyzing) {
      return;
    }

    setState(() {
      _isAnalyzing = true;
      _error = null;
    });

    try {
      final result = await _recognitionService.recognizeFood(
        imageBytes: bytes,
        mimeType: _mimeType,
        appState: context.read<AppState>(),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _result = result;
        _isAnalyzing = false;
      });
    } on FoodRecognitionException catch (error) {
      _showAnalyzeError(error.message);
    } on Exception {
      _showAnalyzeError(context.l10n.t('photoAnalyzeError'));
    }
  }

  void _showAnalyzeError(String message) {
    if (!mounted) {
      return;
    }
    setState(() {
      _error = message;
      _isAnalyzing = false;
    });
  }

  void _clearPhoto() {
    setState(() {
      _imageBytes = null;
      _imageName = null;
      _mimeType = 'image/jpeg';
      _result = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasPhoto = _imageBytes != null;
    final appState = context.watch<AppState>();
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('foodPhoto'))),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final twoColumns = constraints.maxWidth >= 820;
          final photoPane = _buildPhotoPane(
            l10n: l10n,
            hasPhoto: hasPhoto,
            expandedPreview: twoColumns,
          );
          final resultPane = _buildResultPane(appState);
          if (!twoColumns) {
            return ListView(
              padding: const EdgeInsets.all(10),
              children: [photoPane, const SizedBox(height: 10), resultPane],
            );
          }
          return Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(flex: 5, child: photoPane),
                const SizedBox(width: 10),
                Expanded(flex: 7, child: resultPane),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPhotoPane({
    required AppLocalizations l10n,
    required bool hasPhoto,
    required bool expandedPreview,
  }) {
    final preview = _PhotoPreview(
      imageBytes: _imageBytes,
      imageName: _imageName,
      aspectRatio: expandedPreview ? 1 : 16 / 9,
    );
    final controls = <Widget>[
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              onPressed:
                  _isAnalyzing ? null : () => _pickImage(ImageSource.camera),
              icon: const Icon(Icons.camera_alt),
              label: Text(l10n.t('takePhoto')),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed:
                  _isAnalyzing ? null : () => _pickImage(ImageSource.gallery),
              icon: const Icon(Icons.photo_library),
              label: Text(l10n.t('gallery')),
            ),
          ),
        ],
      ),
      const SizedBox(height: 6),
      FilledButton.tonalIcon(
        onPressed: hasPhoto && !_isAnalyzing ? _analyzeFood : null,
        icon: _isAnalyzing
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.auto_awesome),
        label: Text(
          _isAnalyzing ? l10n.t('analyzing') : l10n.t('recognizeFood'),
        ),
      ),
      if (hasPhoto)
        TextButton.icon(
          onPressed: _isAnalyzing ? null : _clearPhoto,
          icon: const Icon(Icons.delete_outline),
          label: Text(l10n.t('deletePhoto')),
        ),
    ];
    if (!expandedPreview) return Column(children: [preview, ...controls]);
    return Column(
      children: [
        Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: preview,
          ),
        ),
        ...controls,
      ],
    );
  }

  Widget _buildResultPane(AppState appState) {
    final children = <Widget>[
      _ModeCard(isConfigured: _recognitionService.isConfigured),
      if (_error != null) ...[
        const SizedBox(height: 8),
        _ErrorCard(message: _error!),
      ],
      if (_result == null && _error == null) ...[
        const SizedBox(height: 8),
        const _HelpCard(),
      ],
      if (_result != null) ...[
        const SizedBox(height: 8),
        _RecognitionResultCard(result: _result!, appState: appState),
      ],
      const SizedBox(height: 8),
      const _FoodPhotoDisclaimer(),
    ];
    return SingleChildScrollView(child: Column(children: children));
  }

  String _mimeTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
    return 'image/jpeg';
  }
}

class _PhotoPreview extends StatelessWidget {
  final Uint8List? imageBytes;
  final String? imageName;
  final double aspectRatio;

  const _PhotoPreview({
    required this.imageBytes,
    required this.imageName,
    this.aspectRatio = 16 / 9,
  });

  @override
  Widget build(BuildContext context) {
    final bytes = imageBytes;
    final preview = DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD9E7F7)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: bytes == null
            ? const _EmptyPhotoState()
            : Image.memory(bytes, fit: BoxFit.contain),
      ),
    );
    return Column(
      children: [
        AspectRatio(aspectRatio: aspectRatio, child: preview),
        if (imageName != null) ...[
          const SizedBox(height: 8),
          Text(
            imageName!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF64748B)),
          ),
        ],
      ],
    );
  }
}

class _RecognitionResultCard extends StatelessWidget {
  final FoodRecognitionResult result;
  final AppState appState;

  const _RecognitionResultCard({required this.result, required this.appState});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final insulin = InsulinCalculator.calculate(
      carbs: result.totalCarbsGrams,
      currentGlucose: appState.glucoseMmol,
      targetGlucose: appState.targetGlucose,
      insulinToCarbRatio: appState.insulinToCarbRatio,
      correctionFactor: appState.correctionFactor,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.restaurant_menu, color: Color(0xFF075BBB)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    result.remote
                        ? l10n.t('recognitionResult')
                        : l10n.t('localEstimate'),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            if (result.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(_localizedRecognitionValue(l10n, result.summary)),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _MetricTile(
                  label: l10n.t('carbs'),
                  value: result.totalCarbsGrams.toStringAsFixed(0),
                  unit: l10n.t('grams'),
                ),
                _MetricTile(
                  label: l10n.t('calories'),
                  value: result.totalCalories.toStringAsFixed(0),
                  unit: l10n.t('kcal'),
                ),
                _MetricTile(
                  label: l10n.t('reference'),
                  value: insulin.totalDose.toStringAsFixed(1),
                  unit: l10n.t('insulinUnits'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...result.foods.map((food) => _FoodResultTile(food: food)),
            if (result.warnings.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...result.warnings.map(
                (warning) => _WarningText(
                  text: _localizedRecognitionValue(l10n, warning),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              l10n.t('doseNote'),
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _FoodResultTile extends StatelessWidget {
  final RecognizedFood food;

  const _FoodResultTile({required this.food});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFEAF3FF),
        child: Text('${(food.confidence * 100).round()}%'),
      ),
      title: Text(_localizedRecognitionValue(l10n, food.name)),
      subtitle: Text(
        '${food.portionGrams.toStringAsFixed(0)} ${l10n.t('grams')} • '
        '${food.carbsPer100g.toStringAsFixed(1)} ${l10n.t('grams')} '
        '${l10n.t('carbs').toLowerCase()} / 100 ${l10n.t('grams')}',
      ),
      trailing: Text(
        '${food.carbsGrams.toStringAsFixed(0)} ${l10n.t('grams')}',
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}

String _localizedRecognitionValue(AppLocalizations l10n, String value) =>
    value.startsWith('i18n:') ? l10n.t(value.substring(5)) : value;

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final String unit;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.unit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF3FF),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFF075BBB),
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(unit, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final bool isConfigured;

  const _ModeCard({required this.isConfigured});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(
              isConfigured ? Icons.cloud_done : Icons.offline_bolt,
              color: const Color(0xFF075BBB),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                isConfigured
                    ? l10n.t('recognitionConfigured')
                    : l10n.t('recognitionLocal'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HelpCard extends StatelessWidget {
  const _HelpCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          l10n.t('foodPhotoHelp'),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16, height: 1.35),
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  final String message;

  const _ErrorCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFEBEE),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, color: Colors.red),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

class _WarningText extends StatelessWidget {
  final String text;

  const _WarningText({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 18, color: Colors.orange),
          const SizedBox(width: 6),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

class _EmptyPhotoState extends StatelessWidget {
  const _EmptyPhotoState();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.camera_alt, size: 76, color: Color(0xFF075BBB)),
        const SizedBox(height: 12),
        Text(
          l10n.t('foodPhoto'),
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(l10n.t('photoWillAppear')),
      ],
    );
  }
}

class _FoodPhotoDisclaimer extends StatelessWidget {
  const _FoodPhotoDisclaimer();

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
            const Icon(Icons.warning_amber_rounded, color: Colors.orange),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                l10n.t('foodPhotoDisclaimer'),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
