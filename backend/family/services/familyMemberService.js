import { assertFamilyRole } from "../validators/familyValidator.js";

export class DuplicateFamilyMemberError extends Error {}
export class FamilyMemberNotFoundError extends Error {}

export function createFamilyMemberService(repository) {
  return {
    async addMember(familyId, userId, role) {
      const normalizedRole = assertFamilyRole(role);
      const members = await repository.members(familyId);
      if (members.some((member) => String(member.user_id) === String(userId) && member.status !== "revoked")) {
        throw new DuplicateFamilyMemberError("FAMILY_MEMBER_EXISTS");
      }
      return repository.addMember(familyId, userId, normalizedRole);
    },
    async removeMember(familyId, memberId) {
      const result = await repository.revokeMember(familyId, memberId);
      if (!result.rowCount) throw new FamilyMemberNotFoundError("FAMILY_MEMBER_NOT_FOUND");
      return result;
    },
    getMembers: (familyId) => repository.members(familyId)
  };
}
