export function createInvitationRepository(query) {
  return {
    create: (patientId,email,hash,expiresAt) => query("INSERT INTO family_invitations(patient_user_id,email,invite_code_hash,status,expires_at) VALUES($1,$2,$3,'pending',$4)",[patientId,email,hash,expiresAt]),
    findByHash: async (hash) => (await query("SELECT * FROM family_invitations WHERE invite_code_hash=$1",[hash])).rows[0] ?? null,
    accept: (id) => query("UPDATE family_invitations SET status='accepted',accepted_at=UTC_TIMESTAMP() WHERE id=$1 AND status='pending'",[id]),
    reject: (id,patientId) => query("UPDATE family_invitations SET status='revoked' WHERE id=$1 AND patient_user_id=$2 AND status='pending'",[id,patientId]),
    async countRecentFailedAttempts({ inviteCodeHash, targetUserId, ipHash, since }) {
      const result = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN ip_hash=$1 THEN 1 ELSE 0 END), 0) AS ip_attempts,
           COALESCE(SUM(CASE WHEN invite_code_hash=$2 THEN 1 ELSE 0 END), 0) AS invite_attempts,
           COALESCE(SUM(CASE WHEN target_user_id=$3 THEN 1 ELSE 0 END), 0) AS account_attempts
         FROM family_invitation_accept_attempts
         WHERE attempted_at >= $4 AND result <> 'accepted'`,
        [ipHash, inviteCodeHash, targetUserId, since]
      );
      const row = result.rows[0] ?? {};
      return Math.max(Number(row.ip_attempts ?? 0), Number(row.invite_attempts ?? 0), Number(row.account_attempts ?? 0));
    },
    recordAcceptAttempt: ({ inviteCodeHash, targetUserId, ipHash, result }) => query(
      "INSERT INTO family_invitation_accept_attempts(invite_code_hash,target_user_id,ip_hash,result) VALUES($1,$2,$3,$4)",
      [inviteCodeHash, targetUserId, ipHash, result]
    )
  };
}
