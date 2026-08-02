export function createLocationRepository(query) {
  return {
    createLocationUpdate(patientId, latitude, longitude, accuracy, batteryLevel, deviceId) {
      return query(
        `INSERT INTO patient_locations(
           patient_id, latitude, longitude, accuracy, battery_level, device_id
         ) VALUES($1, $2, $3, $4, $5, $6)`,
        [patientId, latitude, longitude, accuracy, batteryLevel, deviceId]
      );
    },

    async getCurrentLocation(patientId) {
      return (await query(
        `SELECT id, patient_id, latitude, longitude, accuracy, battery_level, device_id, created_at
         FROM patient_locations
         WHERE patient_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [patientId]
      )).rows[0] ?? null;
    },

    async getLocationHistory(patientId, from, to, limit) {
      return (await query(
        `SELECT id, patient_id, latitude, longitude, accuracy, battery_level, device_id, created_at
         FROM patient_locations
         WHERE patient_id = $1 AND created_at >= $2 AND created_at <= $3
         ORDER BY created_at DESC, id DESC
         LIMIT $4`,
        [patientId, from, to, limit]
      )).rows;
    },

    createAccessLog(patientId, caregiverId, action, ip, deviceId) {
      return query(
        `INSERT INTO location_access_logs(
           patient_id, caregiver_id, action, ip, device_id
         ) VALUES($1, $2, $3, $4, $5)`,
        [patientId, caregiverId, action, ip, deviceId]
      );
    },

    async getAccessLogs(patientId, limit) {
      return (await query(
        `SELECT id, patient_id, caregiver_id, action, ip, device_id, created_at
         FROM location_access_logs
         WHERE patient_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [patientId, limit]
      )).rows;
    },

    async findActiveLocationGrant(patientId, familyMemberId) {
      return (await query(
        `SELECT id, patient_user_id, family_member_id, status, expires_at, created_at
         FROM location_grants
         WHERE patient_user_id = $1 AND family_member_id = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())`,
        [patientId, familyMemberId]
      )).rows[0] ?? null;
    },

    grantLocationAccess(patientId, familyMemberId, expiresAt) {
      return query(
        `INSERT INTO location_grants(
           patient_user_id, family_member_id, status, expires_at, revoked_at
         ) VALUES($1, $2, 'active', $3, NULL)
         ON DUPLICATE KEY UPDATE
           status = 'active', expires_at = VALUES(expires_at), revoked_at = NULL`,
        [patientId, familyMemberId, expiresAt]
      );
    },

    revokeLocationAccess(patientId, familyMemberId) {
      return query(
        `UPDATE location_grants
         SET status = 'revoked', revoked_at = UTC_TIMESTAMP()
         WHERE patient_user_id = $1 AND family_member_id = $2 AND status = 'active'`,
        [patientId, familyMemberId]
      );
    }
  };
}
