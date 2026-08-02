const PERMISSIONS={VIEW_GLUCOSE:"can_view_glucose",VIEW_HISTORY:"can_view_history",VIEW_LOCATION:"can_view_location",SEND_SOS:"can_view_sos"};
export class FamilyPermissionDeniedError extends Error {}
export function createFamilyPermissionService(familyRepository, permissionRepository) {
  const column=(permission)=>{const value=PERMISSIONS[permission];if(!value)throw new Error("Unknown family permission");return value;};
  return {
    async checkPermission(patientId,caregiverId,permission) {
      const group=await familyRepository.findGroupByPatient(patientId);
      if(!group) return false;
      const member=(await familyRepository.members(group.id)).find((item)=>String(item.user_id)===String(caregiverId)&&item.status==="active");
      return Boolean(member && (await permissionRepository.get(member.id))?.[column(permission)]);
    },
    async grantPermission(memberId,permission) { return permissionRepository.set(memberId,column(permission),true); },
    async revokePermission(memberId,permission) { return permissionRepository.set(memberId,column(permission),false); }
  };
}
