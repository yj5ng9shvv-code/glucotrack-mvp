import {
  PushProviderConfigError,
  PushProviderError,
  PushProviderErrorCode,
  normalizeData
} from "./pushProvider.js";

const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered"
]);
const temporaryCodes = new Set([
  "messaging/internal-error",
  "messaging/server-unavailable",
  "messaging/quota-exceeded",
  "messaging/message-rate-exceeded",
  "messaging/device-message-rate-exceeded"
]);

export async function createFcmPushProvider({
  projectId = process.env.FCM_PROJECT_ID,
  privateKey = process.env.FCM_PRIVATE_KEY,
  clientEmail = process.env.FCM_CLIENT_EMAIL,
  adminModule
} = {}) {
  if (!projectId || !privateKey || !clientEmail) {
    throw new PushProviderConfigError("fcm");
  }
  const firebaseAdmin = normalizeAdmin(adminModule ?? await import("firebase-admin"));
  const appName = `glucotrack-fcm-${projectId}`;
  const app = firebaseAdmin.apps?.find((item) => item.name === appName) ??
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n")
      })
    }, appName);
  const messaging = firebaseAdmin.messaging(app);

  return {
    name: "fcm",
    async send({ token, title, body, data }) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: normalizeData(data),
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } }
        });
      } catch (error) {
        throw mapFcmError(error);
      }
    }
  };
}

export function mapFcmError(error) {
  const code = error?.code;
  if (invalidTokenCodes.has(code)) {
    return new PushProviderError(PushProviderErrorCode.tokenInvalid, "FCM token is invalid");
  }
  if (temporaryCodes.has(code)) {
    return new PushProviderError(PushProviderErrorCode.temporary, "FCM delivery is temporarily unavailable");
  }
  return new PushProviderError(PushProviderErrorCode.temporary, "FCM delivery failed");
}

function normalizeAdmin(module) {
  return module?.default ?? module;
}
