import {
  PushProviderConfigError,
  PushProviderError,
  PushProviderErrorCode,
  normalizeData
} from "./pushProvider.js";

const invalidTokenReasons = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered"
]);
const temporaryReasons = new Set([
  "TooManyRequests",
  "InternalServerError",
  "ServiceUnavailable",
  "Shutdown"
]);

export async function createApnsPushProvider({
  keyId = process.env.APNS_KEY_ID,
  teamId = process.env.APNS_TEAM_ID,
  bundleId = process.env.APNS_BUNDLE_ID,
  privateKey = process.env.APNS_PRIVATE_KEY,
  production = process.env.APNS_PRODUCTION === "true",
  apnModule
} = {}) {
  if (!keyId || !teamId || !bundleId || !privateKey) {
    throw new PushProviderConfigError("apns");
  }
  const apn = normalizeApn(apnModule ?? await import("apn"));
  const client = new apn.Provider({
    token: { key: privateKey.replace(/\\n/g, "\n"), keyId, teamId },
    production
  });

  return {
    name: "apns",
    async send({ token, title, body, data }) {
      const notification = new apn.Notification();
      notification.topic = bundleId;
      notification.alert = { title, body };
      notification.sound = "default";
      notification.payload = normalizeData(data);
      try {
        const result = await client.send(notification, token);
        if (result.sent?.length) return;
        throw mapApnsFailure(result.failed?.[0]);
      } catch (error) {
        if (error instanceof PushProviderError) throw error;
        throw new PushProviderError(PushProviderErrorCode.temporary, "APNs delivery failed");
      }
    }
  };
}

export function mapApnsFailure(failure) {
  const reason = failure?.response?.reason ?? failure?.status ?? "unknown";
  if (invalidTokenReasons.has(reason)) {
    return new PushProviderError(PushProviderErrorCode.tokenInvalid, "APNs token is invalid");
  }
  if (temporaryReasons.has(reason)) {
    return new PushProviderError(PushProviderErrorCode.temporary, "APNs delivery is temporarily unavailable");
  }
  return new PushProviderError(PushProviderErrorCode.temporary, "APNs delivery failed");
}

function normalizeApn(module) {
  return module?.default ?? module;
}
