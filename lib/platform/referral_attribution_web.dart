import 'package:web/web.dart' as web;

const _codeKey = 'glukotrack-referral-code';
const _clickKey = 'glukotrack-referral-click-token';

({String? code, String? clickToken}) pendingReferralAttribution() {
  final code = web.window.localStorage.getItem(_codeKey)?.trim();
  final clickToken = web.window.localStorage.getItem(_clickKey)?.trim();
  return (
    code: code == null || code.isEmpty ? null : code,
    clickToken: clickToken == null || clickToken.isEmpty ? null : clickToken,
  );
}

void clearPendingReferralAttribution() {
  web.window.localStorage.removeItem(_codeKey);
  web.window.localStorage.removeItem(_clickKey);
}
