import assert from "node:assert/strict";
import test from "node:test";

import { createSosNotificationWorker } from "../family/services/sosNotificationWorker.js";

function fixture({ enabled = true, result = { sent: 1, failed: 0, skipped: 0 } } = {}) {
  const logs = [];
  const timers = [];
  const cleared = [];
  let calls = 0;
  const worker = createSosNotificationWorker({
    enabled,
    intervalSeconds: 30,
    deliveryService: {
      async processPendingNotifications() {
        calls++;
        return typeof result === "function" ? result() : result;
      }
    },
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
  return { worker, logs, timers, cleared, calls: () => calls };
}

test("worker starts once and processes pending jobs", async () => {
  const state = fixture();
  assert.equal(await state.worker.start(), true);
  assert.equal(await state.worker.start(), true);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(state.worker.running, true);
  assert.equal(state.timers.length, 1);
  assert.equal(state.timers[0].interval, 30000);
  assert.equal(state.calls(), 1);
  assert.ok(state.logs.some((entry) => entry.message === "SOS notification worker started"));
  assert.ok(state.logs.some((entry) => entry.message === "SOS notification worker processed jobs"));
});

test("disabled worker never schedules or processes jobs", async () => {
  const state = fixture({ enabled: false });
  assert.equal(await state.worker.start(), false);
  await state.worker.runOnce();
  assert.equal(state.worker.running, false);
  assert.equal(state.timers.length, 0);
  assert.equal(state.calls(), 0);
});

test("worker allows a failed job retry on a later pass", async () => {
  let attempt = 0;
  const state = fixture({
    result: () => ({ sent: attempt++ === 0 ? 0 : 1, failed: attempt === 1 ? 1 : 0, skipped: 0 })
  });
  await state.worker.runOnce();
  await state.worker.runOnce();
  assert.equal(state.calls(), 2);
  assert.deepEqual(
    state.logs.filter((entry) => entry.message === "SOS notification worker processed jobs").map((entry) => entry.context),
    [{ sent: 0, failed: 1, skipped: 0 }, { sent: 1, failed: 0, skipped: 0 }]
  );
});

test("worker logs errors and shuts down gracefully", async () => {
  const state = fixture({ result: () => { throw new Error("provider unavailable"); } });
  await state.worker.start();
  await Promise.resolve();
  await state.worker.stop();

  assert.equal(state.worker.running, false);
  assert.equal(state.cleared.length, 1);
  assert.ok(state.logs.some((entry) => entry.level === "error" && entry.message === "SOS notification worker failed"));
  assert.ok(state.logs.some((entry) => entry.message === "SOS notification worker stopped"));
});
