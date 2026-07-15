import 'package:web/web.dart' as web;

String browserFingerprintSource() {
  final navigator = web.window.navigator;
  final raw = '${navigator.userAgent}|${navigator.language}|${navigator.platform}';
  final sanitized = raw
      .replaceAll(RegExp(r'[^A-Za-z0-9:_-]'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .trim()
      .replaceAll(RegExp(r'^_+|_+$'), '');
  if (sanitized.length >= 8) {
    return sanitized.length > 512 ? sanitized.substring(0, 512) : sanitized;
  }
  var hash = 0x811c9dc5;
  for (final unit in raw.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return 'web_${hash.toRadixString(16).padLeft(8, '0')}';
}
