import 'package:flutter/services.dart';

class SosLocation {
  const SosLocation({
    required this.latitude,
    required this.longitude,
    this.accuracy,
  });

  final double latitude;
  final double longitude;
  final double? accuracy;

  String get mapsUrl => 'https://maps.google.com/?q=$latitude,$longitude';
}

Future<SosLocation?> getCurrentSosLocation() async {
  try {
    const channel = MethodChannel('glucotrack/emergency');
    final payload = await channel.invokeMapMethod<String, dynamic>(
      'getCurrentLocation',
    );
    final latitude = (payload?['latitude'] as num?)?.toDouble();
    final longitude = (payload?['longitude'] as num?)?.toDouble();
    if (latitude == null || longitude == null) return null;
    return SosLocation(
      latitude: latitude,
      longitude: longitude,
      accuracy: (payload?['accuracy'] as num?)?.toDouble(),
    );
  } on MissingPluginException {
    return null;
  } on PlatformException {
    return null;
  }
}
