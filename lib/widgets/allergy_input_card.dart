import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';

class AllergyInputCard extends StatelessWidget {
  const AllergyInputCard({
    super.key,
    required this.hasAllergies,
    required this.onChanged,
    required this.detailsController,
  });

  final bool hasAllergies;
  final ValueChanged<bool> onChanged;
  final TextEditingController detailsController;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final status = l10n.t(
      hasAllergies ? 'profile.allergyStatusYes' : 'profile.allergyStatusNo',
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD5E3F5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onChanged(!hasAllergies),
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: hasAllergies
                            ? const Color(0xFFFFE8E8)
                            : const Color(0xFFEAF7EF),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        hasAllergies
                            ? Icons.warning_amber_rounded
                            : Icons.check_circle_outline,
                        color: hasAllergies
                            ? const Color(0xFFB91C1C)
                            : const Color(0xFF15803D),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.t('profile.allergy'),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            status,
                            style: const TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.touch_app,
                      color: hasAllergies
                          ? const Color(0xFFB91C1C)
                          : const Color(0xFF15803D),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _AllergyChoice(
                  label: l10n.t('profile.allergyStatusNo'),
                  selected: !hasAllergies,
                  onTap: () => onChanged(false),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AllergyChoice(
                  label: l10n.t('profile.allergyStatusYes'),
                  selected: hasAllergies,
                  onTap: () => onChanged(true),
                ),
              ),
            ],
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: hasAllergies
                ? Padding(
                    key: const ValueKey('allergy-details'),
                    padding: const EdgeInsets.only(top: 12),
                    child: TextField(
                      controller: detailsController,
                      minLines: 2,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: l10n.t('profile.allergyDetails'),
                        hintText: l10n.t('profile.allergyDetails'),
                        filled: true,
                        fillColor: Colors.white,
                        alignLabelWithHint: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFFBFD0E6),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF075BBB),
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),
                  )
                : const SizedBox.shrink(key: ValueKey('no-allergy-details')),
          ),
        ],
      ),
    );
  }
}

class _AllergyChoice extends StatelessWidget {
  const _AllergyChoice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFF075BBB) : Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color:
                  selected ? const Color(0xFF075BBB) : const Color(0xFFBFD0E6),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : const Color(0xFF334155),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
