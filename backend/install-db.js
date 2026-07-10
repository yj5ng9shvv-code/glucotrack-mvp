import { initializeDatabase } from "./db.js";

try {
  const status = await initializeDatabase();
  console.log(JSON.stringify({ ok: true, ...status }, null, 2));
  process.exitCode = 0;
} catch (error) {
  console.error("Database installation failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
