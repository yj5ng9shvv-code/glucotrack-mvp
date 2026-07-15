import "dotenv/config";

import bcrypt from "bcryptjs";
import { initializeDatabase, pool } from "./db.js";

const email = normalizeEmail(process.argv[2] ?? process.env.ADMIN_EMAIL);
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
const displayName = process.argv[4] ?? process.env.ADMIN_DISPLAY_NAME ?? "GlucoTrack Super Admin";

if (!email || !password || password.length < 12) {
  console.error("Usage: node create-admin.js admin@example.com 'StrongPassword123!' 'Display Name'");
  console.error("Password must contain at least 12 characters.");
  process.exit(1);
}

await initializeDatabase();

const existing = await pool.query("SELECT id FROM admin_users WHERE email = $1", [email]);
if (existing.rowCount) {
  console.error(`Admin user already exists: ${email}`);
  process.exit(2);
}

const passwordHash = await bcrypt.hash(password, 12);
const inserted = await pool.query(
  "INSERT INTO admin_users(email, password_hash, display_name) VALUES($1, $2, $3)",
  [email, passwordHash, displayName]
);
await pool.query(
  "INSERT INTO admin_user_roles(admin_user_id, role_id) SELECT $1, id FROM admin_roles WHERE code = 'super_admin'",
  [inserted.insertId]
);

console.log(`Created Super Admin ${email} with id ${inserted.insertId}.`);
process.exit(0);

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
