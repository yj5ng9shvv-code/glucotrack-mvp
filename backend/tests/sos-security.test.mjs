import assert from "node:assert/strict";
import test from "node:test";

import {
  SosAccessDeniedError,
  createSosService
} from "../family/services/sosService.js";

function fixture({ sosPermission = true } = {}) {
  const patientId = 10;
  const caregiverId = 20;
  const strangerId = 30;
  const events = [];
  let nextId = 1;
  const familyRepository = {
    async findGroupByPatient(id) {
      return Number(id) === patientId
        ? { id: 1, patient_user_id: patientId, status: "active" }
        : null;
    },
    async members(groupId) {
      return groupId === 1
        ? [{ id: 2, user_id: caregiverId, role: "caregiver", status: "active" }]
        : [];
    }
  };
  const permissionRepository = {
    async get(memberId) {
      return memberId === 2 ? { can_view_sos: sosPermission } : null;
    }
  };
  const sosRepository = {
    async createSOS(id, latitude, longitude, accuracy) {
      const event = {
        id: nextId++, patient_id: id, status: "ACTIVE", latitude, longitude,
        accuracy, created_at: new Date().toISOString(), cancelled_at: null, resolved_at: null
      };
      events.push(event);
      return { insertId: event.id, rowCount: 1 };
    },
    async findActiveByPatient(id) {
      return events.find((event) => event.patient_id === Number(id) && event.status === "ACTIVE") ?? null;
    },
    async getById(id) {
      return events.find((event) => event.id === Number(id)) ?? null;
    },
    async cancelSOS(id, idPatient) {
      const event = events.find((item) => item.id === Number(id) && item.patient_id === Number(idPatient) && item.status === "ACTIVE");
      if (!event) return { rowCount: 0 };
      event.status = "CANCELLED";
      event.cancelled_at = new Date().toISOString();
      return { rowCount: 1 };
    },
    async resolveSOS(id, idPatient) {
      const event = events.find((item) => item.id === Number(id) && item.patient_id === Number(idPatient) && item.status === "ACTIVE");
      if (!event) return { rowCount: 0 };
      event.status = "RESOLVED";
      event.resolved_at = new Date().toISOString();
      return { rowCount: 1 };
    },
    async getSOSHistory(id, limit) {
      return events.filter((event) => event.patient_id === Number(id)).slice(0, limit);
    }
  };
  return {
    service: createSosService({ familyRepository, permissionRepository, sosRepository }),
    patientId, caregiverId, strangerId
  };
}

test("patient creates an SOS event", async () => {
  const { service, patientId } = fixture();
  const event = await service.createSOS(patientId, patientId, {
    latitude: 52.2297, longitude: 21.0122, accuracy: 12
  });
  assert.equal(event.status, "ACTIVE");
  assert.equal(event.patient_id, patientId);
  assert.equal(event.latitude, 52.2297);
});

test("patient cancels their own SOS event", async () => {
  const { service, patientId } = fixture();
  const event = await service.createSOS(patientId, patientId);
  const cancelled = await service.cancelSOS(patientId, event.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert.notEqual(cancelled.cancelled_at, null);
});

test("patient resolves their own SOS event", async () => {
  const { service, patientId } = fixture();
  const event = await service.createSOS(patientId, patientId);
  const resolved = await service.resolveSOS(patientId, event.id);
  assert.equal(resolved.status, "RESOLVED");
  assert.notEqual(resolved.resolved_at, null);
});

test("authorized caregiver sees active patient SOS", async () => {
  const { service, patientId, caregiverId } = fixture();
  await service.createSOS(patientId, patientId);
  const event = await service.getActiveSOS(caregiverId, patientId);
  assert.equal(event?.status, "ACTIVE");
});

test("caregiver cannot cancel patient SOS", async () => {
  const { service, patientId, caregiverId } = fixture();
  const event = await service.createSOS(patientId, patientId);
  await assert.rejects(
    () => service.cancelSOS(caregiverId, event.id),
    SosAccessDeniedError
  );
});

test("unauthorized patient and caregiver are blocked", async () => {
  const { service, patientId, strangerId } = fixture({ sosPermission: false });
  await assert.rejects(
    () => service.createSOS(strangerId, patientId),
    SosAccessDeniedError
  );
  await assert.rejects(
    () => service.getActiveSOS(strangerId, patientId),
    SosAccessDeniedError
  );
});
