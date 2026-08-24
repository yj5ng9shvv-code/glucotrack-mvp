import assert from "node:assert/strict";
import test from "node:test";

import { createApnsPushProvider } from "../notifications/providers/apnsPushProvider.js";
import { createFcmPushProvider } from "../notifications/providers/fcmPushProvider.js";
import { PushProviderErrorCode } from "../notifications/providers/pushProvider.js";
import { createPushTokenCipher } from "../services/pushTokenCrypto.js";
import { createPlatformPushProvider } from "../notifications/providers/platformPushProvider.js";

const fcmConfig = {
  projectId: "glucotrack-test",
  clientEmail: "firebase-admin@example.test",
  privateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"
};

test("FCM provider sends a normalized SOS notification", async () => {
  const sent = [];
  const provider = await createFcmPushProvider({
    ...fcmConfig,
    adminModule: fakeFirebaseAdmin({ send: async (message) => sent.push(message) })
  });

  await provider.send({
    token: "fcm-token",
    title: "SOS",
    body: "Open app",
    data: { event_id: 42, type: "family_sos" }
  });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].data, { event_id: "42", type: "family_sos" });
});

test("FCM invalid registration token maps to TOKEN_INVALID", async () => {
  const provider = await createFcmPushProvider({
    ...fcmConfig,
    adminModule: fakeFirebaseAdmin({
      send: async () => {
        const error = new Error("invalid");
        error.code = "messaging/registration-token-not-registered";
        throw error;
      }
    })
  });

  await assert.rejects(
    provider.send({ token: "bad", title: "SOS", body: "Open app", data: {} }),
    (error) => error.code === PushProviderErrorCode.tokenInvalid
  );
});

test("APNs temporary failure maps to TEMP_ERROR", async () => {
  const provider = await createApnsPushProvider({
    keyId: "key-id",
    teamId: "team-id",
    bundleId: "com.example.glucotrack",
    privateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    apnModule: fakeApn({ failed: [{ response: { reason: "ServiceUnavailable" } }] })
  });

  await assert.rejects(
    provider.send({ token: "apns-token", title: "SOS", body: "Open app", data: {} }),
    (error) => error.code === PushProviderErrorCode.temporary
  );
});

test("APNs invalid device token maps to TOKEN_INVALID", async () => {
  const provider = await createApnsPushProvider({
    keyId: "key-id",
    teamId: "team-id",
    bundleId: "com.example.glucotrack",
    privateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    apnModule: fakeApn({ failed: [{ response: { reason: "Unregistered" } }] })
  });

  await assert.rejects(
    provider.send({ token: "stale", title: "SOS", body: "Open app", data: {} }),
    (error) => error.code === PushProviderErrorCode.tokenInvalid
  );
});

test("encrypted device token decrypts only with the configured key", () => {
  const cipher = createPushTokenCipher(Buffer.alloc(32, 9).toString("base64"));
  const encrypted = cipher.encrypt("device-token-secret");
  assert.notEqual(encrypted, "device-token-secret");
  assert.equal(cipher.decrypt(encrypted), "device-token-secret");
});

test("platform router sends Android to FCM and iOS to APNs", async () => {
  const calls = [];
  const provider = createPlatformPushProvider({
    fcmProvider: { send: async (message) => calls.push(["fcm", message.token]) },
    apnsProvider: { send: async (message) => calls.push(["apns", message.token]) }
  });

  await provider.send({ platform: "android", token: "fcm-token" });
  await provider.send({ platform: "ios", token: "a".repeat(64) });

  assert.deepEqual(calls, [["fcm", "fcm-token"], ["apns", "a".repeat(64)]]);
});

function fakeFirebaseAdmin({ send }) {
  const apps = [];
  return {
    apps,
    credential: { cert: (value) => value },
    initializeApp: (config, name) => {
      const app = { config, name };
      apps.push(app);
      return app;
    },
    messaging: () => ({ send })
  };
}

function fakeApn(result) {
  class Notification {}
  class Provider {
    constructor(options) { this.options = options; }
    async send() { return { sent: [], ...result }; }
  }
  return { Provider, Notification };
}
