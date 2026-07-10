import 'package:web/web.dart' as web;

String browserFingerprintSource() {
  final navigator = web.window.navigator;
  return '${navigator.userAgent}|${navigator.language}|${navigator.platform}';
}
