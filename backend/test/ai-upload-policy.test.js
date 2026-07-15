import test from "node:test";
import assert from "node:assert/strict";

import {
  isAllowedAudioMime,
  isAllowedAudioUpload,
  isAllowedImageMime,
  isAllowedImageUpload,
} from "../ai-upload-policy.js";

test("accepts supported audio upload mime types", () => {
  assert.equal(isAllowedAudioMime("audio/webm"), true);
  assert.equal(isAllowedAudioMime("audio/ogg; charset=utf-8"), true);
  assert.equal(isAllowedAudioMime("audio/mp4"), true);
  assert.equal(isAllowedAudioMime("audio/wav"), true);
});

test("rejects unsupported audio upload mime types", () => {
  assert.equal(isAllowedAudioMime("video/mp4"), false);
  assert.equal(isAllowedAudioMime("text/plain"), false);
  assert.equal(isAllowedAudioMime(""), false);
});

test("accepts supported image upload mime types", () => {
  assert.equal(isAllowedImageMime("image/jpeg"), true);
  assert.equal(isAllowedImageMime("image/png; charset=utf-8"), true);
  assert.equal(isAllowedImageMime("image/webp"), true);
  assert.equal(isAllowedImageMime("image/heic"), true);
});

test("rejects unsupported image upload mime types", () => {
  assert.equal(isAllowedImageMime("image/gif"), false);
  assert.equal(isAllowedImageMime("application/pdf"), false);
  assert.equal(isAllowedImageMime(""), false);
});

test("accepts image uploads only when mime and file signature match", () => {
  assert.equal(isAllowedImageUpload("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(isAllowedImageUpload("image/png", Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])), true);
  assert.equal(isAllowedImageUpload("image/webp", Buffer.from("RIFFxxxxWEBP", "ascii")), true);
  assert.equal(isAllowedImageUpload("image/heic", Buffer.from("xxxxftypheic", "ascii")), true);
});

test("rejects spoofed image uploads with allowed mime but invalid signature", () => {
  assert.equal(isAllowedImageUpload("image/jpeg", Buffer.from("<script>alert(1)</script>")), false);
  assert.equal(isAllowedImageUpload("image/png", Buffer.from([0xff, 0xd8, 0xff, 0xe0])), false);
});

test("accepts audio uploads only when mime and file signature match", () => {
  assert.equal(isAllowedAudioUpload("audio/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), true);
  assert.equal(isAllowedAudioUpload("audio/ogg", Buffer.from("OggSxxxx", "ascii")), true);
  assert.equal(isAllowedAudioUpload("audio/mpeg", Buffer.from("ID3xxxx", "ascii")), true);
  assert.equal(isAllowedAudioUpload("audio/wav", Buffer.from("RIFFxxxxWAVE", "ascii")), true);
  assert.equal(isAllowedAudioUpload("audio/mp4", Buffer.from("xxxxftypM4A ", "ascii")), true);
});

test("rejects spoofed audio uploads with allowed mime but invalid signature", () => {
  assert.equal(isAllowedAudioUpload("audio/webm", Buffer.from("not webm")), false);
  assert.equal(isAllowedAudioUpload("audio/ogg", Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), false);
});
