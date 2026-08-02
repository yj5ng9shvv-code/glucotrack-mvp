import { createHash, randomBytes } from "node:crypto";
export class InvalidFamilyInvitationError extends Error {}
const hash=(code)=>createHash("sha256").update(code).digest("hex");
export function createFamilyInvitationService(invites, groups, members) {
  return {
    async createInvite(patientId,email,{expiresAt=new Date(Date.now()+86400000)}={}) {
      const group=await groups.findGroupByPatient(patientId); if(!group) throw new InvalidFamilyInvitationError("FAMILY_NOT_FOUND");
      const code=randomBytes(24).toString("hex"); await invites.create(patientId,String(email).toLowerCase(),hash(code),expiresAt); return { code, expiresAt };
    },
    async acceptInvite(email,code,userId) {
      const invite=await invites.findPending(hash(code),String(email).toLowerCase());
      if(!invite || new Date(invite.expires_at)<=new Date() || String(invite.patient_user_id)===String(userId)) throw new InvalidFamilyInvitationError("INVALID_INVITATION");
      const group=await groups.findGroupByPatient(invite.patient_user_id); await members.addMember(group.id,userId,"caregiver"); await invites.accept(invite.id); return group;
    },
    rejectInvite: (inviteId,patientId) => invites.reject(inviteId,patientId)
  };
}
