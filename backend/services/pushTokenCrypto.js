import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class PushTokenEncryptionConfigError extends Error {
  constructor() {
    super("PUSH_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes");
    this.name = "PushTokenEncryptionConfigError";
  }
}

export function hashPushToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPushTokenCipher(encryptionKey) {
  const key = Buffer.from(String(encryptionKey ?? ""), "base64");
  if (key.length !== 32) throw new PushTokenEncryptionConfigError();

  return {
    encrypt(token) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
    },

    decrypt(value) {
      const [version, ivBase64, tagBase64, ciphertextBase64, ...extra] = String(value ?? "").split(".");
      if (version !== VERSION || extra.length || !ivBase64 || !tagBase64 || !ciphertextBase64) {
        throw new Error("INVALID_ENCRYPTED_PUSH_TOKEN");
      }
      const iv = Buffer.from(ivBase64, "base64");
      const tag = Buffer.from(tagBase64, "base64");
      const ciphertext = Buffer.from(ciphertextBase64, "base64");
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || !ciphertext.length) {
        throw new Error("INVALID_ENCRYPTED_PUSH_TOKEN");
      }
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    }
  };
}
