export function createFamilyRepository(query) {
  return {
    async createGroup(patientUserId) { return query("INSERT INTO family_groups(patient_user_id,status) VALUES($1,'active')", [patientUserId]); },
    async findGroupByPatient(patientUserId) { return (await query("SELECT * FROM family_groups WHERE patient_user_id=$1", [patientUserId])).rows[0] ?? null; },
    async findGroupByMember(userId) { return (await query("SELECT fg.* FROM family_groups fg JOIN family_members fm ON fm.family_group_id=fg.id WHERE fm.user_id=$1 AND fm.status='active'", [userId])).rows[0] ?? null; },
    async deactivateGroup(patientUserId) { return query("UPDATE family_groups SET status='disabled' WHERE patient_user_id=$1", [patientUserId]); },
    async addMember(groupId, userId, role) { return query("INSERT INTO family_members(family_group_id,user_id,role,status) VALUES($1,$2,$3,'active')", [groupId,userId,role]); },
    async members(groupId) { return (await query("SELECT * FROM family_members WHERE family_group_id=$1", [groupId])).rows; },
    async revokeMember(groupId, memberId) { return query("UPDATE family_members SET status='revoked' WHERE id=$1 AND family_group_id=$2", [memberId,groupId]); }
  };
}
