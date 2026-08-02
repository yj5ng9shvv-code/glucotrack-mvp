export class FamilyAccessDeniedError extends Error {}
export function createFamilyService(repository) {
  return {
    async createFamily(patientId) {
      const existing = await repository.findGroupByPatient(patientId);
      if (existing) return existing;
      const created = await repository.createGroup(patientId);
      const group = await repository.findGroupByPatient(patientId);
      await repository.addMember(group.id, patientId, "patient");
      return group ?? created;
    },
    async getFamily(userId) {
      const group = await repository.findGroupByPatient(userId) ?? await repository.findGroupByMember(userId);
      if (group) return group;
      throw new FamilyAccessDeniedError("ACCESS_DENIED");
    }
  };
}
