import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';

test('Family integration authentication uses only seeded test accounts', async () => {
  const environment = await verifyTestEnvironment();
  assert.equal(environment.database, 'glucotrack_test');

  const api = testApi();
  for (const email of ['patient@test.com', 'caregiver@test.com', 'stranger@test.com']) {
    const response = await api.login(email);
    assert.equal(response.status, 200, `${email} must authenticate`);
    const body = await response.json();
    assert.equal(typeof body.token, 'string');
    assert.ok(body.token.length > 20);
  }
});
