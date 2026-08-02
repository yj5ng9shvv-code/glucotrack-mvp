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
    }
  };
}
