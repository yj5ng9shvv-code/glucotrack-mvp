const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function normalizeMimeType(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .split(";")[0];
}

function hasBytes(buffer, offset, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer, offset, value) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + value.length) {
    return false;
  }
  return buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

function hasIsoBmffBrand(buffer, brands) {
  if (!hasAscii(buffer, 4, "ftyp")) return false;
  const brandText = buffer.subarray(8, Math.min(buffer.length, 32)).toString("ascii");
  return brands.some((brand) => brandText.includes(brand));
}

function hasJpegSignature(buffer) {
  return hasBytes(buffer, 0, [0xff, 0xd8, 0xff]);
}

function hasPngSignature(buffer) {
  return hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function hasWebpSignature(buffer) {
  return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP");
}

function hasHeifSignature(buffer) {
  return hasIsoBmffBrand(buffer, ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
}

function hasOggSignature(buffer) {
  return hasAscii(buffer, 0, "OggS");
}

function hasMp3Signature(buffer) {
  return hasAscii(buffer, 0, "ID3")
    || hasBytes(buffer, 0, [0xff, 0xfb])
    || hasBytes(buffer, 0, [0xff, 0xf3])
    || hasBytes(buffer, 0, [0xff, 0xf2]);
}

function hasWavSignature(buffer) {
  return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WAVE");
}

function hasWebmSignature(buffer) {
  return hasBytes(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3]);
}

function hasMp4Signature(buffer) {
  return hasIsoBmffBrand(buffer, ["M4A", "M4B", "mp41", "mp42", "isom", "iso2"]);
}

export function isAllowedAudioMime(value) {
  return ALLOWED_AUDIO_TYPES.has(normalizeMimeType(value));
}

export function isAllowedImageMime(value) {
  return ALLOWED_IMAGE_TYPES.has(normalizeMimeType(value));
}

export function isAllowedAudioUpload(value, buffer) {
  const mimeType = normalizeMimeType(value);
  if (!ALLOWED_AUDIO_TYPES.has(mimeType)) return false;
  if (mimeType === "audio/webm") return hasWebmSignature(buffer);
  if (mimeType === "audio/ogg") return hasOggSignature(buffer);
  if (mimeType === "audio/mpeg") return hasMp3Signature(buffer);
  if (mimeType === "audio/mp4") return hasMp4Signature(buffer);
  if (["audio/wav", "audio/x-wav", "audio/wave"].includes(mimeType)) return hasWavSignature(buffer);
  return false;
}

export function isAllowedImageUpload(value, buffer) {
  const mimeType = normalizeMimeType(value);
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return false;
  if (["image/jpeg", "image/jpg"].includes(mimeType)) return hasJpegSignature(buffer);
  if (mimeType === "image/png") return hasPngSignature(buffer);
  if (mimeType === "image/webp") return hasWebpSignature(buffer);
  if (["image/heic", "image/heif"].includes(mimeType)) return hasHeifSignature(buffer);
  return false;
}
