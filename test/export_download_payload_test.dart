import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucotrack/services/export_download_payload.dart';

void main() {
  test('encodes CSV export as UTF-8 without modifying content', () {
    const content = '\uFEFFдата,Łódź,München,français,עברית';

    final bytes = encodeExportDownloadContent(content);

    expect(utf8.decode(bytes), content);
  });
}
