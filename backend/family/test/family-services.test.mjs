import test from "node:test";
import assert from "node:assert/strict";
import { createFamilyMemberService, DuplicateFamilyMemberError } from "../services/familyMemberService.js";
import { createFamilyPermissionService } from "../services/familyPermissionService.js";

const repo={members:async()=>[{id:2,user_id:20,status:"active",role:"caregiver"}],addMember:async()=>({rowCount:1}),revokeMember:async()=>({rowCount:1}),findGroupByPatient:async(id)=>id===10?{id:1}:null};
const permissions={get:async()=>({can_view_glucose:true,can_view_history:true,can_view_location:false,can_view_sos:false}),set:async()=>({rowCount:1})};

test("duplicate caregiver is rejected",async()=>{await assert.rejects(()=>createFamilyMemberService(repo).addMember(1,20,"caregiver"),DuplicateFamilyMemberError);});
test("active caregiver gets only explicit permissions",async()=>{const service=createFamilyPermissionService(repo,permissions);assert.equal(await service.checkPermission(10,20,"VIEW_GLUCOSE"),true);assert.equal(await service.checkPermission(10,20,"VIEW_LOCATION"),false);assert.equal(await service.checkPermission(10,20,"SEND_SOS"),false);});
test("stranger is denied",async()=>{assert.equal(await createFamilyPermissionService(repo,permissions).checkPermission(10,99,"VIEW_HISTORY"),false);});
