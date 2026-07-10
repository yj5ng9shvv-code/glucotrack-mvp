// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter

import 'dart:html' as html;

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
    final position = await html.window.navigator.geolocation.getCurrentPosition(
      enableHighAccuracy: true,
      timeout: const Duration(seconds: 8),
    );
    final coords = position.coords;
    if (coords == null || coords.latitude == null || coords.longitude == null) {
      return null;
    }
    return SosLocation(
      latitude: coords.latitude!.toDouble(),
      longitude: coords.longitude!.toDouble(),
      accuracy: coords.accuracy?.toDouble(),
    );
  } catch (_) {
    return null;
  }
}
