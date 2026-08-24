import { createHash } from "node:crypto";
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { configureTestDatabase } from "./test-database.mjs";

const database = configureTestDatabase();
const outputDir = process.env.SOS_TEST_BACKUP_DIR ?? join(process.cwd(), "..", "backups", "sos-test-db");
const tables = ["sos_events", "sos_notification_outbox", "notification_delivery_logs"];

await mkdir(outputDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(outputDir, `sos-test-${database}-${timestamp}.sql`);

const adminConnection = await mysql.createConnection({
  host: process.env.TEST_DATABASE_HOST,
  port: Number(process.env.TEST_DATABASE_PORT ?? 3306),
  user: process.env.TEST_DATABASE_USER,
  password: process.env.TEST_DATABASE_PASSWORD,
  timezone: "Z"
});
await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await adminConnection.end();

const connection = await mysql.createConnection({
  host: process.env.TEST_DATABASE_HOST,
  port: Number(process.env.TEST_DATABASE_PORT ?? 3306),
  user: process.env.TEST_DATABASE_USER,
  password: process.env.TEST_DATABASE_PASSWORD,
  database,
  timezone: "Z"
});

try {
  const chunks = [
    `-- SOS test backup`,
    `-- database: ${database}`,
    `-- created_at: ${new Date().toISOString()}`,
    `SET FOREIGN_KEY_CHECKS=0;`
  ];
  for (const table of tables) {
    const [exists] = await connection.query("SHOW TABLES LIKE ?", [table]);
    if (!exists.length) continue;
    const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    chunks.push(`\nDROP TABLE IF EXISTS \`${table}\`;`);
    chunks.push(`${createRow["Create Table"]};`);
    const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
    for (const row of rows) {
      const columns = Object.keys(row).map((key) => `\`${key}\``).join(", ");
      const values = Object.values(row).map(sqlValue).join(", ");
      chunks.push(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});`);
    }
  }
  chunks.push("SET FOREIGN_KEY_CHECKS=1;", "");
  await writeFile(backupPath, chunks.join("\n"), "utf8");
  const content = await readFile(backupPath);
  const digest = createHash("sha256").update(content).digest("hex");
  const info = await stat(backupPath);
  console.log(JSON.stringify({ ready: true, database, path: backupPath, size: info.size, sha256: digest, tables }, null, 2));
} finally {
  await connection.end();
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}