import assert from "node:assert/strict";
import test from "node:test";

import { createPushDeliveryService } from "../family/services/pushDeliveryService.js";

function fixture({ authorized = true, providerResult = "success" } = {}) {
  const jobs = [{
    id: 1,
    sos_event_id: 101,
    recipient_user_id: 20,
    patient_id: 10,
    sos_event_status: "ACTIVE",
    status: "PENDING",
    attempts: 0,
    retryable: true
  }];
  const logs = [];
  const revokedDevices = [];
  let mode = providerResult;
  const notificationRepository = {
    async getPendingJobs({ includeFailed }) {
      return jobs.filter((job) =>
        job.status === "PENDING" || (includeFailed && job.status === "FAILED" && job.retryable)
      );
    },
    async findActivePushDevices() {
      return [{ id: 7, user_id: 20, platform: "android", push_token: "token-1" }];
    },
    async markSent(id) {
      const job = jobs.find((item) => item.id === id);
      job.status = "SENT";
      job.attempts++;
      return { rowCount: 1 };
    },
    async markFailed(id, { retryable = true } = {}) {
      const job = jobs.find((item) => item.id === id);
      job.status = "FAILED";
      job.attempts++;
      job.retryable = retryable;
      return { rowCount: 1 };
    },
    async revokePushToken(id) { revokedDevices.push(id); return { rowCount: 1 }; },
    async createDeliveryLog(outboxId, provider, status, error) {
      logs.push({ outboxId, provider, status, error });
      return { rowCount: 1 };
    }
  };
  const pushProvider = {
    name: "test-push",
    async send() {
      if (mode === "temporary") {
        const error = new Error("network unavailable");
        error.code = "TEMPORARY_ERROR";
        throw error;
      }
      if (mode === "invalid") {
        const error = new Error("token invalid");
        error.code = "INVALID_TOKEN";
        throw error;
      }
    }
  };
  return {
    service: createPushDeliveryService({
      notificationRepository,
      sosNotificationService: { async isAuthorizedSOSRecipient() { return authorized; } },
      pushProvider
    }),
    jobs,
    logs,
    revokedDevices,
    setProviderResult(value) { mode = value; }
  };
}

test("pending job is delivered and marked sent", async () => {
  const { service, jobs, logs } = fixture();
  assert.deepEqual(await service.processPendingNotifications(), { sent: 1, failed: 0, skipped: 0 });
  assert.equal(jobs[0].status, "SENT");
  assert.equal(logs[0].status, "SUCCESS");
});

test("temporary failure is retried on the next worker pass", async () => {
  const state = fixture({ providerResult: "temporary" });
  assert.deepEqual(await state.service.processPendingNotifications(), { sent: 0, failed: 1, skipped: 0 });
  assert.equal(state.jobs[0].status, "FAILED");
  assert.equal(state.jobs[0].retryable, true);
  state.setProviderResult("success");
  assert.deepEqual(await state.service.processPendingNotifications(), { sent: 1, failed: 0, skipped: 0 });
  assert.equal(state.jobs[0].status, "SENT");
  assert.equal(state.jobs[0].attempts, 2);
});

test("invalid push token is revoked and job is marked failed", async () => {
  const { service, jobs, logs, revokedDevices } = fixture({ providerResult: "invalid" });
  assert.deepEqual(await service.processPendingNotifications(), { sent: 0, failed: 1, skipped: 0 });
  assert.equal(jobs[0].status, "FAILED");
  assert.equal(jobs[0].retryable, false);
  assert.deepEqual(revokedDevices, [7]);
  assert.equal(logs[0].status, "INVALID_TOKEN");
});

test("revoked caregiver access skips delivery", async () => {
  const { service, jobs, logs } = fixture({ authorized: false });
  assert.deepEqual(await service.processPendingNotifications(), { sent: 0, failed: 0, skipped: 1 });
  assert.equal(jobs[0].status, "FAILED");
  assert.equal(logs[0].status, "SKIPPED");
  assert.equal(logs[0].error, "RECIPIENT_ACCESS_REVOKED");
});
