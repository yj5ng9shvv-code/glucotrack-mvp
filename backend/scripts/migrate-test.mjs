import { configureTestDatabase } from "./test-database.mjs";
import { applyFamilyWatchMigrations } from "./family-watch-migrations.mjs";

const database = configureTestDatabase();
const { closeDatabase, initializeDatabase, pool } = await import("../db.js");

try {
  await initializeDatabase();
  const migrations = await applyFamilyWatchMigrations({ query: pool.query });
  console.log(JSON.stringify({ ready: true, database, schemaVersion: migrations.at(-1)?.version ?? 0, error: null }));
} finally {
  await closeDatabase();
}
