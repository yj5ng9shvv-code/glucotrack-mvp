import { readFile, readdir } from "node:fs/promises";

const migrationsDirectory = new URL("../migrations/", import.meta.url);
const FAMILY_WATCH_MIGRATION_PATTERN = /^(\d+)_([a-z0-9_]+)\.sql$/i;
const FIRST_FAMILY_WATCH_MIGRATION = 25;

function descriptionFromFilename(name) {
  return name
    .replace(/^\d+_/, "")
    .replace(/\.sql$/i, "")
    .replaceAll("_", " ");
}

export async function discoverFamilyWatchMigrations() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(FAMILY_WATCH_MIGRATION_PATTERN);
      if (!match) return null;
      return {
        version: Number(match[1]),
        description: descriptionFromFilename(entry.name),
        file: entry.name
      };
    })
    .filter((migration) => migration && migration.version >= FIRST_FAMILY_WATCH_MIGRATION)
    .sort((left, right) => left.version - right.version);

  const versions = new Set();
  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.version) || versions.has(migration.version)) {
      throw new Error(`Invalid or duplicate Family Watch migration version: ${migration.file}`);
    }
    versions.add(migration.version);
  }
  return migrations;
}

export async function applyFamilyWatchMigrations({ query, migrations = undefined, readSql = undefined }) {
  if (typeof query !== "function") throw new TypeError("query is required");
  const plan = migrations ?? await discoverFamilyWatchMigrations();
  const read = readSql ?? ((file) => readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));

  for (const migration of plan) {
    const applied = await query("SELECT 1 FROM schema_migrations WHERE version = $1", [migration.version]);
    if (applied.rowCount) continue;
    const sql = await read(migration.file);
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) {
      await query(statement);
    }
    await query("INSERT INTO schema_migrations(version, description) VALUES($1, $2)", [migration.version, migration.description]);
  }
  return plan;
}
