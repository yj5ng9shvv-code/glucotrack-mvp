import "../config/env-loader.js";

if (process.env.NODE_ENV !== "test") throw new Error("NODE_ENV=test is required");
if (!/(_test|test_)$/i.test(process.env.TEST_DATABASE_NAME ?? "")) {
  throw new Error("TEST_DATABASE_NAME must be an isolated test database");
}
process.env.DB_HOST = process.env.TEST_DATABASE_HOST;
process.env.DB_PORT = process.env.TEST_DATABASE_PORT;
process.env.DB_NAME = process.env.TEST_DATABASE_NAME;
process.env.DB_USER = process.env.TEST_DATABASE_USER;
process.env.DB_PASSWORD = process.env.TEST_DATABASE_PASSWORD;
const { initializeDatabase } = await import("../db.js");
console.log(JSON.stringify(await initializeDatabase()));
