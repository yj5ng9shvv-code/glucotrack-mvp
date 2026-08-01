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

async function createInvitation(api, patientToken, email) {
  const response = await api.request('/family/invitations', {
    method: 'POST',
    headers: { ...auth(patientToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, permissions: { glucose: true, history: true, emergency: true }, locale: 'en' })
  });
  assert.equal(response.status, 201);
  return (await response.json()).invitation;
}

test('Family invitations are email-bound, expire, and cannot be reused', async () => {
  await verifyTestEnvironment();
  const state = await resetFamilyState();
  const api = testApi();
  const patientToken = await login(api, 'patient@test.com');
  const caregiverToken = await login(api, 'caregiver@test.com');
  const strangerToken = await login(api, 'stranger@test.com');

  const mismatch = await createInvitation(api, patientToken, 'mismatch@test.com');
  const wrongEmail = await api.request('/family/invitations/accept', {
    method: 'POST', headers: { ...auth(caregiverToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: mismatch.inviteCode })
  });
  assert.equal(wrongEmail.status, 404);

  const expired = await createInvitation(api, patientToken, 'stranger@test.com');
  await withTestDatabase((db) => db.execute(
    'UPDATE family_links SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE id=?', [expired.id]
  ));
  const expiredResponse = await api.request('/family/invitations/accept', {
    method: 'POST', headers: { ...auth(strangerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: expired.inviteCode })
  });
  assert.equal(expiredResponse.status, 404);

  const invitation = await createInvitation(api, patientToken, 'stranger@test.com');
  const accepted = await api.request('/family/invitations/accept', {
    method: 'POST', headers: { ...auth(strangerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: invitation.inviteCode })
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).link.status, 'accepted');

  const reused = await api.request('/family/invitations/accept', {
    method: 'POST', headers: { ...auth(strangerToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: invitation.inviteCode })
  });
  assert.equal(reused.status, 404);

  assert.notEqual(String(state.patientId), '');
});
