export class InvalidFamilyRoleError extends Error {}
export const FAMILY_ROLES = new Set(["patient", "caregiver"]);
export function assertFamilyRole(role) {
  const value = String(role ?? "").toLowerCase();
  if (!FAMILY_ROLES.has(value)) throw new InvalidFamilyRoleError("Invalid family role");
  return value;
}
