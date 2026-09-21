// Complete Phase 22-28 API inventory. N/A is explicit, never an untested command.
const groups={
 record:['create_operational_record','update_operational_record','assign_operational_record','close_operational_record','transition_operational_record'],
 invitation:['invite_member','revoke_invitation','accept_invitation'],
 membership:['change_member_role','suspend_member','reactivate_member','revoke_member'],
 transfer:['initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer'],
 capability:['grant_capability','suspend_capability','revoke_capability','renew_capability'],
 projection:['submit_projection_candidate','approve_projection','reject_projection','publish_projection','withdraw_projection'],
 recovery:['start_ownership_recovery','approve_ownership_recovery'],
 organization:['set_organization_verification','set_organization_status','renew_verification','renew_attestation','offboard_organization'],
 unit:['create_unit','set_unit_membership','advance_onboarding','offboard_unit'],
 share:['create_internal_share','replace_internal_share_recipients','revoke_internal_share'],
 user:['begin_user_offboarding','complete_user_offboarding']
};
const creates=new Set(['create_operational_record','invite_member','grant_capability','create_unit','begin_user_offboarding']);
export const commandContract=Object.entries(groups).flatMap(([family,names])=>names.map(name=>({
 name,family,plane:['capability','recovery','organization','user'].includes(family)?'PLATFORM':'ORGANIZATION',
 expectedRevision:creates.has(name)?'NOT_APPLICABLE: new identity with unique constraints and idempotency':name==='submit_projection_candidate'||name==='create_internal_share'?'source_revision':'expected_revision',
 unitBoundary:['record','projection','share'].includes(family)?'PASS: explicit source unit or authorized organization-owned record':'NOT_APPLICABLE: governed organization administration, no unit-private data returned',
 scope:['record','projection','share','capability'].includes(family)?'PASS: live source/grant scope and owning organization':'NOT_APPLICABLE: identity/administrative object, no operational publication authority',
 capability:['projection','capability'].includes(family)?'PASS: live capability for use/renewal; withdrawal/rejection remain possible after revocation':'NOT_APPLICABLE: no consumer authority granted by this operation'
}))).sort((a,b)=>a.name.localeCompare(b.name));
