export function createInvitationRepository(query) {
  return {
    create: (patientId,email,hash,expiresAt) => query("INSERT INTO family_invitations(patient_user_id,email,invite_code_hash,status,expires_at) VALUES($1,$2,$3,'pending',$4)",[patientId,email,hash,expiresAt]),
    findPending: async (hash,email) => (await query("SELECT * FROM family_invitations WHERE invite_code_hash=$1 AND email=$2 AND status='pending'",[hash,email])).rows[0] ?? null,
    accept: (id) => query("UPDATE family_invitations SET status='accepted',accepted_at=UTC_TIMESTAMP() WHERE id=$1 AND status='pending'",[id]),
    reject: (id,patientId) => query("UPDATE family_invitations SET status='revoked' WHERE id=$1 AND patient_user_id=$2 AND status='pending'",[id,patientId])
  };
}
