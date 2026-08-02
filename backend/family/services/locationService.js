export class LocationAccessDeniedError extends Error {}
export class LocationValidationError extends Error {}

const MAX_HISTORY_DAYS = 30;
const MAX_HISTORY_LIMIT = 500;

export function createLocationService({ familyRepository, permissionRepository, locationRepository }) {
  const requireAuthenticated = (requesterId) => {
    if (requesterId === null || requesterId === undefined || requesterId === "") {
      throw new LocationAccessDeniedError("FORBIDDEN");
    }
  };

  const isSameUser = (left, right) => String(left) === String(right);

  const activeFamily = async (patientId) => {
    const family = await familyRepository.findGroupByPatient(patientId);
    if (!family || family.status !== "active") throw new LocationAccessDeniedError("FORBIDDEN");
    return family;
  };

  const caregiverMember = async (patientId, caregiverId, { activeOnly = true } = {}) => {
    const family = await activeFamily(patientId);
    const member = (await familyRepository.members(family.id)).find((candidate) =>
      isSameUser(candidate.user_id, caregiverId) &&
      candidate.role === "caregiver" &&
      (!activeOnly || candidate.status === "active")
    );
    if (!member) throw new LocationAccessDeniedError("FORBIDDEN");
    return member;
  };

  const authorizeView = async (requesterId, patientId) => {
    requireAuthenticated(requesterId);
    if (isSameUser(requesterId, patientId)) return null;

    const member = await caregiverMember(patientId, requesterId);
    const permissions = await permissionRepository.get(member.id);
    if (!permissions?.can_view_location) throw new LocationAccessDeniedError("FORBIDDEN");

    const grant = await locationRepository.findActiveLocationGrant(patientId, member.id);
    if (!grant) throw new LocationAccessDeniedError("FORBIDDEN");
    return member;
  };

  const assertCoordinates = ({ latitude, longitude, accuracy = null, batteryLevel = null, deviceId = null }) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const locationAccuracy = accuracy === null || accuracy === undefined ? null : Number(accuracy);
    const battery = batteryLevel === null || batteryLevel === undefined ? null : Number(batteryLevel);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new LocationValidationError("INVALID_COORDINATES");
    }
    if (locationAccuracy !== null && (!Number.isFinite(locationAccuracy) || locationAccuracy < 0)) {
      throw new LocationValidationError("INVALID_ACCURACY");
    }
    if (battery !== null && (!Number.isInteger(battery) || battery < 0 || battery > 100)) {
      throw new LocationValidationError("INVALID_BATTERY_LEVEL");
    }
    if (deviceId !== null && (typeof deviceId !== "string" || deviceId.length > 128)) {
      throw new LocationValidationError("INVALID_DEVICE_ID");
    }
    return { latitude: lat, longitude: lng, accuracy: locationAccuracy, batteryLevel: battery, deviceId };
  };

  const assertHistoryRange = (from, to, limit) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const parsedLimit = Number(limit);
    if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf()) || fromDate > toDate) {
      throw new LocationValidationError("INVALID_HISTORY_RANGE");
    }
    if (toDate - fromDate > MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000) {
      throw new LocationValidationError("HISTORY_RANGE_TOO_LARGE");
    }
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_HISTORY_LIMIT) {
      throw new LocationValidationError("INVALID_HISTORY_LIMIT");
    }
    return { from: fromDate, to: toDate, limit: parsedLimit };
  };

  const assertExpiry = (expiresAt) => {
    if (expiresAt === null || expiresAt === undefined) return null;
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.valueOf()) || parsed <= new Date()) {
      throw new LocationValidationError("INVALID_GRANT_EXPIRY");
    }
    return parsed;
  };

  const audit = (patientId, caregiverId, action, context = {}) =>
    locationRepository.createAccessLog(patientId, caregiverId, action, context.ip ?? null, context.deviceId ?? null);

  return {
    async updatePatientLocation(requesterId, patientId, payload) {
      requireAuthenticated(requesterId);
      if (!isSameUser(requesterId, patientId)) throw new LocationAccessDeniedError("FORBIDDEN");
      const location = assertCoordinates(payload ?? {});
      return locationRepository.createLocationUpdate(
        patientId,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.batteryLevel,
        location.deviceId
      );
    },

    async getPatientCurrentLocation(requesterId, patientId, context = {}) {
      const member = await authorizeView(requesterId, patientId);
      const location = await locationRepository.getCurrentLocation(patientId);
      await audit(patientId, member?.user_id ?? null, "VIEW_CURRENT", context);
      return location;
    },

    async getPatientLocationHistory(requesterId, patientId, from, to, limit, context = {}) {
      const member = await authorizeView(requesterId, patientId);
      const range = assertHistoryRange(from, to, limit);
      const history = await locationRepository.getLocationHistory(patientId, range.from, range.to, range.limit);
      await audit(patientId, member?.user_id ?? null, "VIEW_HISTORY", context);
      return history;
    },

    async grantLocationAccess(requesterId, caregiverId, { expiresAt = null, ip = null, deviceId = null } = {}) {
      requireAuthenticated(requesterId);
      const family = await activeFamily(requesterId);
      if (!isSameUser(family.patient_user_id, requesterId)) throw new LocationAccessDeniedError("FORBIDDEN");
      const member = await caregiverMember(requesterId, caregiverId);
      const permissions = await permissionRepository.get(member.id);
      if (!permissions?.can_view_location) throw new LocationAccessDeniedError("FORBIDDEN");
      const result = await locationRepository.grantLocationAccess(requesterId, member.id, assertExpiry(expiresAt));
      await audit(requesterId, member.user_id, "GRANT", { ip, deviceId });
      return result;
    },

    async revokeLocationAccess(requesterId, caregiverId, { ip = null, deviceId = null } = {}) {
      requireAuthenticated(requesterId);
      const family = await activeFamily(requesterId);
      if (!isSameUser(family.patient_user_id, requesterId)) throw new LocationAccessDeniedError("FORBIDDEN");
      const member = await caregiverMember(requesterId, caregiverId, { activeOnly: false });
      const result = await locationRepository.revokeLocationAccess(requesterId, member.id);
      await audit(requesterId, member.user_id, "REVOKE", { ip, deviceId });
      return result;
    }
  };
}
