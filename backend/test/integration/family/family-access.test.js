import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState } from './helpers/state.js';

async function tokenFor(api, email) {
  const response = await api.login(email);
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

function authorized(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(async () => {
  await verifyTestEnvironment();
  await resetFamilyState();
});

test('accepted caregiver sees only the linked patient; stranger sees no patient data', async () => {
  const api = testApi();
  const caregiverToken = await tokenFor(api, 'caregiver@test.com');
  const strangerToken = await tokenFor(api, 'stranger@test.com');

  const caregiver = await api.request('/family/patients', { headers: authorized(caregiverToken) });
  assert.equal(caregiver.status, 200);
  const caregiverBody = await caregiver.json();
  assert.equal(caregiverBody.patients.length, 1);
  assert.equal(caregiverBody.patients[0].email, 'patient@test.com');

  const stranger = await api.request('/family/patients', { headers: authorized(strangerToken) });
  assert.equal(stranger.status, 200);
  assert.deepEqual((await stranger.json()).patients, []);
});

test('revoking caregiver access also invalidates the live-location grant', async () => {
  const api = testApi();
  const patientToken = await tokenFor(api, 'patient@test.com');
  const caregiverToken = await tokenFor(api, 'caregiver@test.com');
  const state = await resetFamilyState();

  const position = await api.request('/family/live-location/position', {
    method: 'POST', headers: { ...authorized(patientToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 52.2297, longitude: 21.0122, accuracyMeters: 8 })
  });
  assert.equal(position.status, 200);

  const before = await api.request(`/family/patients/${state.patientId}/live-location`, { headers: authorized(caregiverToken) });
  assert.equal(before.status, 200);
  assert.equal((await before.json()).trackingStatus, 'active');

  const revoked = await api.request(`/family/members/${state.linkId}`, { method: 'DELETE', headers: authorized(patientToken) });
  assert.equal(revoked.status, 200);

  const after = await api.request(`/family/patients/${state.patientId}/live-location`, { headers: authorized(caregiverToken) });
  assert.equal(after.status, 403);
});
