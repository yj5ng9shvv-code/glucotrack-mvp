ALTER TABLE user_food_catalog ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;
INSERT IGNORE INTO schema_migrations(version, description)
VALUES(23, 'Soft deletion support for personal food catalog products');
