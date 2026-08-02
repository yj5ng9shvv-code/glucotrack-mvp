import 'package:permission_handler/permission_handler.dart';

enum FamilyLocationPermissionStatus {
  granted,
  denied,
  permanentlyDenied,
  restricted
}

abstract class LocationPermissionGateway {
  Future<FamilyLocationPermissionStatus> status();
  Future<FamilyLocationPermissionStatus> requestForeground();
  Future<FamilyLocationPermissionStatus> backgroundStatus();
  Future<FamilyLocationPermissionStatus> requestBackground();
  Future<bool> requestNotificationPermission();
  Future<bool> isIgnoringBatteryOptimizations();
  Future<bool> requestIgnoreBatteryOptimizations();
}

class PermissionHandlerLocationGateway implements LocationPermissionGateway {
  const PermissionHandlerLocationGateway();

  @override
  Future<FamilyLocationPermissionStatus> status() async =>
      _map(await Permission.locationWhenInUse.status);

  @override
  Future<FamilyLocationPermissionStatus> requestForeground() async =>
      _map(await Permission.locationWhenInUse.request());

  @override
  Future<FamilyLocationPermissionStatus> backgroundStatus() async =>
      _map(await Permission.locationAlways.status);

  @override
  Future<FamilyLocationPermissionStatus> requestBackground() async =>
      _map(await Permission.locationAlways.request());

  @override
  Future<bool> requestNotificationPermission() async =>
      (await Permission.notification.request()).isGranted;

  @override
  Future<bool> isIgnoringBatteryOptimizations() async =>
      (await Permission.ignoreBatteryOptimizations.status).isGranted;

  @override
  Future<bool> requestIgnoreBatteryOptimizations() async =>
      (await Permission.ignoreBatteryOptimizations.request()).isGranted;

  FamilyLocationPermissionStatus _map(PermissionStatus status) {
    if (status.isGranted || status.isLimited) {
      return FamilyLocationPermissionStatus.granted;
    }
    if (status.isPermanentlyDenied) {
      return FamilyLocationPermissionStatus.permanentlyDenied;
    }
    if (status.isRestricted) return FamilyLocationPermissionStatus.restricted;
    return FamilyLocationPermissionStatus.denied;
  }
}

class LocationPermissionManager {
  LocationPermissionManager({LocationPermissionGateway? gateway})
      : _gateway = gateway ?? const PermissionHandlerLocationGateway();

  final LocationPermissionGateway _gateway;

  Future<FamilyLocationPermissionStatus> currentStatus() => _gateway.status();

  Future<FamilyLocationPermissionStatus> requestForegroundPermission() =>
      _gateway.requestForeground();

  Future<FamilyLocationPermissionStatus> backgroundStatus() =>
      _gateway.backgroundStatus();

  Future<FamilyLocationPermissionStatus> requestBackgroundPermission() =>
      _gateway.requestBackground();

  Future<bool> requestNotificationPermission() =>
      _gateway.requestNotificationPermission();

  Future<bool> isIgnoringBatteryOptimizations() =>
      _gateway.isIgnoringBatteryOptimizations();

  /// Call this only from an explicit patient action; it must never run
  /// automatically when Family Watch starts.
  Future<bool> requestIgnoreBatteryOptimizations() =>
      _gateway.requestIgnoreBatteryOptimizations();
}
