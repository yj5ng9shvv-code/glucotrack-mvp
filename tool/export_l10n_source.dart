import 'dart:convert';
import 'dart:io';

import 'package:glucotrack/l10n/app_localizations.dart';

void main() {
  stdout.write(
    const JsonEncoder.withIndent('  ').convert(
      AppLocalizations.sourceStrings(),
    ),
  );
}
