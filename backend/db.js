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

export const pool = { query, transaction };

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

export async function transaction(callback) {
  if (!mysqlPool) throw new Error("Database is not initialized.");
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const transactionalQuery = async (sql, params = []) => {
      const normalizedSql = sql.replace(/\$(\d+)/g, "?");
      const normalizedParams = params.map((value) =>
        value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)
          ? JSON.stringify(value) : value
      );
      const [result] = await connection.execute(normalizedSql, normalizedParams);
      if (Array.isArray(result)) return { rows: result.map(normalizeJsonColumns), rowCount: result.length };
      return { rows: [], rowCount: result.affectedRows ?? 0, insertId: result.insertId ?? 0 };
    };
    const result = await callback(transactionalQuery);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
      schemaVersion: 7,
      installedAt: new Date().toISOString(),
      error: null
    };
    console.log(`Database ${databaseName} is ready (schema v${databaseStatus.schemaVersion})`);
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
      preferred_locale VARCHAR(16) NOT NULL DEFAULT 'en',
      premium_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
      premium_plan VARCHAR(32) NULL,
      premium_until DATETIME NULL,
      trial_started_at DATETIME NULL,
      trial_ends_at DATETIME NULL,
      trial_used BOOLEAN NOT NULL DEFAULT FALSE,
      subscription_status VARCHAR(32) NOT NULL DEFAULT 'inactive',
      subscription_expires_at DATETIME NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      diabetes_type VARCHAR(32) NULL,
      glucose_unit VARCHAR(16) NULL,
      email_verification_token_hash VARCHAR(64) NULL,
      email_verification_expires_at DATETIME NULL,
      password_reset_token_hash VARCHAR(64) NULL,
      password_reset_expires_at DATETIME NULL,
      stripe_customer_id VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const trialMigrationNeeded = !(await query(
    "SELECT 1 FROM schema_migrations WHERE version = 3"
  )).rowCount;
  const userColumns = [
    "preferred_locale VARCHAR(16) NOT NULL DEFAULT 'en'",
    "trial_started_at DATETIME NULL",
    "trial_ends_at DATETIME NULL",
    "trial_used BOOLEAN NOT NULL DEFAULT FALSE",
    "subscription_status VARCHAR(32) NOT NULL DEFAULT 'inactive'",
    "subscription_expires_at DATETIME NULL",
    "email_verified BOOLEAN NOT NULL DEFAULT FALSE",
    "email_verification_token_hash VARCHAR(64) NULL",
    "email_verification_expires_at DATETIME NULL",
    "password_reset_token_hash VARCHAR(64) NULL",
    "password_reset_expires_at DATETIME NULL",
    "diabetes_type VARCHAR(32) NULL",
    "glucose_unit VARCHAR(16) NULL"
  ];
  for (const definition of userColumns) {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${definition}`);
  }
  if (trialMigrationNeeded) {
    await query(`
      UPDATE users SET
      subscription_status = CASE
        WHEN premium_status IN ('active', 'trialing') THEN premium_status
        ELSE subscription_status
      END,
      subscription_expires_at = COALESCE(subscription_expires_at, premium_until),
      trial_started_at = CASE
        WHEN premium_status = 'trialing' THEN COALESCE(trial_started_at, created_at)
        ELSE trial_started_at
      END,
      trial_ends_at = CASE
        WHEN premium_status = 'trialing' THEN COALESCE(trial_ends_at, premium_until)
        ELSE trial_ends_at
      END,
      trial_used = CASE WHEN premium_status = 'trialing' THEN TRUE ELSE trial_used END,
      email_verified = TRUE
      WHERE created_at < UTC_TIMESTAMP()
    `);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS trial_devices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      device_hash VARCHAR(128) NOT NULL,
      first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      trial_used BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE KEY trial_devices_user_device_unique (user_id, device_hash),
      KEY trial_devices_hash_idx (device_hash, trial_used),
      CONSTRAINT trial_devices_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS oauth_identities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_subject VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY oauth_provider_subject_unique (provider, provider_subject),
      UNIQUE KEY oauth_user_provider_unique (user_id, provider),
      KEY oauth_email_idx (email),
      CONSTRAINT oauth_identities_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trial_identities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email_hash VARCHAR(64) NOT NULL UNIQUE,
      first_user_id BIGINT UNSIGNED NULL,
      trial_used BOOLEAN NOT NULL DEFAULT FALSE,
      first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY trial_identities_used_idx (trial_used, last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    INSERT INTO trial_identities
      (email_hash, first_user_id, trial_used, first_seen_at, last_seen_at)
    SELECT SHA2(LOWER(TRIM(email)), 256), id, trial_used, created_at, UTC_TIMESTAMP()
    FROM users
    WHERE trial_used = TRUE
    ON DUPLICATE KEY UPDATE
      trial_used = trial_identities.trial_used OR VALUES(trial_used),
      last_seen_at = UTC_TIMESTAMP()
  `);

  await query(`CREATE TABLE IF NOT EXISTS user_profiles (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, preferred_locale VARCHAR(16) NOT NULL DEFAULT 'en',
    profile JSON NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(32) NOT NULL, provider_subscription_id VARCHAR(255) NULL UNIQUE,
    plan VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL, expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY subscriptions_user_status_idx (user_id, status),
    CONSTRAINT subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS trial_periods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    started_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, status VARCHAR(32) NOT NULL,
    device_hash VARCHAR(128) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY trial_periods_status_idx (status, ends_at),
    CONSTRAINT trial_periods_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`
    INSERT INTO trial_periods (user_id, started_at, ends_at, status, created_at)
    SELECT id, trial_started_at, trial_ends_at,
      CASE WHEN trial_ends_at > UTC_TIMESTAMP() THEN 'active' ELSE 'expired' END,
      COALESCE(trial_started_at, created_at)
    FROM users
    WHERE trial_used = TRUE AND trial_started_at IS NOT NULL AND trial_ends_at IS NOT NULL
    ON DUPLICATE KEY UPDATE
      started_at = VALUES(started_at), ends_at = VALUES(ends_at), status = VALUES(status)
  `);
  await query(`CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(32) NOT NULL, provider_payment_id VARCHAR(255) NOT NULL UNIQUE,
    amount_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL, status VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY payments_user_created_idx (user_id, created_at),
    CONSTRAINT payments_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS glucose_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    glucose_mmol DECIMAL(7,3) NOT NULL, measured_at DATETIME NOT NULL, source VARCHAR(64) NOT NULL,
    metadata JSON NOT NULL, KEY glucose_logs_user_time_idx (user_id, measured_at),
    CONSTRAINT glucose_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS insulin_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    units DECIMAL(8,3) NOT NULL, insulin_type VARCHAR(64) NULL, administered_at DATETIME NOT NULL,
    metadata JSON NOT NULL, KEY insulin_logs_user_time_idx (user_id, administered_at),
    CONSTRAINT insulin_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS food_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL, carbs_grams DECIMAL(9,3) NOT NULL DEFAULT 0,
    eaten_at DATETIME NOT NULL, metadata JSON NOT NULL, KEY food_logs_user_time_idx (user_id, eaten_at),
    CONSTRAINT food_logs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS ai_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    request_type VARCHAR(64) NOT NULL, locale VARCHAR(16) NOT NULL, status VARCHAR(32) NOT NULL,
    model VARCHAR(64) NULL, input_tokens INT NULL, output_tokens INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ai_requests_user_time_idx (user_id, created_at),
    CONSTRAINT ai_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS voice_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    locale VARCHAR(16) NOT NULL, intent VARCHAR(64) NULL, status VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY voice_requests_user_time_idx (user_id, created_at),
    CONSTRAINT voice_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS sos_contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL, phone VARCHAR(80) NOT NULL, priority INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY sos_contacts_user_priority_idx (user_id, priority),
    CONSTRAINT sos_contacts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS child_profiles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, owner_user_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(255) NOT NULL, profile JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY child_profiles_owner_idx (owner_user_id),
    CONSTRAINT child_profiles_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS caregiver_access (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, child_profile_id BIGINT UNSIGNED NOT NULL,
    caregiver_user_id BIGINT UNSIGNED NOT NULL, permissions JSON NOT NULL, status VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY caregiver_access_unique (child_profile_id, caregiver_user_id),
    CONSTRAINT caregiver_access_child_fk FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE,
    CONSTRAINT caregiver_access_user_fk FOREIGN KEY (caregiver_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS settings (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, values_json JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT settings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS devices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    device_hash VARCHAR(128) NOT NULL, platform VARCHAR(32) NOT NULL, last_seen_at DATETIME NOT NULL,
    UNIQUE KEY devices_user_hash_unique (user_id, device_hash),
    CONSTRAINT devices_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY sessions_user_active_idx (user_id, revoked_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS password_resets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY password_resets_user_idx (user_id, created_at),
    CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS email_verifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, verified_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY email_verifications_user_idx (user_id, created_at),
    CONSTRAINT email_verifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

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
    CREATE TABLE IF NOT EXISTS account_devices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      device_name VARCHAR(120) NOT NULL,
      platform VARCHAR(32) NOT NULL,
      fingerprint_hash VARCHAR(64) NULL,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      UNIQUE KEY account_devices_user_device_unique (user_id, device_id),
      KEY account_devices_user_active_idx (user_id, revoked_at),
      CONSTRAINT account_devices_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS fingerprint_hash VARCHAR(64) NULL");
  await query(`
    UPDATE account_devices older
    JOIN account_devices newer
      ON newer.user_id = older.user_id
      AND newer.platform = older.platform
      AND newer.device_name = older.device_name
      AND newer.id > older.id
    SET older.revoked_at = COALESCE(older.revoked_at, UTC_TIMESTAMP())
    WHERE older.fingerprint_hash IS NULL AND newer.fingerprint_hash IS NULL
      AND older.revoked_at IS NULL AND newer.revoked_at IS NULL
  `);
  try {
    await query("CREATE UNIQUE INDEX account_devices_user_fingerprint_unique ON account_devices(user_id, fingerprint_hash)");
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") throw error;
  }

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
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      metadata JSON NOT NULL,
      read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY notifications_user_created_idx (user_id, created_at),
      CONSTRAINT notifications_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(2, 'Family subscriptions and multi-device account access')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(3, 'Server-authoritative one-time trial and email verification')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(4, 'Password recovery and notification storage')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(5, 'Normalized clinical, billing, access and audit tables')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(6, 'Verified OAuth identity links')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(7, 'Stable device fingerprints and server onboarding profile')`
  );
}

function normalizeJsonColumns(row) {
  for (const key of ["payload", "permissions", "metadata", "card"]) {
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
