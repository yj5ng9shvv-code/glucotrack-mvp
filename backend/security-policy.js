import { createHash } from "node:crypto";

const DEVICE_ID_RE = /^[A-Za-z0-9:_-]{16,128}$/;
const DEVICE_FINGERPRINT_RE = /^[A-Za-z0-9:_-]{8,512}$/;
const DEVICE_PLATFORMS = new Set(["android", "ios", "macos", "windows", "linux", "web"]);

export function isValidDeviceIdentity({ id, name, platform, fingerprint } = {}) {
  return DEVICE_ID_RE.test(id ?? "") &&
    typeof name === "string" && name.length > 0 && name.length <= 120 &&
    !/[\x00-\x1f\x7f]/.test(name) &&
    DEVICE_PLATFORMS.has(platform) &&
    DEVICE_FINGERPRINT_RE.test(fingerprint ?? "");
}

export function sanitizeDeviceIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = cleanText(value.id, 128);
  const name = cleanText(value.name, 120);
  const platform = cleanText(value.platform, 32).toLowerCase();
  const fingerprint = normalizeFingerprint(cleanText(value.fingerprint, 512), platform);
  const candidate = { id, name, platform, fingerprint };
  return isValidDeviceIdentity(candidate) ? candidate : null;
}

export function deviceFingerprintHash(userId, device) {
  if (!Number.isInteger(Number(userId))) return null;
  if (!isValidDeviceIdentity(device)) return null;
  const safePlatform = cleanText(device.platform, 32).toLowerCase();
  const safeName = cleanText(device.name, 120) || "Unknown device";
  const safeFingerprint = cleanText(device.fingerprint, 512);
  return createHash("sha256")
    .update(`${userId}|${safePlatform}|${safeName}|${safeFingerprint}`)
    .digest("hex");
}

export function isMatchingRefreshDevice(userId, requestDevice, tokenData) {
  const normalized = sanitizeDeviceIdentity(requestDevice);
  if (!normalized || !tokenData) return false;
  const requestFingerprint = deviceFingerprintHash(userId, normalized);
  const tokenDeviceId = cleanText(tokenData.device_id, 128);
  const tokenFingerprint = tokenData.fingerprint_hash ? String(tokenData.fingerprint_hash) : "";
  if (tokenDeviceId && normalized.id === tokenDeviceId) return true;
  if (tokenFingerprint && requestFingerprint && requestFingerprint === tokenFingerprint) return true;
  return false;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeFingerprint(fingerprint, platform) {
  const normalized = cleanText(fingerprint, 512);
  if (!normalized) return "";
  if (platform !== "web") return normalized;
  if (DEVICE_FINGERPRINT_RE.test(normalized)) return normalized;
  return createHash("sha256").update(normalized).digest("hex");
}
