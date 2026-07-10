import "dotenv/config";
import mysql from "mysql2/promise";

const databaseConfig = {
  host: requiredEnv("DB_HOST"),
  port: envNumber("DB_PORT", 3306),
  user: requiredEnv("DB_USER"),
  password: requiredEnv("DB_PASSWORD"),
};
const databaseName = validatedDatabaseName(requiredEnv("DB_NAME"));
let mysqlPool;
let databaseStatus = {
  ready: false,
  database: databaseName,
  schemaVersion: 0,
  installedAt: null,
  error: null
};

export const pool = { query };

export function getDatabaseStatus() {
  return { ...databaseStatus };
}

function createApplicationPool() {
  return mysql.createPool({
    ...databaseConfig,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: envNumber("DB_CONNECTION_LIMIT", 10),
    namedPlaceholders: false,
    timezone: "Z"
  });
}

export async function query(sql, params = []) {
  if (!mysqlPool) {
    throw new Error("Database is not initialized. Run initializeDatabase() first.");
  }
  const normalizedSql = sql.replace(/\$(\d+)/g, "?");
  const normalizedParams = params.map((value) => {
    if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }
    return value;
  });
  const [result] = await mysqlPool.execute(normalizedSql, normalizedParams);
  if (Array.isArray(result)) return { rows: result.map(normalizeJsonColumns), rowCount: result.length };
  return {
    rows: [],
    rowCount: result.affectedRows ?? 0,
    insertId: result.insertId ?? 0
  };
}

export async function initializeDatabase() {
  databaseStatus = {
    ...databaseStatus,
    ready: false,
    error: null
  };
  try {
    await createDatabaseIfNeeded();
    mysqlPool = createApplicationPool();
    await mysqlPool.query("SELECT 1");
    await installSchema();
    databaseStatus = {
      ready: true,
      database: databaseName,
      schemaVersion: 1,
      installedAt: new Date().toISOString(),
      error: null
    };
    console.log(`Database ${databaseName} is ready (schema v1)`);
    return getDatabaseStatus();
  } catch (error) {
    databaseStatus = {
      ...databaseStatus,
      ready: false,
      error: databaseErrorMessage(error)
    };
    if (mysqlPool) {
      await mysqlPool.end().catch(() => {});
      mysqlPool = null;
    }
    throw new Error(databaseStatus.error, { cause: error });
  }
}

async function createDatabaseIfNeeded() {
  const autoCreate = envBoolean("DB_AUTO_CREATE", true);
  if (!autoCreate) return;
  const adminUser = process.env.DB_ADMIN_USER?.trim();
  const adminConfig = {
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: adminUser || databaseConfig.user,
    password: adminUser
      ? (process.env.DB_ADMIN_PASSWORD ?? "")
      : databaseConfig.password,
    timezone: "Z"
  };
  const connection = await mysql.createConnection(adminConfig);
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` ` +
      "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
  } catch (error) {
    if (!["ER_DBACCESS_DENIED_ERROR", "ER_ACCESS_DENIED_ERROR"].includes(error?.code)) {
      throw error;
    }
    // Hestia often allows the application user to use a database but not create it.
    // Continue so an existing database can still be installed automatically.
  } finally {
    await connection.end();
  }
}

async function installSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED NOT NULL PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      premium_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
      premium_plan VARCHAR(32) NULL,
      premium_until DATETIME NULL,
      stripe_customer_id VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS health_snapshots (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      payload JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT health_snapshots_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS family_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      caregiver_user_id BIGINT UNSIGNED NULL,
      invite_email VARCHAR(255) NOT NULL,
      invite_code VARCHAR(255) NOT NULL UNIQUE,
      permissions JSON NOT NULL,
      status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME NULL,
      UNIQUE KEY family_links_owner_email_unique (owner_user_id, invite_email),
      KEY family_links_caregiver_idx (caregiver_user_id, status),
      CONSTRAINT family_links_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT family_links_caregiver_fk
        FOREIGN KEY (caregiver_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      metadata JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY reports_user_created_idx (user_id, created_at),
      CONSTRAINT reports_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS processed_webhooks (
      event_id VARCHAR(255) NOT NULL PRIMARY KEY,
      processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sos_profiles (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      public_token VARCHAR(64) NOT NULL UNIQUE,
      card JSON NOT NULL,
      pin_hash VARCHAR(255) NULL,
      hide_sensitive BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sos_profiles_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sos_scans (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      latitude DECIMAL(10, 7) NULL,
      longitude DECIMAL(10, 7) NULL,
      accuracy_meters DECIMAL(10, 2) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY sos_scans_user_time_idx (user_id, scanned_at),
      CONSTRAINT sos_scans_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(1, 'Initial GlucoTrack MySQL schema with SOS support')`
  );
}

function normalizeJsonColumns(row) {
  for (const key of ["payload", "permissions", "metadata"]) {
    if (typeof row[key] === "string") {
      try {
        row[key] = JSON.parse(row[key]);
      } catch {
        // Keep the original value if the database driver already returned text.
      }
    }
  }
  return row;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validatedDatabaseName(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error("DB_NAME may contain only letters, numbers, and underscores");
  }
  return value;
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envBoolean(name, fallback) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function databaseErrorMessage(error) {
  if (error?.code === "ER_BAD_DB_ERROR") {
    return `Database ${databaseName} does not exist and the configured MySQL user ` +
      "cannot create it. Create an empty database in Hestia or set DB_ADMIN_USER " +
      "and DB_ADMIN_PASSWORD; tables will then install automatically.";
  }
  if (error?.code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL rejected DB_USER/DB_PASSWORD (or DB_ADMIN credentials).";
  }
  if (error?.code === "ECONNREFUSED") {
    return `Cannot connect to MySQL at ${databaseConfig.host}:${databaseConfig.port}.`;
  }
  return error instanceof Error ? error.message : String(error);
}
