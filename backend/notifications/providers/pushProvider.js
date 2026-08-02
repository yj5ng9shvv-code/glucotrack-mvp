export class PushProviderConfigError extends Error {
  constructor(provider, message = "push provider is not configured") {
    super(message);
    this.name = "PushProviderConfigError";
    this.provider = provider;
  }
}

export class PushProviderError extends Error {
  constructor(code, message = "push delivery failed") {
    super(message);
    this.name = "PushProviderError";
    this.code = code;
  }
}

export const PushProviderErrorCode = Object.freeze({
  tokenInvalid: "TOKEN_INVALID",
  temporary: "TEMP_ERROR"
});

export function normalizeData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)])
  );
}
