import express from "express";
import { FamilyAccessDeniedError } from "../services/familyService.js";
import { InvalidFamilyInvitationError } from "../services/familyInvitationService.js";

export function createFamilyRouter({ familyService, memberService, invitationService }) {
  const router = express.Router();
  router.post("/create", asyncHandler(async (req,res)=>res.status(201).json(await familyService.createFamily(req.user.id))));
  router.get("/", asyncHandler(async (req,res)=>res.json(await familyService.getFamily(req.user.id))));
  router.get("/members", asyncHandler(async (req,res)=>{const family=await familyService.getFamily(req.user.id);res.json(await memberService.getMembers(family.id));}));
  router.post("/invite", asyncHandler(async (req,res)=>res.status(201).json(await invitationService.createInvite(req.user.id,req.body?.email))));
  router.post("/invite/accept", asyncHandler(async (req,res)=>res.json(await invitationService.acceptInvite(req.user.email,req.body?.code,req.user.id,{ ip: req.ip }))));
  router.delete("/member/:id", asyncHandler(async (req,res)=>{
    const family=await familyService.getFamily(req.user.id);
    if(String(family.patient_user_id)!==String(req.user.id)) return sendForbidden(res);
    await memberService.removeMember(family.id,req.params.id);
    res.status(204).end();
  }));
  router.use((error, _req, res, next) => {
    if (error instanceof FamilyAccessDeniedError) return sendForbidden(res);
    if (error instanceof InvalidFamilyInvitationError) return sendInvitationUnavailable(res);
    next(error);
  });
  return router;
}
function asyncHandler(handler){return (req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);}
function sendForbidden(res){return res.status(403).type("application/json").send('{"error":"forbidden"}');}
function sendInvitationUnavailable(res){return res.status(400).type("application/json").send('{"error":"invitation unavailable"}');}
