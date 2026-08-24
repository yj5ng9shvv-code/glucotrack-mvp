export class SosAccessDeniedError extends Error {}
export class SosValidationError extends Error {}
export class SosConflictError extends Error {}

const MAX_HISTORY_LIMIT = 100;
const SAFE_CLIENT_ID = /^[A-Za-z0-9._:-]{8,64}$/;

export function createSosService({
  familyRepository,
  permissionRepository,
  sosRepository,
  locationRepository = null,
  notificationService = null,
  settingsService = null
}) {
  const isSameUser = (left, right) => String(left) === String(right);

  const settings = async () => settingsService?.effectiveSettings ? settingsService.effectiveSettings() : {};

  const applyLifecycle = async (patientId, activeSettings) => {
    if (activeSettings.sos_auto_close_enabled && sosRepository.autoCloseActive) {
      await sosRepository.autoCloseActive(patientId, activeSettings.sos_auto_close_after_hours);
    }
  };

  const requireAuthenticated = (requesterId) => {
    if (requesterId === null || requesterId === undefined || requesterId === "") {
      throw new SosAccessDeniedError("FORBIDDEN");
    }
  };

  const requirePatientIdentity = (requesterId, patientId) => {
    requireAuthenticated(requesterId);
    if (!isSameUser(requesterId, patientId)) {
      throw new SosAccessDeniedError("FORBIDDEN");
    }
  };

  const activeCaregiverMember = async (patientId, caregiverId) => {
    const family = await familyRepository.findGroupByPatient(patientId);
    if (!family || family.status !== "active") {
      throw new SosAccessDeniedError("FORBIDDEN");
    }
    const member = (await familyRepository.members(family.id)).find((candidate) =>
      isSameUser(candidate.user_id, caregiverId) &&
      candidate.role === "caregiver" &&
      candidate.status === "active"
    );
    if (!member) throw new SosAccessDeniedError("FORBIDDEN");
    const permissions = await permissionRepository.get(member.id);
    if (!permissions?.can_view_sos) throw new SosAccessDeniedError("FORBIDDEN");
    return member;
  };

  const authorizeView = async (requesterId, patientId) => {
    requireAuthenticated(requesterId);
    if (isSameUser(requesterId, patientId)) return null;
    return activeCaregiverMember(patientId, requesterId);
  };

  const forViewer = async (event, requesterId, member) => {
    if (!event || isSameUser(requesterId, event.patient_id)) return event;
    const permissions = await permissionRepository.get(member.id);
    const grant = permissions?.can_view_location && locationRepository
      ? await locationRepository.findActiveLocationGrant(event.patient_id, member.id)
      : null;
    if (grant) return event;
    return { ...event, latitude: null, longitude: null, accuracy: null };
  };

  const optionalCoordinates = (payload = {}) => {
    const hasLatitude = payload.latitude !== null && payload.latitude !== undefined;
    const hasLongitude = payload.longitude !== null && payload.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new SosValidationError("INVALID_COORDINATES");
    }
    if (!hasLatitude) {
      if (payload.accuracy !== null && payload.accuracy !== undefined) {
        throw new SosValidationError("INVALID_ACCURACY");
      }
      return { latitude: null, longitude: null, accuracy: null };
    }
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const accuracy = payload.accuracy === null || payload.accuracy === undefined
      ? null
      : Number(payload.accuracy);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new SosValidationError("INVALID_COORDINATES");
    }
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      throw new SosValidationError("INVALID_ACCURACY");
    }
    return { latitude, longitude, accuracy };
  };

  const historyLimit = (limit = 50) => {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_HISTORY_LIMIT) {
      throw new SosValidationError("INVALID_HISTORY_LIMIT");
    }
    return parsed;
  };

  const clientId = (value, field) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = String(value);
    if (!SAFE_CLIENT_ID.test(parsed)) {
      throw new SosValidationError(`INVALID_${field}`);
    }
    return parsed;
  };

  const ownedEvent = async (requesterId, eventId) => {
    requireAuthenticated(requesterId);
    const event = await sosRepository.getById(eventId);
    if (!event || !isSameUser(event.patient_id, requesterId)) {
      throw new SosAccessDeniedError("FORBIDDEN");
    }
    return event;
  };

  return {
    async getConfig(_requesterId, viewer = "patient") {
      return settingsService?.appConfig ? settingsService.appConfig({ viewer }) : null;
    },

    async createSOS(requesterId, patientId, payload = {}) {
      requirePatientIdentity(requesterId, patientId);
      const activeSettings = await settings();
      await applyLifecycle(patientId, activeSettings);
      if (activeSettings.sos_enabled === false) throw new SosAccessDeniedError("SOS_DISABLED");
      if (activeSettings.sos_show_patient_card === false) throw new SosAccessDeniedError("SOS_PATIENT_CARD_DISABLED");
      const source = payload.source === "automatic" || payload.source === "auto" ? "automatic" : "manual";
      if (source === "automatic" && !["automatic", "both"].includes(activeSettings.sos_activation_mode || "both")) throw new SosAccessDeniedError("SOS_AUTOMATIC_DISABLED");
      if (source === "manual" && !["manual", "both"].includes(activeSettings.sos_activation_mode || "both")) throw new SosAccessDeniedError("SOS_MANUAL_DISABLED");
      if (source === "manual" && Number(activeSettings.notification_manual_sos_cooldown_minutes || 0) > 0 && (sosRepository.countRecentManualByPatient || sosRepository.countRecentByPatient)) {
        const recentManual = await (sosRepository.countRecentManualByPatient || sosRepository.countRecentByPatient)(patientId, Number(activeSettings.notification_manual_sos_cooldown_minutes || 15));
        if (recentManual > 0) throw new SosConflictError("SOS_MANUAL_COOLDOWN");
      }
      if (activeSettings.sos_rate_limit_enabled && sosRepository.countRecentByPatient) {
        const recent = await sosRepository.countRecentByPatient(patientId, activeSettings.sos_rate_limit_window_minutes || 60);
        if (recent >= (activeSettings.sos_rate_limit_count || 5)) throw new SosConflictError("SOS_RATE_LIMIT");
      }
      const clientEventId = clientId(payload.clientEventId ?? payload.client_event_id, "CLIENT_EVENT_ID");
      const clientRequestId = clientId(payload.clientRequestId ?? payload.client_request_id, "CLIENT_REQUEST_ID");
      if (clientEventId) {
        const idempotentEvent = await sosRepository.findByClientEvent(patientId, clientEventId);
        if (idempotentEvent) return idempotentEvent;
      }
      if (activeSettings.sos_merge_duplicate_active && sosRepository.findRecentActiveDuplicate) {
        const duplicate = await sosRepository.findRecentActiveDuplicate(patientId, activeSettings.sos_duplicate_window_seconds || 120);
        if (duplicate) return duplicate;
      }
      const existing = await sosRepository.findActiveByPatient(patientId);
      if (existing) return existing;
      const location = optionalCoordinates(payload);
      const result = await sosRepository.createSOS(
        patientId,
        location.latitude,
        location.longitude,
        location.accuracy,
        {
          clientEventId,
          clientRequestId,
          source
        }
      );
      const event = await sosRepository.getById(result.insertId);
      if (notificationService && event) {
        await notificationService.createSOSNotifications(requesterId, event.id, activeSettings);
      }
      return event;
    },

    async cancelSOS(requesterId, eventId) {
      const activeSettings = await settings();
      if (activeSettings.sos_patient_cancel_enabled === false) throw new SosAccessDeniedError("SOS_CANCEL_DISABLED");
      const event = await ownedEvent(requesterId, eventId);
      if (event.status !== "ACTIVE") return event;
      const result = await sosRepository.cancelSOS(event.id, requesterId);
      if (!result.rowCount) throw new SosConflictError("SOS_NOT_ACTIVE");
      if (notificationService?.cancelPendingForEvent) {
        await notificationService.cancelPendingForEvent(event.id, { reason: "SOS_CANCELLED" });
      }
      return sosRepository.getById(event.id);
    },

    async resolveSOS(requesterId, eventId) {
      const event = await ownedEvent(requesterId, eventId);
      if (event.status !== "ACTIVE") return event;
      const result = await sosRepository.resolveSOS(event.id, requesterId);
      if (!result.rowCount) throw new SosConflictError("SOS_NOT_ACTIVE");
      if (notificationService?.cancelPendingForEvent) {
        await notificationService.cancelPendingForEvent(event.id, { reason: "SOS_RESOLVED" });
      }
      return sosRepository.getById(event.id);
    },

    async updateLocation(requesterId, eventId, payload = {}) {
      const activeSettings = await settings();
      if (activeSettings.sos_enabled === false || activeSettings.sos_request_current_location === false) throw new SosAccessDeniedError("SOS_LOCATION_DISABLED");
      const event = await ownedEvent(requesterId, eventId);
      const location = optionalCoordinates(payload);
      if (event.status !== "ACTIVE") return event;
      const result = await sosRepository.updateLocation(
        event.id,
        requesterId,
        location.latitude,
        location.longitude,
        location.accuracy
      );
      if (!result.rowCount) throw new SosConflictError("SOS_NOT_ACTIVE");
      return sosRepository.getById(event.id);
    },

    async getActiveSOS(requesterId, patientId) {
      const activeSettings = await settings();
      await applyLifecycle(patientId, activeSettings);
      if (activeSettings.sos_enabled === false || activeSettings.sos_show_family_card === false) return null;
      const member = await authorizeView(requesterId, patientId);
      return forViewer(await sosRepository.findActiveByPatient(patientId), requesterId, member);
    },

    async getSOSHistory(requesterId, patientId, limit = 50) {
      const activeSettings = await settings();
      await applyLifecycle(patientId, activeSettings);
      const member = await authorizeView(requesterId, patientId);
      if (isSameUser(requesterId, patientId) && activeSettings.sos_show_history_patient === false) return [];
      if (!isSameUser(requesterId, patientId) && activeSettings.sos_show_history_caregiver === false) return [];
      const events = await sosRepository.getSOSHistory(patientId, historyLimit(limit));
      return Promise.all(events.map((event) => forViewer(event, requesterId, member)));
    }
  };
}