import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/l10n/app_localizations.dart';
import 'package:glucotrack/l10n/translation_loader.dart';
void main(){TestWidgetsFlutterBinding.ensureInitialized();test('writes English source values for referral fallback keys',() async{await loadCoreTranslations();final keys=(jsonDecode(File('reports/referral-fallback-keys.json').readAsStringSync()) as List).cast<String>();const en=AppLocalizations('en');File('reports/referral-fallback-source.json').writeAsStringSync(const JsonEncoder.withIndent('  ').convert({for(final key in keys)key:en.t(key)}));expect(keys,isNotEmpty);});}
