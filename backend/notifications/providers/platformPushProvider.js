import { PushProviderError, PushProviderErrorCode } from "./pushProvider.js";

/// Selects the provider only after the worker has decrypted the device token.
export function createPlatformPushProvider({ fcmProvider, apnsProvider }) {
  return {
    name: "platform-router",
    async send(message) {
      const platform = String(message.platform ?? "").toLowerCase();
      if (platform === "android") return fcmProvider.send(message);
      if (platform === "ios") return apnsProvider.send(message);
      throw new PushProviderError(PushProviderErrorCode.tokenInvalid, "unsupported push platform");
    }
  };
}
