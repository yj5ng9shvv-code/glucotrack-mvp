import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'family_location_api.dart';
import 'location_models.dart';
import 'location_source.dart';
import 'location_sync_coordinator.dart';
import 'offline_location_queue.dart';
import 'secure_location_storage.dart';

const _notificationChannelId = 'glucotrack_family_watch';
const _notificationId = 4301;

abstract class FamilyWatchBackgroundDriver {
  Future<void> start();
  Future<void> stop();
  Future<void> pause();
  Future<void> resume();
}

class FlutterFamilyWatchBackgroundDriver
    implements FamilyWatchBackgroundDriver {
  FlutterFamilyWatchBackgroundDriver({FlutterBackgroundService? service})
      : _service = service ?? FlutterBackgroundService();

  final FlutterBackgroundService _service;

  @override
  Future<void> start() async {
    try {
      if (!await _service.isRunning()) await _service.startService();
      _service.invoke('familyWatchResume');
    } on MissingPluginException {
      rethrow;
    }
  }

  @override
  Future<void> stop() async {
    try {
      if (await _service.isRunning()) _service.invoke('familyWatchStop');
    } on MissingPluginException {
      // A test or an unsupported host has no foreground service to stop.
    }
  }

  @override
  Future<void> pause() async {
    try {
      if (await _service.isRunning()) _service.invoke('familyWatchPause');
    } on MissingPluginException {
      // A test or an unsupported host has no foreground service to pause.
    }
  }

  @override
  Future<void> resume() async {
    try {
      if (!await _service.isRunning()) {
        await _service.startService();
      }
      _service.invoke('familyWatchResume');
    } on MissingPluginException {
      rethrow;
    }
  }
}

class FamilyWatchBackgroundRuntime {
  static Future<void> initialize() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;

    const channel = AndroidNotificationChannel(
      _notificationChannelId,
      'Family Watch location sharing',
      description:
          'Shown while Family Watch is actively sharing your location.',
      importance: Importance.low,
    );
    final notifications = FlutterLocalNotificationsPlugin();
    await notifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await FlutterBackgroundService().configure(
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: familyWatchIosForegroundEntrypoint,
        onBackground: familyWatchIosBackgroundEntrypoint,
      ),
      androidConfiguration: AndroidConfiguration(
        autoStart: false,
        autoStartOnBoot: false,
        isForegroundMode: true,
        onStart: familyWatchAndroidEntrypoint,
        notificationChannelId: _notificationChannelId,
        initialNotificationTitle: 'Family Watch location sharing',
        initialNotificationContent: 'Starting secure location sharing…',
        foregroundServiceNotificationId: _notificationId,
        foregroundServiceTypes: const [AndroidForegroundType.location],
      ),
    );
  }
}

@pragma('vm:entry-point')
Future<bool> familyWatchIosBackgroundEntrypoint(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void familyWatchIosForegroundEntrypoint(ServiceInstance service) {}

@pragma('vm:entry-point')
void familyWatchAndroidEntrypoint(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  final storage = SecureLocationStorage();
  final queue = OfflineLocationQueue(storage: storage);
  final coordinator = LocationSyncCoordinator(
    queue: queue,
    storage: storage,
    sender: FamilyLocationApi(),
  );
  const source = GeolocatorFamilyWatchLocationSource();
  StreamSubscription<FamilyWatchPosition>? subscription;

  Future<void> stop({required bool clearState}) async {
    await subscription?.cancel();
    subscription = null;
    if (clearState) await storage.clear();
    await service.stopSelf();
  }

  Future<void> startListening() async {
    final state = await storage.readTrackingState();
    if (!state.enabled ||
        state.paused ||
        state.sessionToken == null ||
        state.deviceId == null ||
        !await source.isLocationServiceEnabled()) {
      return;
    }
    if (service is AndroidServiceInstance) {
      await service.setForegroundNotificationInfo(
        title: 'Family Watch location sharing',
        content: 'Sharing location with approved family.',
      );
    }
    await subscription?.cancel();
    subscription = source.positions().listen((position) async {
      if (!_validCoordinates(position.latitude, position.longitude)) return;
      await queue.add(FamilyLocationPoint(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        deviceId: state.deviceId!,
        capturedAt: position.capturedAt,
      ));
      final result = await coordinator.flush(state.sessionToken!);
      if (result == LocationSyncResult.stopped) {
        await stop(clearState: true);
      }
    });
  }

  service.on('familyWatchStop').listen((_) => stop(clearState: true));
  service.on('familyWatchPause').listen((_) async {
    await subscription?.cancel();
    subscription = null;
    final state = await storage.readTrackingState();
    await storage.saveTrackingState(state.copyWith(paused: true));
  });
  service.on('familyWatchResume').listen((_) async {
    final state = await storage.readTrackingState();
    if (state.enabled) {
      await storage.saveTrackingState(state.copyWith(paused: false));
      await startListening();
    }
  });

  await startListening();
}

bool _validCoordinates(double latitude, double longitude) =>
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
