import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

/// Generates short, original interface tones used by the local sound system.
/// No external audio is downloaded; each cue is a small synthesized WAV file.
void main() {
  const cues = <String, (double, double, double)>{
    'ai_activate.wav': (440, 880, .62),
    'food_scan.wav': (520, 1040, .52),
    'product_scan.wav': (360, 680, .52),
    'insulin_calculate.wav': (660, 990, .48),
    'analytics_open.wav': (420, 760, .52),
    'medicine_open.wav': (500, 720, .48),
    'diary_open.wav': (390, 620, .50),
    'sos_alert.wav': (300, 420, .64),
    'chart_open.wav': (460, 820, .50),
    'profile_open.wav': (340, 540, .46),
    'glass_crack.wav': (1180, 720, .18),
    'glass_break.wav': (1040, 360, .56),
    'glass_shatter.wav': (920, 260, .38),
  };
  final output = Directory('assets/audio/interface')
    ..createSync(recursive: true);
  for (final cue in cues.entries) {
    File('${output.path}/${cue.key}').writeAsBytesSync(
      _wav(cue.value.$1, cue.value.$2, cue.value.$3),
      flush: true,
    );
  }
}

Uint8List _wav(double startHz, double endHz, double seconds) {
  const sampleRate = 22050;
  final sampleCount = (sampleRate * seconds).round();
  final dataLength = sampleCount * 2;
  final bytes = ByteData(44 + dataLength);
  _ascii(bytes, 0, 'RIFF');
  bytes.setUint32(4, 36 + dataLength, Endian.little);
  _ascii(bytes, 8, 'WAVEfmt ');
  bytes.setUint32(16, 16, Endian.little);
  bytes.setUint16(20, 1, Endian.little);
  bytes.setUint16(22, 1, Endian.little);
  bytes.setUint32(24, sampleRate, Endian.little);
  bytes.setUint32(28, sampleRate * 2, Endian.little);
  bytes.setUint16(32, 2, Endian.little);
  bytes.setUint16(34, 16, Endian.little);
  _ascii(bytes, 36, 'data');
  bytes.setUint32(40, dataLength, Endian.little);

  var phase = 0.0;
  for (var index = 0; index < sampleCount; index++) {
    final t = index / sampleCount;
    final frequency = startHz + (endHz - startHz) * t;
    phase += math.pi * 2 * frequency / sampleRate;
    final envelope = math.sin(math.pi * t).clamp(0.0, 1.0) * .28;
    final harmonic = math.sin(phase) + .22 * math.sin(phase * 2.01);
    bytes.setInt16(
        44 + index * 2, (harmonic * envelope * 32767).round(), Endian.little);
  }
  return bytes.buffer.asUint8List();
}

void _ascii(ByteData data, int offset, String value) {
  for (var index = 0; index < value.length; index++) {
    data.setUint8(offset + index, value.codeUnitAt(index));
  }
}
