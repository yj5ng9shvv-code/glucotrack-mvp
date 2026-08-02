import 'family_location_api.dart';
import 'location_models.dart';
import 'offline_location_queue.dart';
import 'secure_location_storage.dart';

enum LocationSyncResult { completed, retryScheduled, stopped }

class LocationSyncCoordinator {
  LocationSyncCoordinator({
    required OfflineLocationQueue queue,
    required SecureLocationStorage storage,
    required LocationUpdateSender sender,
  })  : _queue = queue,
        _storage = storage,
        _sender = sender;

  final OfflineLocationQueue _queue;
  final SecureLocationStorage _storage;
  final LocationUpdateSender _sender;

  Future<LocationSyncResult> flush(String token) async {
    for (final update in await _queue.pending()) {
      try {
        await _sender.updateLocation(token: token, point: update.point);
        await _queue.remove(update.id);
        await _storage.saveSyncState(LocationSyncState(
          deviceId: update.point.deviceId,
          lastUploadedAt: DateTime.now().toUtc(),
        ));
      } on FamilyLocationApiException catch (error) {
        if (error.accessRevoked) {
          await _queue.clear();
          return LocationSyncResult.stopped;
        }
        if (error.retryable) {
          await _queue.markRetry(update.id);
          return LocationSyncResult.retryScheduled;
        }
        await _queue.remove(update.id);
      }
    }
    return LocationSyncResult.completed;
  }
}
