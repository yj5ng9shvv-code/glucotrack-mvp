import assert from "node:assert/strict";
import test from "node:test";

import { createLocationRepository } from "../family/repositories/locationRepository.js";
import { createLocationRetentionService } from "../family/services/locationRetentionService.js";
import { createLocationRetentionWorker } from "../family/services/locationRetentionWorker.js";

const now = new Date("2026-08-02T12:00:00.000Z");

function createRepository({ locationsDeleted = 0, accessLogsDeleted = 0 } = {}) {
  const calls = [];
  return {
    calls,
    async deleteExpiredLocations(cutoff) {
      calls.push({ method: "locations", cutoff });
      return { affectedRows: locationsDeleted };
    },
    async deleteExpiredAccessLogs(cutoff) {
      calls.push({ method: "accessLogs", cutoff });
      return { affectedRows: accessLogsDeleted };
    }
  };
}

function createService(options = {}) {
  const repository = createRepository(options);
  return {
    repository,
    service: createLocationRetentionService({
      locationRepository: repository,
      locationHistoryRetentionDays: options.locationHistoryRetentionDays ?? 30,
      accessLogRetentionDays: options.accessLogRetentionDays ?? 365,
      now: () => new Date(now)
    })
  };
}

test("expired locations are removed while recent locations remain outside the cleanup cutoff", async () => {
  const { service, repository } = createService({ locationsDeleted: 3, locationHistoryRetentionDays: 30 });

  const result = await service.cleanupExpiredLocations();

  assert.equal(result.deleted, 3);
  assert.equal(result.cutoff.toISOString(), "2026-07-03T12:00:00.000Z");
  assert.deepEqual(repository.calls, [{ method: "locations", cutoff: result.cutoff }]);
});

test("access logs use their independent retention period", async () => {
  const { service, repository } = createService({ accessLogsDeleted: 7, accessLogRetentionDays: 365 });

  const result = await service.cleanupExpiredAccessLogs();

  assert.equal(result.deleted, 7);
  assert.equal(result.cutoff.toISOString(), "2025-08-02T12:00:00.000Z");
  assert.deepEqual(repository.calls, [{ method: "accessLogs", cutoff: result.cutoff }]);
});

test("location cleanup query preserves every location for a patient with an active SOS", async () => {
  const queries = [];
  const repository = createLocationRepository(async (sql, params) => {
    queries.push({ sql, params });
    return { affectedRows: 0 };
  });
  const cutoff = new Date("2026-07-03T12:00:00.000Z");

  await repository.deleteExpiredLocations(cutoff);

  assert.match(queries[0].sql, /NOT EXISTS/);
  assert.match(queries[0].sql, /FROM sos_events AS sos/);
  assert.match(queries[0].sql, /sos\.status = 'ACTIVE'/);
  assert.deepEqual(queries[0].params, [cutoff]);
});

test("disabled retention cleanup never schedules or removes data", async () => {
  const { service, repository } = createService();
  const timers = [];
  const worker = createLocationRetentionWorker({
    retentionService: service,
    enabled: false,
    setIntervalFn: (callback) => { timers.push(callback); return { unref() {} }; }
  });

  assert.equal(await worker.start(), false);
  await worker.runOnce();
  assert.equal(worker.running, false);
  assert.equal(timers.length, 0);
  assert.equal(repository.calls.length, 0);
});

test("enabled retention cleanup is single-instance and shuts down gracefully", async () => {
  const { service } = createService({ locationsDeleted: 2, accessLogsDeleted: 1 });
  const timers = [];
  const cleared = [];
  const logs = [];
  const worker = createLocationRetentionWorker({
    retentionService: service,
    enabled: true,
    intervalHours: 24,
    logger: {
      info: (message, context) => logs.push({ level: "info", message, context }),
      error: (message, context) => logs.push({ level: "error", message, context })
    },
    setIntervalFn: (callback, interval) => {
      const timer = { callback, interval, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearIntervalFn: (timer) => cleared.push(timer)
  });

  assert.equal(await worker.start(), true);
  assert.equal(await worker.start(), true);
  await Promise.resolve();
  await Promise.resolve();
  await worker.stop();

  assert.equal(timers.length, 1);
  assert.equal(timers[0].interval, 24 * 60 * 60 * 1000);
  assert.equal(cleared.length, 1);
  assert.ok(logs.some((entry) => entry.message === "Location retention cleanup completed" && entry.context.locations_deleted === 2));
});
