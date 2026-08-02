import assert from "node:assert/strict";
import test from "node:test";

import {
  SosNotificationAccessDeniedError,
  createSosNotificationService
} from "../family/services/sosNotificationService.js";

function fixture({ caregiverPermission = true } = {}) {
  const patientId = 10;
  const caregiverId = 20;
  const jobs = [];
  const event = { id: 1, patient_id: patientId, status: "ACTIVE" };
  const familyRepository = {
    async findGroupByPatient(id) {
      return Number(id) === patientId ? { id: 1, status: "active" } : null;
    },
    async members() {
      return [
        { id: 2, user_id: caregiverId, role: "caregiver", status: "active" },
        { id: 3, user_id: 21, role: "caregiver", status: "revoked" },
        { id: 4, user_id: 22, role: "patient", status: "active" }
      ];
    }
  };
  const permissionRepository = {
    async get(memberId) {
      if (memberId === 2) return { can_view_sos: caregiverPermission };
      if (memberId === 3) return { can_view_sos: true };
      return { can_view_sos: false };
    }
  };
  const sosRepository = { async getById(id) { return Number(id) === 1 ? event : null; } };
  const notificationRepository = {
    async createNotificationJob(sosEventId, recipientUserId) {
      if (!jobs.some((job) => job.sos_event_id === Number(sosEventId) && job.recipient_user_id === String(recipientUserId))) {
        jobs.push({ id: jobs.length + 1, sos_event_id: Number(sosEventId), recipient_user_id: String(recipientUserId), status: "PENDING", attempts: 0 });
      }
      return { rowCount: 1 };
    },
    async getPendingJobs({ includeFailed }) {
      return jobs.filter((job) => job.status === "PENDING" || (includeFailed && job.status === "FAILED"));
    },
    async markSent(id) {
      const job = jobs.find((item) => item.id === id);
      job.status = "SENT";
      job.attempts++;
      return { rowCount: 1 };
    },
    async markFailed(id) {
      const job = jobs.find((item) => item.id === id);
      job.status = "FAILED";
      job.attempts++;
      return { rowCount: 1 };
    }
  };
  const sender = { async send() {} };
  return {
    service: createSosNotificationService({ familyRepository, permissionRepository, sosRepository, notificationRepository, sender }),
    patientId, caregiverId, jobs
  };
}

test("active SOS creates one notification job for an authorized caregiver", async () => {
  const { service, patientId, caregiverId, jobs } = fixture();
  const recipients = await service.createSOSNotifications(patientId, 1);
  assert.deepEqual(recipients, [String(caregiverId)]);
  assert.deepEqual(jobs.map((job) => job.recipient_user_id), [String(caregiverId)]);
});

test("unauthorized and revoked caregivers are excluded", async () => {
  const { service, patientId, jobs } = fixture({ caregiverPermission: false });
  const recipients = await service.createSOSNotifications(patientId, 1);
  assert.deepEqual(recipients, []);
  assert.equal(jobs.length, 0);
});

test("a foreign patient cannot create notification jobs", async () => {
  const { service } = fixture();
  await assert.rejects(
    () => service.createSOSNotifications(99, 1),
    SosNotificationAccessDeniedError
  );
});

test("duplicate notification jobs are prevented", async () => {
  const { service, patientId, jobs } = fixture();
  await service.createSOSNotifications(patientId, 1);
  await service.createSOSNotifications(patientId, 1);
  assert.equal(jobs.length, 1);
});

test("failed notification jobs retry and are marked sent", async () => {
  const { service, patientId, jobs } = fixture();
  await service.createSOSNotifications(patientId, 1);
  jobs[0].status = "FAILED";
  const result = await service.retryFailedNotifications();
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.equal(jobs[0].status, "SENT");
  assert.equal(jobs[0].attempts, 1);
});
