import { createHash, randomBytes } from "node:crypto";
export class InvalidFamilyInvitationError extends Error {}
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const hash=(value)=>createHash("sha256").update(String(value ?? "")).digest("hex");
const hashIp=(ip, salt="")=>createHash("sha256").update(`${salt}:${String(ip ?? "")}`).digest("hex");
const normalizedEmail=(email)=>String(email ?? "").trim().toLowerCase();

export function createFamilyInvitationService(invites, groups, members, { ipHashSalt = process.env.FAMILY_INVITE_IP_HASH_SALT ?? "", now = () => new Date() } = {}) {
  return {
    async createInvite(patientId,email,{expiresAt=new Date(Date.now()+86400000)}={}) {
      const group=await groups.findGroupByPatient(patientId); if(!group) throw new InvalidFamilyInvitationError("FAMILY_NOT_FOUND");
      const code=randomBytes(24).toString("hex"); await invites.create(patientId,String(email).toLowerCase(),hash(code),expiresAt); return { code, expiresAt };
    },
    async acceptInvite(email, code, userId, { ip } = {}) {
      const inviteCodeHash = hash(code);
      const targetUserId = String(userId);
      const ipHash = hashIp(ip, ipHashSalt);
      const record = async (result) => invites.recordAcceptAttempt({ inviteCodeHash, targetUserId, ipHash, result });
      const recentFailures = await invites.countRecentFailedAttempts({
        inviteCodeHash,
        targetUserId,
        ipHash,
        since: new Date(now().getTime() - ATTEMPT_WINDOW_MS)
      });
      if (recentFailures >= MAX_FAILED_ATTEMPTS) {
        await record("throttled");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }

      const invite = await invites.findByHash(inviteCodeHash);
      if (!invite) {
        await record("invalid");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }
      if (normalizedEmail(invite.email) !== normalizedEmail(email)) {
        await record("wrong_email");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }
      if (new Date(invite.expires_at) <= now()) {
        await record("expired");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }
      if (invite.status !== "pending") {
        await record("reused");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }
      if (String(invite.patient_user_id) === targetUserId) {
        await record("invalid");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }

      const group = await groups.findGroupByPatient(invite.patient_user_id);
      if (!group) {
        await record("invalid");
        throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      }
      await members.addMember(group.id, userId, "caregiver");
      await invites.accept(invite.id);
      await record("accepted");
      return group;
    },
    rejectInvite: (inviteId,patientId) => invites.reject(inviteId,patientId)
  };
}
