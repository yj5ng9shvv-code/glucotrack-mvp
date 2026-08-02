import { hashPushToken } from "./pushTokenCrypto.js";

const PLATFORM_VALUES = new Set(["android", "ios"]);

export class PushDeviceTokenValidationError extends Error {
  constructor() {
    super("invalid push device request");
    this.name = "PushDeviceTokenValidationError";
  }
}

export class PushDeviceTokenAccessError extends Error {
  constructor() {
    super("forbidden");
    this.name = "PushDeviceTokenAccessError";
  }
}

export class PushDeviceTokenConflictError extends Error {
  constructor() {
    super("push token already registered");
    this.name = "PushDeviceTokenConflictError";
  }
}

export function createPushDeviceTokenService({ repository, tokenCipher }) {
  const normalizeDeviceId = (value) => String(value ?? "").trim();
  const normalizePlatform = (value) => String(value ?? "").trim().toLowerCase();
  const normalizeToken = (value) => String(value ?? "").trim();

  async function ownedDevice(userId, deviceId) {
    const row = await repository.findOwnedActiveDevice(userId, deviceId);
    if (!row) throw new PushDeviceTokenAccessError();
    return row;
  }

  return {
    async register(userId, payload) {
      const deviceId = normalizeDeviceId(payload?.device_id);
      const platform = normalizePlatform(payload?.platform);
      const rawToken = normalizeToken(payload?.push_token);
      if (deviceId.length < 8 || deviceId.length > 128 ||
          !PLATFORM_VALUES.has(platform) || rawToken.length < 20 || rawToken.length > 4096) {
        throw new PushDeviceTokenValidationError();
      }

      const device = await ownedDevice(userId, deviceId);
      if (String(device.platform ?? "").toLowerCase() !== platform) {
        throw new PushDeviceTokenValidationError();
      }
      const tokenHash = hashPushToken(rawToken);
      const existing = await repository.findActiveDeviceByTokenHash(tokenHash);
      if (existing && String(existing.id) !== String(device.id)) {
        // Do not detach or overwrite another device based only on a submitted
        // provider token. The caller receives no owner/device information.
        throw new PushDeviceTokenConflictError();
      }

      const encryptedToken = tokenCipher.encrypt(rawToken);
      const stored = await repository.storePushToken({
        deviceRowId: device.id,
        tokenHash,
        encryptedToken
      });
      if (!stored.rowCount) throw new PushDeviceTokenAccessError();
      return { device_id: device.device_id, platform };
    },

    async unregister(userId, payload) {
      const deviceId = normalizeDeviceId(payload?.device_id);
      if (deviceId.length < 8 || deviceId.length > 128) {
        throw new PushDeviceTokenValidationError();
      }
      const device = await ownedDevice(userId, deviceId);
      const revoked = await repository.revokePushToken(device.id);
      if (!revoked.rowCount) throw new PushDeviceTokenAccessError();
      return { device_id: device.device_id };
    }
  };
}
