export function createSosRepository(query) {
  return {
    createSOS(patientId, latitude, longitude, accuracy) {
      return query(
        `INSERT INTO sos_events(patient_id, status, latitude, longitude, accuracy)
         VALUES($1, 'ACTIVE', $2, $3, $4)`,
        [patientId, latitude, longitude, accuracy]
      );
    },

    async findActiveByPatient(patientId) {
      return (await query(
        `SELECT id, patient_id, status, latitude, longitude, accuracy,
                created_at, cancelled_at, resolved_at
         FROM sos_events
         WHERE patient_id = $1 AND status = 'ACTIVE'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [patientId]
      )).rows[0] ?? null;
    },

    async getById(eventId) {
      return (await query(
        `SELECT id, patient_id, status, latitude, longitude, accuracy,
                created_at, cancelled_at, resolved_at
         FROM sos_events
         WHERE id = $1`,
        [eventId]
      )).rows[0] ?? null;
    },

    cancelSOS(eventId, patientId) {
      return query(
        `UPDATE sos_events
         SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP()
         WHERE id = $1 AND patient_id = $2 AND status = 'ACTIVE'`,
        [eventId, patientId]
      );
    },

    resolveSOS(eventId, patientId) {
      return query(
        `UPDATE sos_events
         SET status = 'RESOLVED', resolved_at = UTC_TIMESTAMP()
         WHERE id = $1 AND patient_id = $2 AND status = 'ACTIVE'`,
        [eventId, patientId]
      );
    },

    async getSOSHistory(patientId, limit) {
      return (await query(
        `SELECT id, patient_id, status, latitude, longitude, accuracy,
                created_at, cancelled_at, resolved_at
         FROM sos_events
         WHERE patient_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [patientId, limit]
      )).rows;
    }
  };
}
