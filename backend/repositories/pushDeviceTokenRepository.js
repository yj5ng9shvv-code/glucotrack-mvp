export function createPushDeviceTokenRepository(query) {
  return {
    async findOwnedActiveDevice(userId, deviceId) {
      return (await query(
        `SELECT id, user_id, device_id, platform, revoked_at, push_revoked_at,
                push_token_hash, push_token_encrypted, last_token_update
         FROM account_devices
         WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL
         LIMIT 1`,
        [userId, deviceId]
      )).rows[0] ?? null;
    },

    async findActiveDeviceByTokenHash(tokenHash) {
      return (await query(
        `SELECT id, user_id, device_id
         FROM account_devices
         WHERE push_token_hash = $1
           AND revoked_at IS NULL
           AND push_revoked_at IS NULL
         LIMIT 1`,
        [tokenHash]
      )).rows[0] ?? null;
    },

    storePushToken({ deviceRowId, tokenHash, encryptedToken }) {
      return query(
        `UPDATE account_devices
         SET push_token_hash = $2,
             push_token_encrypted = $3,
             last_token_update = UTC_TIMESTAMP(),
             push_revoked_at = NULL
         WHERE id = $1 AND revoked_at IS NULL`,
        [deviceRowId, tokenHash, encryptedToken]
      );
    },

    revokePushToken(deviceRowId) {
      return query(
        `UPDATE account_devices
         SET push_token_hash = NULL,
             push_token_encrypted = NULL,
             push_revoked_at = UTC_TIMESTAMP()
         WHERE id = $1 AND revoked_at IS NULL`,
        [deviceRowId]
      );
    }
  };
}
