import "../config/env-loader.js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for a database backup.`);
}

const backupDir = resolve(process.env.DB_BACKUP_DIR || "../backups");
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const backupPath = resolve(backupDir, `glukotrack_${timestamp}.sql`);
const executable = process.env.DB_DUMP_BIN || "mariadb-dump";
const result = spawnSync(executable, [
  `--host=${process.env.DB_HOST}`,
  `--port=${process.env.DB_PORT}`,
  `--user=${process.env.DB_USER}`,
  "--single-transaction",
  "--quick",
  "--routines",
  "--events",
  `--result-file=${backupPath}`,
  process.env.DB_NAME,
], {
  env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD },
  encoding: "utf8",
});

if (result.error || result.status !== 0 || !existsSync(backupPath)) {
  throw new Error(result.error?.message || result.stderr?.trim() || "Database dump failed.");
}

const checksum = createHash("sha256").update(readFileSync(backupPath)).digest("hex");
const info = statSync(backupPath);
console.log(JSON.stringify({ file: basename(backupPath), bytes: info.size, sha256: checksum }));
