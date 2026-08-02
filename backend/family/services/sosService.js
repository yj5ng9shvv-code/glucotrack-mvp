export class SosAccessDeniedError extends Error {}
export class SosValidationError extends Error {}
export class SosConflictError extends Error {}

const MAX_HISTORY_LIMIT = 100;

export function createSosService({
  familyRepository,
  permissionRepository,
  sosRepository,
  locationRepository = null,
  notificationService = null
}) {
  const isSameUser = (left, right) => String(left) === String(right);

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

  const ownedActiveEvent = async (requesterId, eventId) => {
    requireAuthenticated(requesterId);
    const event = await sosRepository.getById(eventId);
    if (!event || !isSameUser(event.patient_id, requesterId)) {
      throw new SosAccessDeniedError("FORBIDDEN");
    }
    if (event.status !== "ACTIVE") throw new SosConflictError("SOS_NOT_ACTIVE");
    return event;
  };

  return {
    async createSOS(requesterId, patientId, payload = {}) {
      requirePatientIdentity(requesterId, patientId);
      const existing = await sosRepository.findActiveByPatient(patientId);
      if (existing) throw new SosConflictError("SOS_ALREADY_ACTIVE");
      const location = optionalCoordinates(payload);
      const result = await sosRepository.createSOS(
        patientId,
        location.latitude,
        location.longitude,
        location.accuracy
      );
      const event = await sosRepository.getById(result.insertId);
      if (notificationService && event) {
        await notificationService.createSOSNotifications(requesterId, event.id);
      }
      return event;
    },

    async cancelSOS(requesterId, eventId) {
      const event = await ownedActiveEvent(requesterId, eventId);
      const result = await sosRepository.cancelSOS(event.id, requesterId);
      if (!result.rowCount) throw new SosConflictError("SOS_NOT_ACTIVE");
      return sosRepository.getById(event.id);
    },

    async resolveSOS(requesterId, eventId) {
      const event = await ownedActiveEvent(requesterId, eventId);
      const result = await sosRepository.resolveSOS(event.id, requesterId);
      if (!result.rowCount) throw new SosConflictError("SOS_NOT_ACTIVE");
      return sosRepository.getById(event.id);
    },

    async getActiveSOS(requesterId, patientId) {
      const member = await authorizeView(requesterId, patientId);
      return forViewer(await sosRepository.findActiveByPatient(patientId), requesterId, member);
    },

    async getSOSHistory(requesterId, patientId, limit = 50) {
      const member = await authorizeView(requesterId, patientId);
      const events = await sosRepository.getSOSHistory(patientId, historyLimit(limit));
      return Promise.all(events.map((event) => forViewer(event, requesterId, member)));
    }
  };
}
