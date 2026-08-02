export function createPermissionRepository(query) {
  return {
    async get(memberId) { return (await query("SELECT * FROM family_permissions WHERE family_member_id=$1", [memberId])).rows[0] ?? null; },
    async set(memberId, column, value) { return query(`UPDATE family_permissions SET ${column}=$1 WHERE family_member_id=$2`, [Boolean(value),memberId]); },
    async locationGrant(memberId) { return (await query("SELECT * FROM location_grants WHERE family_member_id=$1 AND status='active'", [memberId])).rows[0] ?? null; },
    async revokeLocation(memberId) { return query("UPDATE location_grants SET status='revoked',revoked_at=UTC_TIMESTAMP() WHERE family_member_id=$1", [memberId]); }
  };
}
