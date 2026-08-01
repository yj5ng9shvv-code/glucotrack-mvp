-- Apply only to an isolated staging database; never to production automatically.
CREATE TABLE IF NOT EXISTS benchmark_consents (
  staging_user_id BIGINT NOT NULL,
  consented_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (staging_user_id)
);

CREATE TABLE IF NOT EXISTS benchmark_export_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL,
  dry_run BOOLEAN NOT NULL,
  consented_users INT NOT NULL,
  excluded_users INT NOT NULL,
  event_count INT NOT NULL
);
