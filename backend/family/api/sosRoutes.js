import express from "express";
import {
  SosAccessDeniedError,
  SosConflictError,
  SosValidationError
} from "../services/sosService.js";

export function createSosRouter({ sosService }) {
  const router = express.Router();

  router.post("/create", asyncHandler(async (req, res) => {
    const event = await sosService.createSOS(req.user.id, req.user.id, {
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      accuracy: req.body?.accuracy
    });
    res.status(201).json(toResponse(event));
  }));

  router.post("/cancel/:id", asyncHandler(async (req, res) => {
    const event = await sosService.cancelSOS(req.user.id, req.params.id);
    res.json(toResponse(event));
  }));

  router.post("/resolve/:id", asyncHandler(async (req, res) => {
    const event = await sosService.resolveSOS(req.user.id, req.params.id);
    res.json(toResponse(event));
  }));

  router.get("/active/:patientId", asyncHandler(async (req, res) => {
    const event = await sosService.getActiveSOS(req.user.id, req.params.patientId);
    res.json({ sos: event ? toResponse(event) : null });
  }));

  router.get("/history/:patientId", asyncHandler(async (req, res) => {
    const events = await sosService.getSOSHistory(req.user.id, req.params.patientId, req.query.limit);
    res.json({ sos_events: events.map(toResponse) });
  }));

  router.use((error, _req, res, next) => {
    if (error instanceof SosAccessDeniedError) return res.status(403).json({ error: "forbidden" });
    if (error instanceof SosValidationError) return res.status(400).json({ error: "invalid sos request" });
    if (error instanceof SosConflictError) return res.status(409).json({ error: "sos conflict" });
    next(error);
  });

  return router;
}

function toResponse(event) {
  return {
    sos_id: String(event.id),
    patient_id: String(event.patient_id),
    status: event.status,
    latitude: event.latitude,
    longitude: event.longitude,
    accuracy: event.accuracy,
    created_at: event.created_at,
    cancelled_at: event.cancelled_at,
    resolved_at: event.resolved_at
  };
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
