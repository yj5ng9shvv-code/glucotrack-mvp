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
      const normalizedData = normalizeData(data);
      const idempotencyKey = normalizedData.idempotency_key || normalizedData.event_id;
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: normalizedData,
          android: {
            priority: "high",
            notification: {
              channelId: normalizedData.android_channel_id || "glukotrack_sos_alarm_v1",
              sound: "default",
              defaultVibrateTimings: true,
              priority: "max",
              visibility: "public",
              tag: idempotencyKey
            }
          },
          apns: {
            headers: {
              "apns-push-type": "alert",
              "apns-priority": "10",
              "apns-collapse-id": normalizedData.apns_collapse_id || idempotencyKey
            },
            payload: {
              aps: {
                sound: "default",
                badge: 1,
                "thread-id": normalizedData.apns_thread_id || "glukotrack-sos"
              }
            }
          }
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
