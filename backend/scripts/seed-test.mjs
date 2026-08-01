import bcrypt from "bcryptjs";
import { configureTestDatabase } from "./test-database.mjs";

const database = configureTestDatabase();
const { closeDatabase, initializeDatabase, pool } = await import("../db.js");
try {
  await initializeDatabase();
  const passwordHash = await bcrypt.hash("test-password", 10);
  const users = {};
  for (const [key, email, name] of [["patient", "patient@test.com", "Test Patient"], ["caregiver", "caregiver@test.com", "Test Caregiver"], ["stranger", "stranger@test.com", "Test Stranger"]]) {
    await pool.query("INSERT INTO users(email,password_hash,full_name) VALUES($1,$2,$3) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), password_hash=VALUES(password_hash), full_name=VALUES(full_name)", [email, passwordHash, name]);
    users[key] = (await pool.query("SELECT id FROM users WHERE email=$1", [email])).rows[0].id;
  }
  await pool.query("INSERT INTO family_groups(patient_user_id,status) VALUES($1,'active') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), status='active'", [users.patient]);
  const groupId = (await pool.query("SELECT id FROM family_groups WHERE patient_user_id=$1", [users.patient])).rows[0].id;
  for (const [key, role] of [["patient", "patient"], ["caregiver", "caregiver"]]) {
    await pool.query("INSERT INTO family_members(family_group_id,user_id,role,status) VALUES($1,$2,$3,'active') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), status='active'", [groupId, users[key], role]);
  }
  const caregiverMemberId = (await pool.query("SELECT id FROM family_members WHERE family_group_id=$1 AND user_id=$2", [groupId, users.caregiver])).rows[0].id;
  await pool.query("INSERT INTO family_permissions(family_member_id,can_view_glucose,can_view_history,can_view_location,can_view_sos) VALUES($1,TRUE,TRUE,TRUE,TRUE) ON DUPLICATE KEY UPDATE can_view_glucose=TRUE,can_view_history=TRUE,can_view_insulin=FALSE,can_view_food=FALSE,can_view_location=TRUE,can_view_sos=TRUE,can_view_reports=FALSE", [caregiverMemberId]);
  await pool.query("INSERT INTO location_grants(patient_user_id,family_member_id,status) VALUES($1,$2,'active') ON DUPLICATE KEY UPDATE status='active',revoked_at=NULL", [users.patient, caregiverMemberId]);
  console.log(JSON.stringify({ ready: true, database, patient: "PASS", caregiver: "PASS", stranger: "PASS", family: "PASS" }));
} finally {
  await closeDatabase();
}
