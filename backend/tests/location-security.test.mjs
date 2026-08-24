import assert from "node:assert/strict";
import test from "node:test";
import { LocationAccessDeniedError, createLocationService } from "../family/services/locationService.js";

function createFixture({ grant = true, permission = true, caregiverPatientId = 10 } = {}) {
  const calls = [];
  const patientId = 10;
  const caregiverId = 20;
  const familyRepository = {
    async findGroupByPatient(id) {
      return Number(id) === patientId ? { id: 1, patient_user_id: patientId, status: "active" } : null;
    },
    async members(groupId) {
      if (groupId !== 1) return [];
      return [{ id: 2, user_id: caregiverId, role: "caregiver", status: "active", patient_id: caregiverPatientId }];
    }
  };
  const permissionRepository = { async get() { return { can_view_location: permission }; } };
  const locationRepository = {
    createLocationUpdate: async (...args) => { calls.push(["update", ...args]); return { rowCount: 1 }; },
    getCurrentLocation: async (id) => ({ patient_id: id, latitude: 52.2, longitude: 21.0 }),
    getLocationHistory: async () => [],
    findActiveLocationGrant: async (id, memberId) => grant && id === patientId && memberId === 2 ? { id: 1 } : null,
    grantLocationAccess: async (...args) => { calls.push(["grant", ...args]); return { rowCount: 1 }; },
    revokeLocationAccess: async (...args) => { calls.push(["revoke", ...args]); return { rowCount: 1 }; },
    createAccessLog: async (...args) => { calls.push(["audit", ...args]); return { rowCount: 1 }; }
  };
  return { service: createLocationService({ familyRepository, permissionRepository, locationRepository }), calls, patientId, caregiverId };
}

test("patient can update location", async () => {
  const { service, calls, patientId } = createFixture();
  await service.updatePatientLocation(patientId, patientId, { latitude: 52.2, longitude: 21.0, accuracy: 8, batteryLevel: 70, deviceId: "device-1" });
  assert.deepEqual(calls[0], ["update", patientId, 52.2, 21, 8, 70, "device-1"]);
});

test("patient can view own location", async () => {
  const { service, calls, patientId } = createFixture();
  const location = await service.getPatientCurrentLocation(patientId, patientId, { ip: "127.0.0.1", deviceId: "device-1" });
  assert.equal(location.patient_id, patientId);
  assert.deepEqual(calls.at(-1), ["audit", patientId, null, "VIEW_CURRENT", "127.0.0.1", "device-1"]);
});

test("caregiver with an active grant can view location", async () => {
  const { service, patientId, caregiverId } = createFixture();
  const location = await service.getPatientCurrentLocation(caregiverId, patientId);
  assert.equal(location.patient_id, patientId);
});

test("only the patient can grant and revoke caregiver location access", async () => {
  const { service, calls, patientId, caregiverId } = createFixture();
  await service.grantLocationAccess(patientId, caregiverId, { ip: "127.0.0.1", deviceId: "patient-device" });
  assert.deepEqual(calls[0], ["grant", patientId, 2, null]);
  assert.deepEqual(calls[1], ["audit", patientId, caregiverId, "GRANT", "127.0.0.1", "patient-device"]);

  await service.revokeLocationAccess(patientId, caregiverId, { ip: "127.0.0.1", deviceId: "patient-device" });
  assert.deepEqual(calls[2], ["revoke", patientId, 2]);
  assert.deepEqual(calls[3], ["audit", patientId, caregiverId, "REVOKE", "127.0.0.1", "patient-device"]);

  await assert.rejects(() => service.grantLocationAccess(caregiverId, caregiverId), LocationAccessDeniedError);
});

test("caregiver without a grant gets 403-equivalent access denial", async () => {
  const { service, patientId, caregiverId } = createFixture({ grant: false });
  await assert.rejects(() => service.getPatientCurrentLocation(caregiverId, patientId), LocationAccessDeniedError);
});

test("caregiver cannot view another patient", async () => {
  const { service, caregiverId } = createFixture();
  await assert.rejects(() => service.getPatientCurrentLocation(caregiverId, 11), LocationAccessDeniedError);
});

test("revoked grant blocks location access", async () => {
  const { service, patientId, caregiverId } = createFixture({ grant: false });
  await assert.rejects(() => service.getPatientLocationHistory(caregiverId, patientId, "2026-08-01T00:00:00Z", "2026-08-02T00:00:00Z", 10), LocationAccessDeniedError);
});
