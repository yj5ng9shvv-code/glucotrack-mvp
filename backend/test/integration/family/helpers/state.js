import mysql from 'mysql2/promise';

const baselinePermissions = JSON.stringify({
  glucose: true, history: true, emergency: true,
  viewGlucose: true, viewInsulin: false, viewFood: false,
  viewReports: false, receiveAlerts: true, sosAccess: true
});

export async function withTestDatabase(callback) {
  const db = await mysql.createConnection({
    host: process.env.TEST_DATABASE_HOST,
    port: Number(process.env.TEST_DATABASE_PORT || 3306),
    user: process.env.TEST_DATABASE_USER,
    password: process.env.TEST_DATABASE_PASSWORD,
    database: process.env.TEST_DATABASE_NAME
  });
  try {
    return await callback(db);
  } finally {
    await db.end();
  }
}

export async function resetFamilyState() {
  return withTestDatabase(async (db) => {
    const [users] = await db.execute(
      "SELECT id, email FROM users WHERE email IN ('patient@test.com','caregiver@test.com','stranger@test.com')"
    );
    const ids = Object.fromEntries(users.map((user) => [user.email, String(user.id)]));
    if (!ids['patient@test.com'] || !ids['caregiver@test.com'] || !ids['stranger@test.com']) {
      throw new Error('TEST SEED IS MISSING');
    }
    await db.execute(
      "UPDATE users SET premium_plan='family', premium_status='active', subscription_status='active', subscription_expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE id=?",
      [ids['patient@test.com']]
    );
    await db.execute(
      "UPDATE users SET premium_plan=NULL, premium_status='inactive', subscription_status='inactive' WHERE id IN (?,?)",
      [ids['caregiver@test.com'], ids['stranger@test.com']]
    );
    await db.execute(
      "UPDATE family_links SET status='revoked' WHERE owner_user_id=? AND invite_email<>'caregiver@test.com' AND status<>'revoked'",
      [ids['patient@test.com']]
    );
    await db.execute(
      "UPDATE family_links SET caregiver_user_id=?, permissions=?, status='accepted', expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), accepted_at=UTC_TIMESTAMP() WHERE owner_user_id=? AND invite_email='caregiver@test.com'",
      [ids['caregiver@test.com'], baselinePermissions, ids['patient@test.com']]
    );
    await db.execute(
      "INSERT INTO family_live_location_settings(user_id,enabled,consented_at) VALUES(?,TRUE,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE enabled=TRUE,consented_at=UTC_TIMESTAMP()",
      [ids['patient@test.com']]
    );
    await db.execute(
      "INSERT INTO family_live_location_grants(owner_user_id,caregiver_user_id,granted_at,revoked_at) VALUES(?,?,UTC_TIMESTAMP(),NULL) ON DUPLICATE KEY UPDATE granted_at=UTC_TIMESTAMP(),revoked_at=NULL",
      [ids['patient@test.com'], ids['caregiver@test.com']]
    );
    await db.execute('DELETE FROM family_live_location_current WHERE user_id=?', [ids['patient@test.com']]);
    await db.execute('DELETE FROM sos_events WHERE user_id IN (?,?)', [ids['patient@test.com'], ids['caregiver@test.com']]);
    const [links] = await db.execute("SELECT id FROM family_links WHERE owner_user_id=? AND invite_email='caregiver@test.com' LIMIT 1", [ids['patient@test.com']]);
    return { patientId: ids['patient@test.com'], caregiverId: ids['caregiver@test.com'], strangerId: ids['stranger@test.com'], linkId: String(links[0].id) };
  });
}
