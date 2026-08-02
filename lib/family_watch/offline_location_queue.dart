import 'dart:math';

import 'location_models.dart';
import 'secure_location_storage.dart';

class OfflineLocationQueue {
  OfflineLocationQueue({
    required SecureLocationStorage storage,
    DateTime Function()? now,
  })  : _storage = storage,
        _now = now ?? DateTime.now;

  static const maxItems = 100;
  static const maxAge = Duration(hours: 24);
  final SecureLocationStorage _storage;
  final DateTime Function() _now;

  Future<List<QueuedLocationUpdate>> pending() async {
    final queue = _retainFresh(await _storage.readQueue());
    await _storage.saveQueue(queue);
    return queue;
  }

  Future<bool> add(FamilyLocationPoint point) async {
    final queue = await pending();
    final update = QueuedLocationUpdate(id: _newId(), point: point);
    if (queue.any((item) => item.deduplicationKey == update.deduplicationKey)) {
      return false;
    }
    queue.add(update);
    if (queue.length > maxItems) queue.removeRange(0, queue.length - maxItems);
    await _storage.saveQueue(queue);
    return true;
  }

  Future<void> remove(String id) async {
    final queue = await pending();
    queue.removeWhere((item) => item.id == id);
    await _storage.saveQueue(queue);
  }

  Future<void> markRetry(String id) async {
    final queue = await pending();
    final index = queue.indexWhere((item) => item.id == id);
    if (index < 0) return;
    queue[index] = queue[index].retry();
    await _storage.saveQueue(queue);
  }

  Future<void> clear() => _storage.clear();

  List<QueuedLocationUpdate> _retainFresh(List<QueuedLocationUpdate> queue) {
    final oldest = _now().toUtc().subtract(maxAge);
    return queue
        .where((item) => !item.point.capturedAt.toUtc().isBefore(oldest))
        .toList();
  }

  String _newId() {
    final random = Random.secure();
    final suffix = List.generate(
        8, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    return '${_now().microsecondsSinceEpoch}-$suffix';
  }
}
