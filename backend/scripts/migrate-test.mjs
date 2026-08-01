import { readFile } from "node:fs/promises";
import { configureTestDatabase } from "./test-database.mjs";

const database = configureTestDatabase();
const { closeDatabase, initializeDatabase, pool } = await import("../db.js");

try {
  await initializeDatabase();
  const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [25]);
  if (!applied.rowCount) {
    const sql = await readFile(new URL("../migrations/025_family_security_foundation.sql", import.meta.url), "utf8");
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
      await pool.query(statement);
    }
    await pool.query("INSERT INTO schema_migrations(version, description) VALUES($1, $2)", [25, "Family security foundation"]);
  }
  console.log(JSON.stringify({ ready: true, database, schemaVersion: 25, error: null }));
} finally {
  await closeDatabase();
}
