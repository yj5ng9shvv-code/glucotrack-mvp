CREATE TABLE IF NOT EXISTS user_food_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  food_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Food',
  portion_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
  calories DECIMAL(10,3) NOT NULL DEFAULT 0,
  protein_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
  fat_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
  carbohydrates_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
  glycemic_index DECIMAL(6,2) NOT NULL DEFAULT 0,
  usage_count INT UNSIGNED NOT NULL DEFAULT 0,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY user_food_catalog_user_name_idx (user_id, food_name),
  KEY user_food_catalog_user_favorite_idx (user_id, favorite, usage_count),
  CONSTRAINT user_food_catalog_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  food_id BIGINT UNSIGNED NULL,
  glucose_before DECIMAL(7,3) NULL,
  glucose_after DECIMAL(7,3) NULL,
  insulin DECIMAL(8,3) NULL,
  eaten_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY food_history_user_time_idx (user_id, eaten_at),
  CONSTRAINT food_history_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT food_history_food_fk FOREIGN KEY (food_id) REFERENCES user_food_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_food_analysis (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  image_reference VARCHAR(512) NULL,
  ai_response JSON NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ai_food_analysis_user_time_idx (user_id, created_at),
  CONSTRAINT ai_food_analysis_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations(version, description)
VALUES(22, 'Personal food catalog, food history and confirmed AI food analyses');
