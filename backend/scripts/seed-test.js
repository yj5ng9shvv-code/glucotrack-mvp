import "../config/env-loader.js";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const name = process.env.TEST_DATABASE_NAME;
if (process.env.NODE_ENV !== "test" || !/(_test|test_)$/i.test(name || "") || !process.env.TEST_DATABASE_USER) {
  throw new Error("Unsafe seed target");
}
const db = await mysql.createConnection({host: process.env.TEST_DATABASE_HOST, port: Number(process.env.TEST_DATABASE_PORT || 3306), user: process.env.TEST_DATABASE_USER, password: process.env.TEST_DATABASE_PASSWORD, database: name});
const testPasswordHash = await bcrypt.hash("test-password", 10);
const users = [
  ['patient@test.com', 'Test Patient', 'family', 'active'],
  ['caregiver@test.com', 'Test Caregiver', null, 'inactive'],
  ['stranger@test.com', 'Test Stranger', null, 'inactive'],
];
const ids = {};
for (const [email, fullName, plan, status] of users) {
  await db.execute(`INSERT INTO users(email,password_hash,full_name,premium_plan,premium_status,subscription_status,subscription_expires_at,email_verified)
    VALUES(?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), TRUE)
    ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), full_name=VALUES(full_name), premium_plan=VALUES(premium_plan), premium_status=VALUES(premium_status), subscription_status=VALUES(subscription_status)`, [email, testPasswordHash, fullName, plan, status, status]);
  const [row] = await db.execute('SELECT id FROM users WHERE email=?', [email]); ids[email] = row[0].id;
}
const permissions = JSON.stringify({glucose:true,history:true,emergency:true,viewGlucose:true,viewInsulin:false,viewFood:false,viewReports:false,receiveAlerts:true,sosAccess:true});
await db.execute(`INSERT INTO family_links(owner_user_id,caregiver_user_id,invite_email,invite_code,permissions,status,expires_at,accepted_at,member_name,member_role)
 VALUES(?,?,?,'test-family-invite-000000000001',?,'accepted',DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY),UTC_TIMESTAMP(),'Test Caregiver','guardian')
 ON DUPLICATE KEY UPDATE caregiver_user_id=VALUES(caregiver_user_id),permissions=VALUES(permissions),status='accepted',accepted_at=UTC_TIMESTAMP()`, [ids['patient@test.com'], ids['caregiver@test.com'], 'caregiver@test.com', permissions]);
await db.execute(`INSERT INTO family_live_location_settings(user_id,enabled,consented_at) VALUES(?,TRUE,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE enabled=TRUE,consented_at=UTC_TIMESTAMP()`, [ids['patient@test.com']]);
await db.execute(`INSERT INTO family_live_location_grants(owner_user_id,caregiver_user_id,granted_at,revoked_at) VALUES(?,?,UTC_TIMESTAMP(),NULL) ON DUPLICATE KEY UPDATE granted_at=UTC_TIMESTAMP(),revoked_at=NULL`, [ids['patient@test.com'], ids['caregiver@test.com']]);
await db.end();
console.log(`TEST FAMILY SEED\nDatabase: ${name}\nPatient: PASS\nCaregiver: PASS\nStranger: PASS\nFamily link: PASS\nPermissions: PASS\nLocation grant: PASS`);
