import "./config/env-loader.js";
import mysql from "mysql2/promise";
import {
  ABOUT_CONTENT,
  ABOUT_LOCALES
} from "./about-content.js";
import {
  HELP_ARTICLE_SEEDS,
  HELP_CATEGORY_SEEDS,
  HELP_CATEGORY_TRANSLATIONS,
  HELP_LOCALE_PHRASES,
  HELP_LOCALES
} from "./help-content.js";

const isTestEnvironment = process.env.NODE_ENV === "test";
const databaseConfig = {
  host: requiredEnv(isTestEnvironment ? "TEST_DATABASE_HOST" : "DB_HOST"),
  port: envNumber(isTestEnvironment ? "TEST_DATABASE_PORT" : "DB_PORT", 3306),
  user: requiredEnv(isTestEnvironment ? "TEST_DATABASE_USER" : "DB_USER"),
  password: requiredEnv(isTestEnvironment ? "TEST_DATABASE_PASSWORD" : "DB_PASSWORD"),
};
const databaseName = validatedDatabaseName(requiredEnv(isTestEnvironment ? "TEST_DATABASE_NAME" : "DB_NAME"));
if (isTestEnvironment && !/(_test|test_)$/i.test(databaseName)) {
  throw new Error("Integration tests require an isolated TEST_DATABASE_NAME; production database access is disabled.");
}
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
    charset: "utf8mb4",
    timezone: "Z"
  });
}

export async function query(sql, params = []) {
  if (!mysqlPool) {
    throw new Error("Database is not initialized. Run initializeDatabase() first.");
  }
  const { normalizedSql, normalizedParams } = normalizeSqlParams(sql, params);
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
      const { normalizedSql, normalizedParams } = normalizeSqlParams(sql, params);
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

export function normalizeSqlParams(sql, params = []) {
  const orderedParams = [];
  const normalizedSql = sql.replace(/\$(\d+)/g, (_match, index) => {
    orderedParams.push(params[Number(index) - 1]);
    return "?";
  });
  const sourceParams = orderedParams.length ? orderedParams : params;
  const normalizedParams = sourceParams.map((value) => {
    if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }
    return value;
  });
  return { normalizedSql, normalizedParams };
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
      schemaVersion: 25,
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
      stripe_event_created_at DATETIME NULL,
      token_version INT UNSIGNED NOT NULL DEFAULT 0,
      admin_blocked_at DATETIME NULL,
      admin_block_reason VARCHAR(255) NULL,
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
    ,"stripe_event_created_at DATETIME NULL"
    ,"token_version INT UNSIGNED NOT NULL DEFAULT 0"
    ,"admin_blocked_at DATETIME NULL"
    ,"admin_block_reason VARCHAR(255) NULL"
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
    event_created_at DATETIME NULL,
    KEY subscriptions_user_status_idx (user_id, status),
    CONSTRAINT subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS event_created_at DATETIME NULL");
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
  await query(`CREATE TABLE IF NOT EXISTS user_food_catalog (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    food_name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL DEFAULT 'Food',
    portion_grams DECIMAL(10,3) NOT NULL DEFAULT 0, calories DECIMAL(10,3) NOT NULL DEFAULT 0,
    protein_grams DECIMAL(10,3) NOT NULL DEFAULT 0, fat_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
    carbohydrates_grams DECIMAL(10,3) NOT NULL DEFAULT 0, glycemic_index DECIMAL(6,2) NOT NULL DEFAULT 0,
    usage_count INT UNSIGNED NOT NULL DEFAULT 0, favorite BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY user_food_catalog_user_name_idx (user_id, food_name),
    KEY user_food_catalog_user_favorite_idx (user_id, favorite, usage_count),
    CONSTRAINT user_food_catalog_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query("ALTER TABLE user_food_catalog ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL");
  await query(`CREATE TABLE IF NOT EXISTS food_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    food_id BIGINT UNSIGNED NULL, glucose_before DECIMAL(7,3) NULL, glucose_after DECIMAL(7,3) NULL,
    insulin DECIMAL(8,3) NULL, eaten_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY food_history_user_time_idx (user_id, eaten_at),
    CONSTRAINT food_history_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT food_history_food_fk FOREIGN KEY (food_id) REFERENCES user_food_catalog(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS ai_food_analysis (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    image_reference VARCHAR(512) NULL, ai_response JSON NOT NULL, confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ai_food_analysis_user_time_idx (user_id, created_at),
    CONSTRAINT ai_food_analysis_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query(`CREATE TABLE IF NOT EXISTS ai_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
    request_type VARCHAR(64) NOT NULL, locale VARCHAR(16) NOT NULL, status VARCHAR(32) NOT NULL,
    model VARCHAR(64) NULL, input_tokens INT NULL, output_tokens INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ai_requests_user_time_idx (user_id, created_at),
    CONSTRAINT ai_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS request_id VARCHAR(80) NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS plan VARCHAR(32) NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS is_photo BOOLEAN NOT NULL DEFAULT FALSE");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS period_date DATE NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS error_code VARCHAR(64) NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS duration_ms INT UNSIGNED NULL");
  await query("ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS estimated_cost_minor INT UNSIGNED NOT NULL DEFAULT 0");
  await query("CREATE UNIQUE INDEX IF NOT EXISTS ai_requests_user_request_uq ON ai_requests(user_id, request_id)");
  await query("CREATE INDEX IF NOT EXISTS ai_requests_limit_idx ON ai_requests(user_id, period_date, status, is_photo, created_at)");
  await query(`CREATE TABLE IF NOT EXISTS ai_limit_locks (
    lock_key VARCHAR(128) NOT NULL PRIMARY KEY,
    touched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      device_id VARCHAR(128) NOT NULL,
      device_name VARCHAR(120) NOT NULL,
      platform VARCHAR(32) NOT NULL,
      fingerprint_hash VARCHAR(64) NULL,
      token_version INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      UNIQUE KEY refresh_tokens_user_device_unique (user_id, device_id),
      KEY refresh_tokens_user_active_idx (user_id, revoked_at, expires_at),
      KEY refresh_tokens_expires_idx (expires_at),
      CONSTRAINT refresh_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_version INT UNSIGNED NOT NULL DEFAULT 0");
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
      schema_version INT UNSIGNED NOT NULL DEFAULT 1,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT health_snapshots_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS schema_version INT UNSIGNED NOT NULL DEFAULT 1");
  await query("ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS revision BIGINT UNSIGNED NOT NULL DEFAULT 0");
  await query(`CREATE TABLE IF NOT EXISTS sync_changes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL, revision BIGINT UNSIGNED NOT NULL,
    base_revision BIGINT UNSIGNED NOT NULL, payload JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY sync_changes_user_revision_unique (user_id, revision),
    KEY sync_changes_user_time_idx (user_id, created_at),
    CONSTRAINT sync_changes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

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
      status ENUM('pending', 'accepted', 'suspended', 'revoked') NOT NULL DEFAULT 'pending',
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
  await query(
    "ALTER TABLE family_links MODIFY COLUMN status " +
    "ENUM('pending', 'accepted', 'suspended', 'revoked') NOT NULL DEFAULT 'pending'"
  );
  await query("ALTER TABLE family_links ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) NOT NULL DEFAULT 0");
  await query("ALTER TABLE family_links ADD COLUMN IF NOT EXISTS email_sent_at DATETIME NULL");
  await query("ALTER TABLE family_links ADD COLUMN IF NOT EXISTS email_error VARCHAR(500) NULL");
  await query("ALTER TABLE family_links ADD COLUMN IF NOT EXISTS member_name VARCHAR(255) NULL");
  await query("ALTER TABLE family_links ADD COLUMN IF NOT EXISTS member_role ENUM('patient','guardian','doctor') NOT NULL DEFAULT 'guardian'");
  // The link table remains for backwards compatibility with existing clients.
  // These normalized tables are the authoritative family-access boundary for
  // new clients and make per-member permissions auditable.
  await query(`
    CREATE TABLE IF NOT EXISTS family_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      plan_type VARCHAR(32) NOT NULL DEFAULT 'family',
      max_members TINYINT UNSIGNED NOT NULL DEFAULT 5,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT family_groups_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS family_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      display_name VARCHAR(255) NULL,
      role ENUM('owner','patient','guardian','doctor') NOT NULL,
      status ENUM('pending','accepted','declined','suspended','revoked') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME NULL,
      KEY family_members_family_idx (family_id, status),
      KEY family_members_user_idx (user_id, status),
      CONSTRAINT family_members_family_fk FOREIGN KEY (family_id) REFERENCES family_groups(id) ON DELETE CASCADE,
      CONSTRAINT family_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS family_invitations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      family_id BIGINT UNSIGNED NOT NULL,
      member_id BIGINT UNSIGNED NOT NULL,
      email VARCHAR(255) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      role ENUM('patient','guardian','doctor') NOT NULL,
      status ENUM('pending','accepted','declined','expired','revoked') NOT NULL DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY family_invitations_email_idx (email, status),
      CONSTRAINT family_invitations_family_fk FOREIGN KEY (family_id) REFERENCES family_groups(id) ON DELETE CASCADE,
      CONSTRAINT family_invitations_member_fk FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS family_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      member_id BIGINT UNSIGNED NOT NULL UNIQUE,
      view_glucose BOOLEAN NOT NULL DEFAULT TRUE,
      view_insulin BOOLEAN NOT NULL DEFAULT FALSE,
      view_food BOOLEAN NOT NULL DEFAULT FALSE,
      view_reports BOOLEAN NOT NULL DEFAULT FALSE,
      receive_alerts BOOLEAN NOT NULL DEFAULT FALSE,
      sos_access BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT family_permissions_member_fk FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS family_access_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      subject_user_id BIGINT UNSIGNED NULL,
      family_member_id BIGINT UNSIGNED NULL,
      action VARCHAR(64) NOT NULL,
      details JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY family_access_audit_actor_idx (actor_user_id, created_at),
      KEY family_access_audit_subject_idx (subject_user_id, created_at),
      CONSTRAINT family_access_audit_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT family_access_audit_subject_fk FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT family_access_audit_member_fk FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL
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

  // Family SOS events are separate from the public QR SOS card and medical
  // snapshots. They retain only the minimum data needed during an emergency.
  await query(`
    CREATE TABLE IF NOT EXISTS sos_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
      glucose_mmol DECIMAL(6,3) NULL,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      accuracy_meters DECIMAL(10,2) NULL,
      activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY sos_events_user_status_idx (user_id, status, activated_at),
      CONSTRAINT sos_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS escalated_5_at DATETIME NULL");
  await query("ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS escalated_15_at DATETIME NULL");

  await query(`
    CREATE TABLE IF NOT EXISTS sos_pin_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      public_token VARCHAR(64) NOT NULL,
      ip_address VARCHAR(64) NOT NULL,
      user_agent VARCHAR(512) NULL,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_until DATETIME NULL,
      KEY sos_pin_attempts_lookup_idx (public_token, ip_address, attempted_at),
      KEY sos_pin_attempts_lock_idx (public_token, ip_address, locked_until),
      KEY sos_pin_attempts_user_time_idx (user_id, attempted_at),
      CONSTRAINT sos_pin_attempts_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Live family location is opt-in. Store only the last point: this feature
  // deliberately does not create a movement-history database.
  await query(`
    CREATE TABLE IF NOT EXISTS family_live_location_settings (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      consented_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT family_live_location_settings_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS family_live_location_grants (
      owner_user_id BIGINT UNSIGNED NOT NULL,
      caregiver_user_id BIGINT UNSIGNED NOT NULL,
      granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME NULL,
      PRIMARY KEY (owner_user_id, caregiver_user_id),
      KEY family_live_location_grants_caregiver_idx (caregiver_user_id, revoked_at),
      CONSTRAINT family_live_location_grants_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT family_live_location_grants_caregiver_fk
        FOREIGN KEY (caregiver_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS family_live_location_current (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      latitude DECIMAL(10,7) NOT NULL,
      longitude DECIMAL(10,7) NOT NULL,
      accuracy_meters DECIMAL(10,2) NULL,
      speed_mps DECIMAL(10,3) NULL,
      heading_degrees DECIMAL(7,2) NULL,
      captured_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT family_live_location_current_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // One current heartbeat per patient. Deliberately no historical trail.
  await query(`
    CREATE TABLE IF NOT EXISTS patient_presence (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      last_seen DATETIME NOT NULL,
      online_status BOOLEAN NOT NULL DEFAULT TRUE,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      battery TINYINT UNSIGNED NULL,
      glucose DECIMAL(6,3) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY patient_presence_patient_uq (patient_id),
      KEY patient_presence_last_seen_idx (last_seen),
      CONSTRAINT patient_presence_patient_fk
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Route points are retained only while a patient has an active SOS event.
  // Normal family tracking continues to store just the current location.
  await query(`
    CREATE TABLE IF NOT EXISTS patient_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT UNSIGNED NOT NULL,
      family_id BIGINT UNSIGNED NULL,
      latitude DECIMAL(10,7) NOT NULL,
      longitude DECIMAL(10,7) NOT NULL,
      accuracy DECIMAL(10,2) NULL,
      battery_level TINYINT UNSIGNED NULL,
      captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sos_session_id BIGINT UNSIGNED NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'sos',
      KEY patient_locations_patient_time_idx (patient_id, captured_at),
      KEY patient_locations_sos_time_idx (sos_session_id, captured_at),
      CONSTRAINT patient_locations_patient_fk
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT patient_locations_sos_fk
        FOREIGN KEY (sos_session_id) REFERENCES sos_events(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      two_factor_secret VARCHAR(64) NULL,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY admin_users_active_idx (is_active, email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(96) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_role_permissions (
      role_id BIGINT UNSIGNED NOT NULL,
      permission_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      CONSTRAINT admin_role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
      CONSTRAINT admin_role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_user_roles (
      admin_user_id BIGINT UNSIGNED NOT NULL,
      role_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (admin_user_id, role_id),
      CONSTRAINT admin_user_roles_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
      CONSTRAINT admin_user_roles_role_fk FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_user_permissions (
      admin_user_id BIGINT UNSIGNED NOT NULL,
      permission_id BIGINT UNSIGNED NOT NULL,
      granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (admin_user_id, permission_id),
      CONSTRAINT admin_user_permissions_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
      CONSTRAINT admin_user_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_user_id BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      two_factor_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      KEY admin_sessions_user_active_idx (admin_user_id, revoked_at, expires_at),
      CONSTRAINT admin_sessions_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_user_id BIGINT UNSIGNED NULL,
      email VARCHAR(255) NOT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      failure_reason VARCHAR(64) NULL,
      locked_until DATETIME NULL,
      attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY admin_login_attempts_lookup_idx (email, attempted_at),
      KEY admin_login_attempts_lock_idx (email, locked_until),
      CONSTRAINT admin_login_attempts_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_user_id BIGINT UNSIGNED NULL,
      action VARCHAR(96) NOT NULL,
      entity_type VARCHAR(64) NULL,
      entity_id VARCHAR(64) NULL,
      metadata JSON NOT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY admin_audit_logs_time_idx (created_at),
      KEY admin_audit_logs_admin_idx (admin_user_id, created_at),
      CONSTRAINT admin_audit_logs_user_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      subject VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      priority VARCHAR(32) NOT NULL DEFAULT 'normal',
      assigned_admin_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY support_tickets_status_idx (status, updated_at),
      CONSTRAINT support_tickets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT support_tickets_admin_fk FOREIGN KEY (assigned_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ticket_id BIGINT UNSIGNED NOT NULL,
      author_user_id BIGINT UNSIGNED NULL,
      author_admin_id BIGINT UNSIGNED NULL,
      body TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY support_messages_ticket_idx (ticket_id, created_at),
      CONSTRAINT support_messages_ticket_fk FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
      CONSTRAINT support_messages_user_fk FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT support_messages_admin_fk FOREIGN KEY (author_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notification_campaigns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      locale VARCHAR(16) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      audience_filter JSON NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
      delivered_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      scheduled_at DATETIME NULL,
      sent_at DATETIME NULL,
      KEY notification_campaigns_status_idx (status, scheduled_at),
      CONSTRAINT notification_campaigns_admin_fk FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS audience_filter JSON NULL");
  await query("ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS recipient_count INT UNSIGNED NOT NULL DEFAULT 0");
  await query("ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS delivered_count INT UNSIGNED NOT NULL DEFAULT 0");
  await query("ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS sent_at DATETIME NULL");

  await query(`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      campaign_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      notification_id BIGINT UNSIGNED NULL,
      channel VARCHAR(32) NOT NULL DEFAULT 'in_app',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      delivered_at DATETIME NULL,
      error_message VARCHAR(255) NULL,
      KEY notification_deliveries_campaign_idx (campaign_id, status),
      CONSTRAINT notification_deliveries_campaign_fk FOREIGN KEY (campaign_id) REFERENCES notification_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT notification_deliveries_notification_fk FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL,
      CONSTRAINT notification_deliveries_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS notification_id BIGINT UNSIGNED NULL");
  await query("ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS channel VARCHAR(32) NOT NULL DEFAULT 'in_app'");
  await query("ALTER TABLE notification_deliveries ADD INDEX IF NOT EXISTS notification_deliveries_user_idx (user_id, delivered_at)");

  await query(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      code VARCHAR(32) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      disabled_at DATETIME NULL,
      disabled_reason VARCHAR(255) NULL,
      KEY referral_codes_active_idx (is_active, code),
      CONSTRAINT referral_codes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_clicks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      referral_code_id BIGINT UNSIGNED NOT NULL,
      click_token VARCHAR(96) NOT NULL UNIQUE,
      ip_hash VARCHAR(64) NULL,
      user_agent_hash VARCHAR(64) NULL,
      platform VARCHAR(32) NULL,
      country VARCHAR(8) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      KEY referral_clicks_code_time_idx (referral_code_id, created_at),
      KEY referral_clicks_expiry_idx (expires_at),
      CONSTRAINT referral_clicks_code_fk FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_relations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      referrer_user_id BIGINT UNSIGNED NOT NULL,
      referred_user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      referral_code_id BIGINT UNSIGNED NOT NULL,
      referral_click_id BIGINT UNSIGNED NULL,
      status VARCHAR(32) NOT NULL,
      registered_at DATETIME NULL,
      email_verified_at DATETIME NULL,
      qualified_at DATETIME NULL,
      rewarded_at DATETIME NULL,
      rejected_at DATETIME NULL,
      rejection_reason VARCHAR(96) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY referral_relations_referrer_status_idx (referrer_user_id, status, created_at),
      KEY referral_relations_status_idx (status, updated_at),
      CONSTRAINT referral_relations_referrer_fk FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT referral_relations_referred_fk FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT referral_relations_code_fk FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE RESTRICT,
      CONSTRAINT referral_relations_click_fk FOREIGN KEY (referral_click_id) REFERENCES referral_clicks(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      referral_relation_id BIGINT UNSIGNED NOT NULL,
      beneficiary_user_id BIGINT UNSIGNED NOT NULL,
      reward_type VARCHAR(32) NOT NULL,
      reward_days INT UNSIGNED NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      available_from DATETIME NOT NULL,
      granted_at DATETIME NULL,
      revoked_at DATETIME NULL,
      revoke_reason VARCHAR(96) NULL,
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY referral_rewards_relation_idx (referral_relation_id, status),
      KEY referral_rewards_user_idx (beneficiary_user_id, status),
      KEY referral_rewards_due_idx (status, available_from),
      CONSTRAINT referral_rewards_relation_fk FOREIGN KEY (referral_relation_id) REFERENCES referral_relations(id) ON DELETE CASCADE,
      CONSTRAINT referral_rewards_user_fk FOREIGN KEY (beneficiary_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS premium_bonus_periods (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      source VARCHAR(32) NOT NULL,
      source_id BIGINT UNSIGNED NOT NULL,
      bonus_days INT UNSIGNED NOT NULL,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      granted_by BIGINT UNSIGNED NULL,
      revoked_at DATETIME NULL,
      revoke_reason VARCHAR(96) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY premium_bonus_periods_source_unique (source, source_id),
      KEY premium_bonus_periods_user_idx (user_id, status, ends_at),
      CONSTRAINT premium_bonus_periods_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT premium_bonus_periods_admin_fk FOREIGN KEY (granted_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_fraud_checks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      referral_relation_id BIGINT UNSIGNED NOT NULL,
      check_type VARCHAR(64) NOT NULL,
      result VARCHAR(32) NOT NULL,
      risk_score INT UNSIGNED NOT NULL DEFAULT 0,
      matched_entity_hash VARCHAR(64) NULL,
      details_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY referral_fraud_checks_relation_idx (referral_relation_id, created_at),
      CONSTRAINT referral_fraud_checks_relation_fk FOREIGN KEY (referral_relation_id) REFERENCES referral_relations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(96) NOT NULL UNIQUE,
      setting_value JSON NOT NULL,
      updated_by BIGINT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT referral_settings_admin_fk FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_audit_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      action VARCHAR(96) NOT NULL,
      old_value_json JSON NULL,
      new_value_json JSON NULL,
      admin_user_id BIGINT UNSIGNED NULL,
      ip_hash VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY referral_audit_log_entity_idx (entity_type, entity_id, created_at),
      CONSTRAINT referral_audit_log_admin_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const referralDefaults = [
    ["programEnabled", true],
    ["referrerRewardDays", 14],
    ["referredRewardEnabled", true],
    ["referredRewardDays", 7],
    ["attributionDays", 30],
    ["monthlyRewardLimit", 10],
    ["lifetimeRewardLimit", 0],
    ["minimumPaymentMinor", 1],
    ["eligiblePlans", ["monthly", "yearly", "family", "premium"]],
    ["reviewDelayDays", 0]
  ];
  for (const [key, value] of referralDefaults) {
    await query(
      "INSERT IGNORE INTO referral_settings(setting_key, setting_value) VALUES($1, $2)",
      [key, value]
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(96) NOT NULL PRIMARY KEY,
      setting_value JSON NOT NULL,
      is_secret BOOLEAN NOT NULL DEFAULT FALSE,
      updated_by BIGINT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT system_settings_admin_fk FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS system_settings_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(96) NOT NULL,
      setting_value JSON NOT NULL,
      changed_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY system_settings_versions_key_idx (setting_key, created_at),
      CONSTRAINT system_settings_versions_admin_fk FOREIGN KEY (changed_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS localization_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      locale VARCHAR(16) NOT NULL,
      version_label VARCHAR(64) NOT NULL,
      payload JSON NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY localization_versions_locale_idx (locale, created_at),
      CONSTRAINT localization_versions_admin_fk FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS security_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(96) NOT NULL,
      severity VARCHAR(32) NOT NULL DEFAULT 'info',
      user_id BIGINT UNSIGNED NULL,
      admin_user_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(64) NULL,
      metadata JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY security_events_type_time_idx (event_type, created_at),
      CONSTRAINT security_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT security_events_admin_fk FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS system_errors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(64) NOT NULL,
      severity VARCHAR(32) NOT NULL DEFAULT 'error',
      code VARCHAR(96) NULL,
      endpoint VARCHAR(255) NULL,
      dedupe_key VARCHAR(64) NULL,
      safe_message VARCHAR(512) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      occurrences INT UNSIGNED NOT NULL DEFAULT 1,
      first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      UNIQUE KEY system_errors_dedupe_unique (dedupe_key),
      KEY system_errors_status_idx (status, severity, last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE system_errors ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(64) NULL");
  await query("ALTER TABLE system_errors ADD UNIQUE INDEX IF NOT EXISTS system_errors_dedupe_unique (dedupe_key)");

  await query(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      backup_type VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      file_path VARCHAR(512) NULL,
      file_size_bytes BIGINT UNSIGNED NULL,
      duration_ms BIGINT UNSIGNED NULL,
      created_by BIGINT UNSIGNED NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      error_message VARCHAR(512) NULL,
      KEY backup_runs_time_idx (started_at),
      CONSTRAINT backup_runs_admin_fk FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gdpr_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      request_type VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      reason VARCHAR(512) NULL,
      requested_by_admin_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      KEY gdpr_requests_status_idx (status, created_at),
      CONSTRAINT gdpr_requests_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT gdpr_requests_admin_fk FOREIGN KEY (requested_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const gdprRequestColumns = [
    "public_id VARCHAR(32) NULL UNIQUE",
    "subject VARCHAR(255) NULL",
    "description TEXT NULL",
    "admin_comment TEXT NULL",
    "user_comment TEXT NULL",
    "user_visible_comment TEXT NULL",
    "internal_admin_comment TEXT NULL",
    "identity_verified_at DATETIME NULL",
    "submitted_at DATETIME NULL",
    "due_at DATETIME NULL",
    "cancelled_at DATETIME NULL",
    "rejected_at DATETIME NULL",
    "rejection_reason VARCHAR(1000) NULL",
    "assigned_admin_id BIGINT UNSIGNED NULL",
    "source VARCHAR(32) NOT NULL DEFAULT 'admin'",
    "locale VARCHAR(16) NOT NULL DEFAULT 'en'",
    "ip_address_hash VARCHAR(128) NULL",
    "user_agent VARCHAR(512) NULL",
    "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  ];
  for (const definition of gdprRequestColumns) {
    await query(`ALTER TABLE gdpr_requests ADD COLUMN IF NOT EXISTS ${definition}`);
  }
  await query("ALTER TABLE gdpr_requests ADD INDEX IF NOT EXISTS gdpr_requests_public_idx (public_id)");
  await query("ALTER TABLE gdpr_requests ADD INDEX IF NOT EXISTS gdpr_requests_user_idx (user_id, created_at)");
  await query("ALTER TABLE gdpr_requests ADD INDEX IF NOT EXISTS gdpr_requests_type_idx (request_type, created_at)");
  await query("ALTER TABLE gdpr_requests ADD INDEX IF NOT EXISTS gdpr_requests_due_idx (due_at)");
  await query("ALTER TABLE gdpr_requests ADD INDEX IF NOT EXISTS gdpr_requests_assigned_idx (assigned_admin_id, status)");

  await query(`
    CREATE TABLE IF NOT EXISTS gdpr_request_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      actor_type VARCHAR(32) NOT NULL,
      actor_id VARCHAR(64) NULL,
      event_type VARCHAR(64) NOT NULL,
      old_status VARCHAR(32) NULL,
      new_status VARCHAR(32) NULL,
      comment TEXT NULL,
      metadata_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY gdpr_events_request_idx (request_id, created_at),
      KEY gdpr_events_type_idx (event_type, created_at),
      CONSTRAINT gdpr_events_request_fk FOREIGN KEY (request_id) REFERENCES gdpr_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gdpr_request_files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      file_type VARCHAR(32) NOT NULL,
      original_name VARCHAR(255) NULL,
      stored_name VARCHAR(255) NOT NULL,
      storage_path VARCHAR(512) NOT NULL,
      mime_type VARCHAR(128) NULL,
      size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      checksum VARCHAR(128) NULL,
      expires_at DATETIME NULL,
      download_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY gdpr_files_request_idx (request_id, created_at),
      KEY gdpr_files_expiry_idx (expires_at, deleted_at),
      CONSTRAINT gdpr_files_request_fk FOREIGN KEY (request_id) REFERENCES gdpr_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gdpr_export_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      progress INT UNSIGNED NOT NULL DEFAULT 0,
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      failed_at DATETIME NULL,
      error_message VARCHAR(1000) NULL,
      archive_path VARCHAR(512) NULL,
      archive_password_hash VARCHAR(255) NULL,
      expires_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY gdpr_export_request_idx (request_id, created_at),
      KEY gdpr_export_expiry_idx (expires_at, status),
      CONSTRAINT gdpr_export_request_fk FOREIGN KEY (request_id) REFERENCES gdpr_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS gdpr_data_actions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT UNSIGNED NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(128) NULL,
      action_result VARCHAR(64) NOT NULL,
      details_json JSON NOT NULL,
      executed_by BIGINT UNSIGNED NULL,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY gdpr_actions_request_idx (request_id, executed_at),
      KEY gdpr_actions_type_idx (action_type, executed_at),
      CONSTRAINT gdpr_actions_request_fk FOREIGN KEY (request_id) REFERENCES gdpr_requests(id) ON DELETE CASCADE,
      CONSTRAINT gdpr_actions_admin_fk FOREIGN KEY (executed_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    INSERT IGNORE INTO system_settings(setting_key, setting_value, is_secret)
    VALUES
      ('gdpr_due_days', '30', FALSE),
      ('gdpr_export_retention_days', '7', FALSE),
      ('gdpr_draft_retention_days', '14', FALSE)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(32) NOT NULL,
      current_version VARCHAR(64) NOT NULL,
      minimum_version VARCHAR(64) NULL,
      recommended_version VARCHAR(64) NULL,
      force_update BOOLEAN NOT NULL DEFAULT FALSE,
      rollout_percent INT UNSIGNED NOT NULL DEFAULT 100,
      download_url VARCHAR(512) NULL,
      changelog TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      updated_by BIGINT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY app_versions_platform_unique (platform),
      CONSTRAINT app_versions_admin_fk FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(96) NOT NULL UNIQUE,
      icon VARCHAR(64) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY help_categories_active_idx (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_category_translations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      category_id BIGINT UNSIGNED NOT NULL,
      locale VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY help_category_translations_unique (category_id, locale),
      KEY help_category_translations_locale_idx (locale),
      CONSTRAINT help_category_translations_category_fk FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_articles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      category_id BIGINT UNSIGNED NOT NULL,
      slug VARCHAR(96) NOT NULL UNIQUE,
      status ENUM('draft','review','published','archived') NOT NULL DEFAULT 'draft',
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0,
      view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY help_articles_category_idx (category_id, status, sort_order),
      KEY help_articles_status_idx (status, published_at),
      CONSTRAINT help_articles_category_fk FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE RESTRICT,
      CONSTRAINT help_articles_created_by_fk FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
      CONSTRAINT help_articles_updated_by_fk FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query("ALTER TABLE help_articles ADD COLUMN IF NOT EXISTS view_count BIGINT UNSIGNED NOT NULL DEFAULT 0");

  await query(`
    CREATE TABLE IF NOT EXISTS help_article_translations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      article_id BIGINT UNSIGNED NOT NULL,
      locale VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      content LONGTEXT NOT NULL,
      translation_status ENUM('missing','machine_translated','needs_review','approved','outdated') NOT NULL DEFAULT 'needs_review',
      source_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
      translated_at DATETIME NULL,
      reviewed_at DATETIME NULL,
      reviewed_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY help_article_translations_unique (article_id, locale),
      KEY help_article_translations_locale_idx (locale, translation_status),
      FULLTEXT KEY help_article_translations_search_idx (title, summary, content),
      CONSTRAINT help_article_translations_article_fk FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE,
      CONSTRAINT help_article_translations_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_article_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      article_id BIGINT UNSIGNED NOT NULL,
      locale VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      content LONGTEXT NOT NULL,
      translation_status VARCHAR(32) NOT NULL,
      version_number BIGINT UNSIGNED NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY help_article_versions_article_idx (article_id, locale, version_number),
      CONSTRAINT help_article_versions_article_fk FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE,
      CONSTRAINT help_article_versions_admin_fk FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_article_feedback (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      article_id BIGINT UNSIGNED NOT NULL,
      locale VARCHAR(16) NOT NULL,
      helpful BOOLEAN NOT NULL,
      comment TEXT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY help_article_feedback_article_idx (article_id, created_at),
      CONSTRAINT help_article_feedback_article_fk FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_search_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      locale VARCHAR(16) NOT NULL,
      query VARCHAR(120) NOT NULL,
      result_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY help_search_logs_locale_idx (locale, created_at),
      KEY help_search_logs_query_idx (query)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS about_content (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      section_key VARCHAR(96) NOT NULL UNIQUE,
      content_type ENUM('hero','text','advantage','disclaimer','links') NOT NULL DEFAULT 'text',
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY about_content_order_idx (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS about_content_translations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      content_id BIGINT UNSIGNED NOT NULL,
      locale VARCHAR(16) NOT NULL,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      content MEDIUMTEXT NULL,
      translation_status ENUM('draft','machine_translated','needs_review','approved','outdated','published') NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY about_content_translation_locale_uq (content_id, locale),
      KEY about_content_translation_locale_idx (locale, translation_status),
      CONSTRAINT about_content_translation_content_fk FOREIGN KEY (content_id) REFERENCES about_content(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedHelpCenter();
  await seedAboutContent();
  await seedAdminRbac();

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
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(8, 'Suspend family access whenever the owner family subscription is inactive')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(9, 'Authoritative ordered Stripe subscription state')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(10, 'Versioned conflict-aware health snapshot synchronization')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(11, 'Refresh-token rotation and persistent session refresh flow')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(12, 'Refresh tokens now track token version for user-wide revocation')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(13, 'SOS PIN unlock attempt journal and brute-force lockout')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(14, 'Administrative RBAC, sessions, audit and operations tables')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(15, 'Administrative account controls, backups, GDPR, app versions and error monitoring')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(16, 'Direct per-administrator permission grants')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(17, 'Deduplicated sanitized system error monitoring')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(18, 'Referral program data model and moderation tables')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(19, 'Referral rewards and premium bonus periods')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(20, 'Multilingual Help Center content, feedback and search logs')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(22, 'Server-authoritative AI access limits, idempotency and audit fields')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(21, 'Editable multilingual About GlukoTrack content')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(22, 'Personal food catalog, food history and confirmed AI food analyses')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(23, 'Soft deletion support for personal food catalog products')`
  );
  await query(
    `INSERT IGNORE INTO schema_migrations(version, description)
     VALUES(25, 'Normalized Family Access groups, invitations, permissions and audit log')`
  );
}

async function seedAboutContent() {
  const sections = [
    ["hero", "hero", 10],
    ["what_is", "text", 20],
    ["advantage_ai", "advantage", 30],
    ["advantage_sos", "advantage", 40],
    ["advantage_diary", "advantage", 50],
    ["advantage_family", "advantage", 60],
    ["advantage_location", "advantage", 70],
    ["advantage_localization", "advantage", 80],
    ["advantage_referral", "advantage", 90],
    ["advantage_sync", "advantage", 100],
    ["advantage_privacy", "advantage", 110],
    ["medical_disclaimer", "disclaimer", 120]
  ];
  for (const [sectionKey, contentType, sortOrder] of sections) {
    await query(
      `INSERT INTO about_content(section_key, content_type, sort_order, is_active)
       VALUES($1, $2, $3, TRUE)
       ON DUPLICATE KEY UPDATE content_type = VALUES(content_type), sort_order = VALUES(sort_order)`,
      [sectionKey, contentType, sortOrder]
    );
  }
  const rows = await query("SELECT id, section_key FROM about_content");
  const ids = Object.fromEntries(rows.rows.map((row) => [row.section_key, row.id]));
  for (const locale of ABOUT_LOCALES) {
    const about = ABOUT_CONTENT[locale] || ABOUT_CONTENT.en;
    await upsertAboutTranslation(ids.hero, locale, about.hero.title, about.hero.subtitle, about.shortDescription);
    await upsertAboutTranslation(ids.what_is, locale, about.whatIs.title, about.tagline, about.whatIs.paragraphs.join("\n\n"));
    for (const advantage of about.advantages) {
      await upsertAboutTranslation(
        ids[`advantage_${advantage.key}`],
        locale,
        advantage.title,
        "",
        advantage.description
      );
    }
    await upsertAboutTranslation(
      ids.medical_disclaimer,
      locale,
      about.medicalDisclaimer.title,
      "",
      about.medicalDisclaimer.text
    );
  }
}

async function upsertAboutTranslation(contentId, locale, title, subtitle, content) {
  if (!contentId) return;
  await query(
    `INSERT INTO about_content_translations(content_id, locale, title, subtitle, content, translation_status)
     VALUES($1, $2, $3, $4, $5, 'published')
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       subtitle = VALUES(subtitle),
       content = VALUES(content),
       translation_status = IF(translation_status = 'draft', translation_status, VALUES(translation_status))`,
    [contentId, locale, title, subtitle || null, content || null]
  );
}

async function seedHelpCenter() {
  for (const [slug, icon, sortOrder, titleEn, descriptionEn, titleRu, descriptionRu] of HELP_CATEGORY_SEEDS) {
    await query(
      `INSERT INTO help_categories(slug, icon, sort_order, is_active)
       VALUES($1, $2, $3, TRUE)
       ON DUPLICATE KEY UPDATE icon = VALUES(icon), sort_order = VALUES(sort_order), is_active = TRUE`,
      [slug, icon, sortOrder]
    );
    const category = await query("SELECT id FROM help_categories WHERE slug = $1", [slug]);
    const categoryId = category.rows[0]?.id;
    if (!categoryId) continue;
    for (const locale of HELP_LOCALES) {
      const categoryIndex = HELP_CATEGORY_SEEDS.findIndex((item) => item[0] === slug);
      const localizedTitle = HELP_CATEGORY_TRANSLATIONS[locale]?.[categoryIndex] ?? titleEn;
      const localizedDescription = HELP_LOCALE_PHRASES[locale]?.description ?? descriptionEn;
      await query(
        `INSERT INTO help_category_translations(category_id, locale, title, description)
         VALUES($1, $2, $3, $4)
         ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)`,
        [
          categoryId,
          locale,
          locale === "en" ? titleEn : locale === "ru" ? titleRu : localizedTitle,
          locale === "en" ? descriptionEn : locale === "ru" ? descriptionRu : localizedDescription
        ]
      );
    }
  }

  let sortOrder = 10;
  for (const seed of HELP_ARTICLE_SEEDS) {
    const category = await query("SELECT id FROM help_categories WHERE slug = $1", [seed.category]);
    const categoryId = category.rows[0]?.id;
    if (!categoryId) continue;
    await query(
      `INSERT INTO help_articles(category_id, slug, status, is_featured, sort_order, published_at)
       VALUES($1, $2, 'published', $3, $4, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         category_id = VALUES(category_id),
         is_featured = VALUES(is_featured),
         sort_order = VALUES(sort_order),
         published_at = COALESCE(published_at, UTC_TIMESTAMP())`,
      [categoryId, seed.slug, Boolean(seed.featured), sortOrder]
    );
    const article = await query("SELECT id FROM help_articles WHERE slug = $1", [seed.slug]);
    const articleId = article.rows[0]?.id;
    if (!articleId) continue;
    for (const locale of HELP_LOCALES) {
      const isRu = locale === "ru";
      const isSource = locale === "en";
      const localizedCategoryIndex = HELP_CATEGORY_SEEDS.findIndex((item) => item[0] === seed.category);
      const localizedCategory = HELP_CATEGORY_TRANSLATIONS[locale]?.[localizedCategoryIndex] ?? seed.category;
      const localizedTitle = locale === "en" ? seed.titleEn : locale === "ru" ? seed.titleRu : `${localizedCategory} - GlukoTrack`;
      const localizedSummary = locale === "en" ? seed.summaryEn : locale === "ru" ? seed.summaryRu : HELP_LOCALE_PHRASES[locale]?.summary ?? seed.summaryEn;
      const localizedContent = locale === "en" ? seed.contentEn : locale === "ru" ? seed.contentRu : `<p>${HELP_LOCALE_PHRASES[locale]?.article ?? seed.contentEn.replace(/<[^>]+>/g, " ")}</p>`;
      await query(
        `INSERT INTO help_article_translations(article_id, locale, title, summary, content, translation_status, source_version, translated_at, reviewed_at)
         VALUES($1, $2, $3, $4, $5, $6, 1, UTC_TIMESTAMP(), CASE WHEN $6 = 'approved' THEN UTC_TIMESTAMP() ELSE NULL END)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           summary = VALUES(summary),
           content = VALUES(content)`,
        [
          articleId,
          locale,
          localizedTitle,
          localizedSummary,
          localizedContent,
          isSource || isRu ? "approved" : "machine_translated"
        ]
      );
    }
    sortOrder += 10;
  }
}

async function seedAdminRbac() {
  const roles = [
    ["super_admin", "Super Admin", "Full administrative access"],
    ["support", "Support", "User and support operations without medical-data access by default"],
    ["billing_manager", "Billing Manager", "Subscriptions, payments and financial operations"],
    ["content_manager", "Content Manager", "Localization, notification and content operations"],
    ["security_auditor", "Security Auditor", "Read-only security and audit access"],
    ["medical_data_reviewer", "Medical Data Reviewer", "Explicit anonymized medical-data review access"]
  ];
  for (const role of roles) {
    await query(
      "INSERT IGNORE INTO admin_roles(code, name, description) VALUES($1, $2, $3)",
      role
    );
  }
  const permissions = [
    ["*", "All permissions"],
    ["dashboard:read", "Read aggregated administrative dashboard"],
    ["users:read", "Read user account records"],
    ["users:write", "Perform limited user account actions"],
    ["admins:write", "Create and manage administrators"],
    ["devices:read", "Read registered devices"],
    ["subscriptions:read", "Read subscriptions and trials"],
    ["payments:read", "Read payments"],
    ["payments:write", "Perform billing operations"],
    ["support:write", "Manage support tickets"],
    ["localizations:read", "Read localization versions"],
    ["localizations:write", "Manage localization versions"],
    ["notifications:read", "Read notification campaigns"],
    ["notifications:write", "Manage notification campaigns"],
    ["referrals:read", "Read referral program records"],
    ["referrals:write", "Moderate referral program records"],
    ["help:read", "Read Help Center content"],
    ["help:write", "Manage Help Center categories, articles and translations"],
    ["about:read", "Read About GlukoTrack content"],
    ["about:write", "Manage About GlukoTrack content and translations"],
    ["audit:read", "Read administrative audit logs"],
    ["security:read", "Read security events and SOS metadata"],
    ["backups:read", "Read backup history"],
    ["backups:write", "Create manual backups"],
    ["gdpr:read", "Read GDPR request queue"],
    ["gdpr:write", "Create and update GDPR requests"],
    ["gdpr.view", "View GDPR requests"],
    ["gdpr.create", "Create GDPR requests"],
    ["gdpr.assign", "Assign GDPR requests"],
    ["gdpr.comment", "Comment on GDPR requests"],
    ["gdpr.verify_identity", "Verify GDPR request identity"],
    ["gdpr.approve", "Approve GDPR requests"],
    ["gdpr.reject", "Reject GDPR requests"],
    ["gdpr.export", "Generate GDPR exports"],
    ["gdpr.anonymize", "Anonymize user data for GDPR"],
    ["gdpr.delete_user", "Delete or disable user account for GDPR"],
    ["gdpr.complete", "Complete GDPR requests"],
    ["gdpr.view_audit", "View GDPR audit trail"],
    ["gdpr.settings", "Manage GDPR settings"],
    ["versions:read", "Read app version policy"],
    ["versions:write", "Manage app version policy"],
    ["errors:read", "Read sanitized system errors"],
    ["settings:read", "Read non-secret system settings"],
    ["settings:write", "Manage system settings"],
    ["medical:read", "Read explicitly permitted medical data"]
  ];
  for (const permission of permissions) {
    await query(
      "INSERT IGNORE INTO admin_permissions(code, description) VALUES($1, $2)",
      permission
    );
  }
  const grants = {
    super_admin: ["*"],
    support: ["dashboard:read", "users:read", "devices:read", "subscriptions:read", "support:write", "audit:read", "gdpr:read", "gdpr.view", "gdpr.comment"],
    billing_manager: ["dashboard:read", "users:read", "subscriptions:read", "payments:read", "payments:write", "gdpr:read", "gdpr.view"],
    content_manager: ["dashboard:read", "localizations:read", "localizations:write", "notifications:read", "notifications:write", "referrals:read", "versions:read", "help:read", "help:write", "about:read", "about:write"],
    security_auditor: ["dashboard:read", "audit:read", "security:read", "errors:read", "backups:read"],
    medical_data_reviewer: ["dashboard:read", "medical:read", "users:read", "gdpr:read", "gdpr.view", "gdpr.view_audit"]
  };
  for (const [role, rolePermissions] of Object.entries(grants)) {
    for (const permission of rolePermissions) {
      await query(
        `INSERT IGNORE INTO admin_role_permissions(role_id, permission_id)
         SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p
         WHERE r.code = $1 AND p.code = $2`,
        [role, permission]
      );
    }
  }
}

function normalizeJsonColumns(row) {
  for (const key of ["payload", "permissions", "metadata", "metadata_json", "card", "audience_filter", "setting_value", "details_json", "old_value_json", "new_value_json"]) {
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
