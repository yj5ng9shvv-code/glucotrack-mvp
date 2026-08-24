export function createSosRepository(query) {
  const selectEvent = `SELECT id, patient_id, client_event_id,
                CASE LOWER(status)
                  WHEN 'active' THEN 'ACTIVE'
                  WHEN 'cancelled' THEN 'CANCELLED'
                  WHEN 'resolved' THEN 'RESOLVED'
                  ELSE UPPER(status)
                END AS status,
                latitude, longitude, accuracy,
                created_at, cancelled_at, resolved_at
         FROM sos_events`;

  return {
    createSOS(patientId, latitude, longitude, accuracy, options = {}) {
      return query(
        `INSERT INTO sos_events(patient_id, user_id, status, latitude, longitude, accuracy, client_event_id, client_request_id, source)
         VALUES($1, $1, 'active', $2, $3, $4, $5, $6, $7)`,
        [
          patientId,
          latitude,
          longitude,
          accuracy,
          options.clientEventId ?? null,
          options.clientRequestId ?? null,
          options.source ?? 'manual'
        ]
      );
    },

    async findByClientEvent(patientId, clientEventId) {
      if (!clientEventId) return null;
      return (await query(
        `${selectEvent}
         WHERE patient_id = $1 AND client_event_id = $2
         LIMIT 1`,
        [patientId, clientEventId]
      )).rows[0] ?? null;
    },

    async findActiveByPatient(patientId) {
      return (await query(
        `${selectEvent}
         WHERE patient_id = $1 AND LOWER(status) = 'active'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [patientId]
      )).rows[0] ?? null;
    },

    async findRecentActiveDuplicate(patientId, windowSeconds) {
      return (await query(
        `${selectEvent}
         WHERE patient_id = $1 AND LOWER(status) = 'active'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 SECOND)
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [patientId, windowSeconds]
      )).rows[0] ?? null;
    },

    async countRecentByPatient(patientId, windowMinutes) {
      const result = await query(
        `SELECT COUNT(*) count FROM sos_events
         WHERE patient_id = $1 AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 MINUTE)`,
        [patientId, windowMinutes]
      );
      return Number(result.rows[0]?.count || 0);
    },

    async countRecentManualByPatient(patientId, windowMinutes) {
      const result = await query(
        `SELECT COUNT(*) count FROM sos_events
         WHERE patient_id = $1 AND source = 'manual'
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 MINUTE)`,
        [patientId, windowMinutes]
      );
      return Number(result.rows[0]?.count || 0);
    },

    async autoCloseActive(patientId, afterHours) {
      return query(
        `UPDATE sos_events
         SET status = 'resolved', resolved_at = UTC_TIMESTAMP(), status_updated_at = UTC_TIMESTAMP()
         WHERE patient_id = $1 AND LOWER(status) = 'active'
           AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL $2 HOUR)`,
        [patientId, afterHours]
      );
    },

    async getById(eventId) {
      return (await query(
        `${selectEvent}
         WHERE id = $1`,
        [eventId]
      )).rows[0] ?? null;
    },

    cancelSOS(eventId, patientId) {
      return query(
        `UPDATE sos_events
         SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), status_updated_at = UTC_TIMESTAMP()
         WHERE id = $1 AND patient_id = $2 AND LOWER(status) = 'active'`,
        [eventId, patientId]
      );
    },

    resolveSOS(eventId, patientId) {
      return query(
        `UPDATE sos_events
         SET status = 'resolved', resolved_at = UTC_TIMESTAMP(), status_updated_at = UTC_TIMESTAMP()
         WHERE id = $1 AND patient_id = $2 AND LOWER(status) = 'active'`,
        [eventId, patientId]
      );
    },

    updateLocation(eventId, patientId, latitude, longitude, accuracy) {
      return query(
        `UPDATE sos_events
         SET latitude = $1, longitude = $2, accuracy = $3, last_location_at = UTC_TIMESTAMP()
         WHERE id = $4 AND patient_id = $5 AND LOWER(status) = 'active'`,
        [latitude, longitude, accuracy, eventId, patientId]
      );
    },

    async getSOSHistory(patientId, limit) {
      return (await query(
        `${selectEvent}
         WHERE patient_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [patientId, limit]
      )).rows;
    }
  };
}
