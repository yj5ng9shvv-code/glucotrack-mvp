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
}

class PermissionHandlerLocationGateway implements LocationPermissionGateway {
  const PermissionHandlerLocationGateway();

  @override
  Future<FamilyLocationPermissionStatus> status() async =>
      _map(await Permission.locationWhenInUse.status);

  @override
  Future<FamilyLocationPermissionStatus> requestForeground() async =>
      _map(await Permission.locationWhenInUse.request());

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
}
