import express from "express";
import {
  PushDeviceTokenAccessError,
  PushDeviceTokenConflictError,
  PushDeviceTokenValidationError
} from "../services/pushDeviceTokenService.js";
import { PushTokenEncryptionConfigError } from "../services/pushTokenCrypto.js";

export function createPushDeviceRouter({ pushDeviceTokenService }) {
  const router = express.Router();

  router.post("/register", asyncHandler(async (req, res) => {
    const device = await pushDeviceTokenService.register(req.user.id, req.body);
    res.status(201).json({ device });
  }));

  router.post("/unregister", asyncHandler(async (req, res) => {
    const device = await pushDeviceTokenService.unregister(req.user.id, req.body);
    res.json({ ok: true, device });
  }));

  router.use((error, _req, res, next) => {
    if (error instanceof PushDeviceTokenValidationError) {
      return res.status(400).json({ error: "invalid push device request" });
    }
    if (error instanceof PushDeviceTokenAccessError) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (error instanceof PushDeviceTokenConflictError) {
      return res.status(409).json({ error: "push token already registered" });
    }
    if (error instanceof PushTokenEncryptionConfigError) {
      return res.status(503).json({ error: "push registration unavailable" });
    }
    next(error);
  });

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
