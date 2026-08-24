import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFamilyWatchMigrations,
  discoverFamilyWatchMigrations
} from "../scripts/family-watch-migrations.mjs";

const expectedVersions = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

test("Family Watch migration discovery is complete and filename ordered", async () => {
  const migrations = await discoverFamilyWatchMigrations();

  assert.deepEqual(migrations.map((migration) => migration.version), expectedVersions);
  assert.deepEqual(
    migrations.filter((migration) => migration.version >= 27).map((migration) => migration.file),
    [
      "027_family_location_tracking.sql",
      "028_family_sos_events.sql",
      "029_sos_notification_outbox.sql",
      "030_sos_push_delivery.sql",
      "031_push_device_tokens.sql",
      "032_family_invitation_accept_throttling.sql",
      "033_legacy_family_watch_compatibility.sql",
      "034_family_watch_single_active_sos.sql",
      "035_legacy_family_access_compatibility.sql",
      "036_sos_idempotency.sql"
    ]
  );
});

test("fresh Family Watch migration plan applies every required database object in order", async () => {
  const migrations = await discoverFamilyWatchMigrations();
  const queries = [];
  const appliedVersions = [];
  const migrationSql = {
    "027_family_location_tracking.sql": "CREATE TABLE patient_locations; CREATE TABLE location_access_logs;",
    "028_family_sos_events.sql": "CREATE TABLE sos_events;",
    "029_sos_notification_outbox.sql": "CREATE TABLE sos_notification_outbox;",
    "030_sos_push_delivery.sql": "CREATE TABLE notification_delivery_logs;",
    "031_push_device_tokens.sql": "ALTER TABLE account_devices ADD push_token_hash CHAR(64);",
    "032_family_invitation_accept_throttling.sql": "CREATE TABLE family_invitation_accept_attempts;",
    "033_legacy_family_watch_compatibility.sql": "ALTER TABLE patient_locations ADD COLUMN device_id VARCHAR(128); ALTER TABLE sos_events ADD COLUMN patient_id BIGINT;",
    "034_family_watch_single_active_sos.sql": "ALTER TABLE sos_events ADD COLUMN active_patient_id BIGINT; CREATE UNIQUE INDEX sos_events_one_active_patient_unique ON sos_events(active_patient_id);",
    "035_legacy_family_access_compatibility.sql": "ALTER TABLE family_groups ADD COLUMN patient_user_id BIGINT; ALTER TABLE family_members ADD COLUMN family_group_id BIGINT; CREATE TABLE location_grants;",
    "036_sos_idempotency.sql": "ALTER TABLE sos_events ADD COLUMN client_event_id VARCHAR(64); CREATE UNIQUE INDEX sos_events_user_client_event_unique ON sos_events(user_id, client_event_id);"
  };

  await applyFamilyWatchMigrations({
    migrations,
    readSql: async (file) => migrationSql[file] ?? "CREATE TABLE migration_placeholder;",
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.startsWith("SELECT 1 FROM schema_migrations")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("INSERT INTO schema_migrations")) appliedVersions.push(params[0]);
      return { rowCount: 0, rows: [] };
    }
  });

  assert.deepEqual(appliedVersions, expectedVersions);
  const statements = queries.map((query) => query.sql).join("\n");
  for (const requiredObject of [
    "patient_locations",
    "location_access_logs",
    "sos_events",
    "sos_notification_outbox",
    "notification_delivery_logs",
    "push_token_hash",
    "family_invitation_accept_attempts"
  ]) {
    assert.match(statements, new RegExp(requiredObject));
  }
});
