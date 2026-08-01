import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState, withTestDatabase } from './helpers/state.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function login(api, email) {
  const response = await api.login(email);
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

test('caregiver never inherits patient Family Premium or AI access', async () => {
  await verifyTestEnvironment();
  const state = await resetFamilyState();
  const api = testApi();
  const patientToken = await login(api, 'patient@test.com');
  const caregiverToken = await login(api, 'caregiver@test.com');

  const patientAi = await api.request('/ai/limits', { headers: auth(patientToken) });
  assert.equal(patientAi.status, 200);
  const caregiverAi = await api.request('/ai/limits', { headers: auth(caregiverToken) });
  assert.equal(caregiverAi.status, 429);
  assert.equal((await caregiverAi.json()).code, 'AI_PREMIUM_REQUIRED');

  await withTestDatabase((db) => db.execute(
    "UPDATE users SET premium_plan='monthly', premium_status='active', subscription_status='active', subscription_expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE id=?",
    [state.patientId]
  ));

  const familyPatients = await api.request('/family/patients', { headers: auth(caregiverToken) });
  assert.equal(familyPatients.status, 200);
  assert.deepEqual((await familyPatients.json()).patients, []);

  const location = await api.request(`/family/patients/${state.patientId}/live-location`, { headers: auth(caregiverToken) });
  assert.equal(location.status, 403);
});
