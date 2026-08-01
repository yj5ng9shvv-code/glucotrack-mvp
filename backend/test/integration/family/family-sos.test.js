import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState } from './helpers/state.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function login(api, email) {
  const response = await api.login(email);
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

beforeEach(async () => { await verifyTestEnvironment(); await resetFamilyState(); });

test('caregiver can view patient SOS history but cannot cancel the patient SOS event', async () => {
  const api = testApi();
  const patientToken = await login(api, 'patient@test.com');
  const caregiverToken = await login(api, 'caregiver@test.com');
  const { patientId } = await resetFamilyState();

  const created = await api.request('/sos/events', {
    method: 'POST', headers: { ...auth(patientToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 52.2297, longitude: 21.0122, glucoseMmol: 3.2 })
  });
  assert.equal(created.status, 201);
  const eventId = (await created.json()).id;

  const history = await api.request(`/family/patients/${patientId}/sos/history`, { headers: auth(caregiverToken) });
  assert.equal(history.status, 200);
  assert.equal(String((await history.json()).events[0].id), String(eventId));

  const forbiddenCancel = await api.request(`/sos/events/${eventId}/cancel`, { method: 'POST', headers: auth(caregiverToken) });
  assert.equal(forbiddenCancel.status, 404);
});
