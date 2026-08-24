export function createFamilyRepository(query) {
  return {
    // Keep the legacy owner column populated while the canonical patient column
    // becomes the Family Watch access-control source of truth.
    async createGroup(patientUserId) { return query("INSERT INTO family_groups(patient_user_id,owner_user_id,status) VALUES($1,$2,'active')", [patientUserId, patientUserId]); },
    async findGroupByPatient(patientUserId) { return (await query("SELECT * FROM family_groups WHERE patient_user_id=$1", [patientUserId])).rows[0] ?? null; },
    async findGroupByMember(userId) { return (await query("SELECT fg.* FROM family_groups fg JOIN family_members fm ON fm.family_group_id=fg.id WHERE fm.user_id=$1 AND fm.status IN ('active','accepted')", [userId])).rows[0] ?? null; },
    async deactivateGroup(patientUserId) { return query("UPDATE family_groups SET status='disabled' WHERE patient_user_id=$1", [patientUserId]); },
    async addMember(groupId, userId, role) { return query("INSERT INTO family_members(family_group_id,user_id,role,status) VALUES($1,$2,$3,'active')", [groupId,userId,role]); },
    async members(groupId) { return (await query(
      `SELECT id, family_group_id, user_id,
              CASE role WHEN 'owner' THEN 'patient' WHEN 'guardian' THEN 'caregiver' WHEN 'doctor' THEN 'caregiver' ELSE role END AS role,
              CASE status WHEN 'accepted' THEN 'active' WHEN 'declined' THEN 'revoked' WHEN 'suspended' THEN 'revoked' ELSE status END AS status,
              created_at, updated_at
       FROM family_members WHERE family_group_id=$1`,
      [groupId]
    )).rows; },
    async revokeMember(groupId, memberId) { return query("UPDATE family_members SET status='revoked' WHERE id=$1 AND family_group_id=$2", [memberId,groupId]); }
  };
}
