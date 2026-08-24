import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyTestEnvironment } from './bootstrap.js';
import { testApi } from './helpers/api.js';
import { resetFamilyState, withTestDatabase } from './helpers/state.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('Family Monitoring shares permitted latest diary data and history', async () => {
  await verifyTestEnvironment();
  const state = await resetFamilyState();
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      .toISOString();
  const payload = {
    profile: { glucoseMmol: 8.3, glucoseUnitPreference: 'mmolL' },
    diaryEntries: [
      {
        id: 'family-sync-current', time: now, glucoseMmol: 8.3,
        insulinUnits: 5, carbs: 40, note: 'test',
      },
      { id: 'family-sync-week', time: sevenDaysAgo, glucoseMmol: 7.1 },
    ],
    sensorReadings: [], emergency: {},
  };
  await withTestDatabase(async (db) => {
    await db.execute(
      `INSERT INTO health_snapshots(user_id,payload,schema_version,revision,updated_at)
       VALUES(?,?,1,1,UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE payload=VALUES(payload), updated_at=UTC_TIMESTAMP()`,
      [state.patientId, JSON.stringify(payload)],
    );
    await db.execute(
      `INSERT INTO patient_presence(patient_id,last_seen,online_status,glucose)
       VALUES(?,UTC_TIMESTAMP(),TRUE,8.3)
       ON DUPLICATE KEY UPDATE last_seen=UTC_TIMESTAMP(),online_status=TRUE,glucose=8.3`,
      [state.patientId],
    );
  });

  const api = testApi();
  const login = await api.login('caregiver@test.com');
  assert.equal(login.status, 200);
  const token = (await login.json()).token;

  const dashboard = await api.request('/family/patients', {headers: auth(token)});
  assert.equal(dashboard.status, 200);
  const patient = (await dashboard.json()).patients[0];
  assert.equal(patient.glucoseMmol, 8.3);
  assert.equal(patient.latestRecords.insulin.value, 5);
  assert.equal(patient.latestRecords.carbohydrates.value, 40);
  assert.equal(patient.latestRecords.note.value, 'test');
  assert.equal(patient.isOnline, true);

  const detail = await api.request(`/family/patients/${state.patientId}`, {
    headers: auth(token),
  });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).patient.diaryEntries.length, 2);
});
