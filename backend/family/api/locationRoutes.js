import express from "express";
import { LocationAccessDeniedError, LocationValidationError } from "../services/locationService.js";

export function createLocationRouter({ locationService }) {
  const router = express.Router();

  router.post("/update", asyncHandler(async (req, res) => {
    await locationService.updatePatientLocation(req.user.id, req.user.id, {
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      accuracy: req.body?.accuracy,
      batteryLevel: req.body?.battery_level,
      deviceId: req.body?.device_id
    });
    res.status(201).json({ ok: true });
  }));

  router.get("/current/:patientId", asyncHandler(async (req, res) => {
    const location = await locationService.getPatientCurrentLocation(req.user.id, req.params.patientId, requestContext(req));
    res.json({ location });
  }));

  router.get("/history/:patientId", asyncHandler(async (req, res) => {
    const locations = await locationService.getPatientLocationHistory(
      req.user.id,
      req.params.patientId,
      req.query.from,
      req.query.to,
      req.query.limit,
      requestContext(req)
    );
    res.json({ locations });
  }));

  router.post("/grant", asyncHandler(async (req, res) => {
    await locationService.grantLocationAccess(req.user.id, req.body?.caregiver_id, {
      expiresAt: req.body?.expires_at,
      ...requestContext(req)
    });
    res.status(201).json({ ok: true });
  }));

  router.delete("/revoke/:caregiverId", asyncHandler(async (req, res) => {
    await locationService.revokeLocationAccess(req.user.id, req.params.caregiverId, requestContext(req));
    res.status(204).end();
  }));

  router.use((error, _req, res, next) => {
    if (error instanceof LocationAccessDeniedError) return res.status(403).json({ error: "forbidden" });
    if (error instanceof LocationValidationError) return res.status(400).json({ error: "invalid location request" });
    next(error);
  });

  return router;
}

function requestContext(req) {
  return {
    ip: req.ip,
    deviceId: typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : null
  };
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
