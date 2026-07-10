import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';

class MedicalDisclaimer extends StatelessWidget {
  const MedicalDisclaimer({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Card(
      color: const Color(0xFFFFF7E6),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.warning_amber_rounded,
              color: Colors.orange,
              size: 18,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                l10n.t('medicalDisclaimer'),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11.5, height: 1.1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
