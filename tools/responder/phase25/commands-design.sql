-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 command/RPC design. This entire file is inert commentary.
PHASE25_EXPECTED_API_WRAPPER_COUNT=26
PHASE25_EXPECTED_PRIVATE_COMMAND_COUNT=26
PHASE25_EXPECTED_HELPER_TRIGGER_COUNT=12
PHASE25_EXPECTED_FUNCTION_COUNT=64

Format: name | permission | org | AAL | scope/capability | concurrency | event/result
create_operational_record | operations.create | required | AAL2 | allowed scope | idempotency | RECORD_CREATED / record+revision+receipt
update_operational_record | operations.update | required | AAL2 | record scope | expected revision+idempotency | RECORD_UPDATED / record+revision+receipt
assign_operational_record | operations.assign | required | AAL2 | record scope | expected revision+idempotency | RECORD_ASSIGNED / assignment+receipt
close_operational_record | operations.close | required | AAL2 | record scope | expected revision+idempotency | RECORD_CLOSED / record+revision+receipt
invite_member | members.invite | required | AAL2 | none | idempotency | INVITATION_CREATED / invitation+receipt
revoke_invitation | members.invite | required | AAL2 | none | expected state+idempotency | INVITATION_REVOKED / invitation+receipt
accept_invitation | authenticated invitee | token-bound | AAL2 | none | digest lock+idempotency | INVITATION_ACCEPTED / membership+receipt
change_member_role | members.manage | required | AAL2 | none | expected revision+idempotency | MEMBER_ROLE_CHANGED / membership+receipt
suspend_member | members.manage | required | AAL2 | none | expected revision+idempotency | MEMBER_SUSPENDED / membership+receipt
reactivate_member | members.manage | required | AAL2 | none | expected revision+idempotency | MEMBER_REACTIVATED / membership+receipt
revoke_member | members.manage | required | AAL2 | none | expected revision+idempotency | MEMBER_REVOKED / membership+receipt
initiate_ownership_transfer | ownership.transfer | required | AAL2 | none | expected owner+idempotency | OWNERSHIP_TRANSFER_INITIATED / transfer+receipt
accept_ownership_transfer | transfer recipient | required | AAL2 | none | row lock+idempotency | OWNERSHIP_TRANSFER_ACCEPTED / org+receipt
cancel_ownership_transfer | ownership.transfer | required | AAL2 | none | expected state+idempotency | OWNERSHIP_TRANSFER_CANCELLED / transfer+receipt
grant_capability | platform.capability.manage | target org | AAL2 | governed scope | expected state+idempotency | CAPABILITY_GRANTED / grant+receipt
suspend_capability | platform.capability.manage | target org | AAL2 | governed scope | expected revision+idempotency | CAPABILITY_SUSPENDED / grant+receipt
revoke_capability | platform.capability.manage | target org | AAL2 | governed scope | expected revision+idempotency | CAPABILITY_REVOKED / grant+receipt
submit_projection_candidate | projection.submit | required | AAL2 | active grant+record scope | expected record revision+idempotency | PROJECTION_SUBMITTED / candidate+receipt
approve_projection | projection.review | required | AAL2 | active grant+candidate scope | expected candidate revision+idempotency | PROJECTION_APPROVED / safe projection+receipt
reject_projection | projection.review | required | AAL2 | candidate scope | expected revision+idempotency | PROJECTION_REJECTED / candidate+receipt
publish_projection | projection.publish | required | AAL2 | all live eligibility gates | expected revision+idempotency | PROJECTION_PUBLISHED / projection+receipt
withdraw_projection | projection.publish | required | AAL2 | projection scope | expected revision+idempotency | PROJECTION_WITHDRAWN / projection+receipt
start_ownership_recovery | platform.ownership.recover | target org | AAL2 | none | idempotency | RECOVERY_STARTED / case+receipt
approve_ownership_recovery | platform.ownership.recover | target org | AAL2 | distinct second actor | row lock+idempotency | RECOVERY_APPROVED / org+case+receipt
set_organization_verification | platform.organization.verify | target org | AAL2 | governed evidence | expected revision+idempotency | ORGANIZATION_VERIFIED / org+receipt
set_organization_status | platform.organization.suspend | target org | AAL2 | none | expected revision+idempotency | ORGANIZATION_STATUS_CHANGED / org+receipt

All dispatch_api wrappers are SECURITY INVOKER and return a stable, versioned result object.
All dispatch_private command implementations are SECURITY DEFINER, transaction atomic, and:
  SET search_path = '';
  use only fully qualified identifiers;
  reject null auth.uid(), absent/expired sessions, non-AAL2, and absent same-user verified TOTP;
  re-read live membership, organization, permission, scope, and capability state;
  use row locks and expected revisions for state transitions;
  write business mutation, append-only audit, and receipt in one transaction;
  accept no caller-supplied actor, publisher, or organization authority claim;
  use no dynamic SQL or user-controlled identifier interpolation.

CREATE FUNCTION dispatch_private.create_operational_record_command(...)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
BEGIN
  -- fully qualified, fail-closed implementation manufactured only in Phase 26+
END $body$;
REVOKE ALL ON FUNCTION dispatch_private.create_operational_record_command(...) FROM PUBLIC;
REVOKE ALL ON FUNCTION dispatch_private.create_operational_record_command(...) FROM anon;
REVOKE ALL ON FUNCTION dispatch_private.create_operational_record_command(...) FROM service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.create_operational_record_command(...) TO authenticated;

CREATE FUNCTION dispatch_api.create_operational_record(...)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS 'SELECT dispatch_private.create_operational_record_command(...)';

Idempotency uniqueness is (organization_id, actor_user_id, command_name, idempotency_key).
Same key + same request hash returns the stored result; a mismatched hash fails. A failed
transaction writes neither business state nor receipt. Platform commands use a reserved
platform organization sentinel in receipt scope, not a caller-controlled organization.

MVP fresh-step-up hook: minimum_iat is NULL/disabled. A future owner-approved policy may
require auth.sessions.updated_at or a signed reauthentication event after minimum_iat.
The package must not pretend that AAL2 alone proves recency.
*/
-- PHASE25_INERT_SQL_END
