import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState, withTestDatabase } from './helpers/state.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('Family subscription expiration blocks caregiver list, location, and SOS history', async () => {
  await verifyTestEnvironment();
  const state = await resetFamilyState();
  const api = testApi();
  const login = await api.login('caregiver@test.com');
  assert.equal(login.status, 200);
  const caregiverToken = (await login.json()).token;

  const active = await api.request('/family/patients', { headers: auth(caregiverToken) });
  assert.equal(active.status, 200);
  assert.equal((await active.json()).patients.length, 1);

  await withTestDatabase((db) => db.execute(
    "UPDATE users SET subscription_expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE), premium_until=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE id=?",
    [state.patientId]
  ));

  const list = await api.request('/family/patients', { headers: auth(caregiverToken) });
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).patients, []);

  const location = await api.request(`/family/patients/${state.patientId}/live-location`, { headers: auth(caregiverToken) });
  assert.equal(location.status, 403);

  const sosHistory = await api.request(`/family/patients/${state.patientId}/sos/history`, { headers: auth(caregiverToken) });
  assert.equal(sosHistory.status, 403, 'expired Family subscription must block SOS history');
});
