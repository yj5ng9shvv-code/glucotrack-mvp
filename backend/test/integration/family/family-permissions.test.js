import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState } from './helpers/state.js';

test('Family permission matrix preserves explicit disabled permissions', async () => {
  await verifyTestEnvironment();
  const api = testApi();
  const state = await resetFamilyState();
  const patientLogin = await api.login('patient@test.com');
  const caregiverLogin = await api.login('caregiver@test.com');
  assert.equal(patientLogin.status, 200);
  assert.equal(caregiverLogin.status, 200);
  const patientToken = (await patientLogin.json()).token;
  const caregiverToken = (await caregiverLogin.json()).token;

  const permissions = {
    glucose: true, history: true, emergency: true,
    viewGlucose: true, viewInsulin: false, viewFood: false,
    viewReports: false, receiveAlerts: true, sosAccess: true
  };
  const changed = await api.request(`/family/members/${state.linkId}/permissions`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${patientToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions })
  });
  assert.equal(changed.status, 200);

  const details = await api.request(`/family/patients/${state.patientId}`, {
    headers: { Authorization: `Bearer ${caregiverToken}` }
  });
  assert.equal(details.status, 200);
  const patient = (await details.json()).patient;
  assert.equal(patient.permissions.glucose, true);
  assert.equal(patient.permissions.history, true);
  assert.equal(patient.permissions.viewInsulin, false);
  assert.equal(patient.permissions.viewFood, false);
  assert.equal(patient.permissions.viewReports, false, 'reports must remain denied when explicitly disabled');
});
