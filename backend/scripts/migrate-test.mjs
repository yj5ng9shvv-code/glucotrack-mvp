import { readFile } from "node:fs/promises";
import { configureTestDatabase } from "./test-database.mjs";

const database = configureTestDatabase();
const { closeDatabase, initializeDatabase, pool } = await import("../db.js");

try {
  await initializeDatabase();
  const migrations = [
    [25, "Family security foundation", "025_family_security_foundation.sql"],
    [26, "Family link invite token hardening", "026_family_link_invite_token_hardening.sql"],
    [27, "Family location tracking", "027_family_location_tracking.sql"]
  ];
  for (const [version, description, file] of migrations) {
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (!applied.rowCount) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
        await pool.query(statement);
      }
      await pool.query("INSERT INTO schema_migrations(version, description) VALUES($1, $2)", [version, description]);
    }
  }
  console.log(JSON.stringify({ ready: true, database, schemaVersion: 27, error: null }));
} finally {
  await closeDatabase();
}
