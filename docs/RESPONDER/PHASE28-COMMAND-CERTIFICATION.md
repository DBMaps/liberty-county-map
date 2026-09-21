# Phase 28 command certification

40 total; 40 PASS; 0 whole-command N/A; 0 failed; 0 unknown. Each API executed successfully against real local Auth and has a 21-dimension certification in command-certification.json. New-object revisions, platform membership, administrative unit boundaries and non-publication capability checks carry explicit dimension-specific N/A reasons; no command is omitted.

| Command | Authority plane | Revision | Result |
|---|---|---|---|
| accept_invitation | ORGANIZATION | expected_revision | PASS |
| accept_ownership_transfer | ORGANIZATION | expected_revision | PASS |
| advance_onboarding | ORGANIZATION | expected_revision | PASS |
| approve_ownership_recovery | PLATFORM | expected_revision | PASS |
| approve_projection | ORGANIZATION | expected_revision | PASS |
| assign_operational_record | ORGANIZATION | expected_revision | PASS |
| begin_user_offboarding | PLATFORM | NOT_APPLICABLE: new identity with unique constraints and idempotency | PASS |
| cancel_ownership_transfer | ORGANIZATION | expected_revision | PASS |
| change_member_role | ORGANIZATION | expected_revision | PASS |
| close_operational_record | ORGANIZATION | expected_revision | PASS |
| complete_user_offboarding | PLATFORM | expected_revision | PASS |
| create_internal_share | ORGANIZATION | source_revision | PASS |
| create_operational_record | ORGANIZATION | NOT_APPLICABLE: new identity with unique constraints and idempotency | PASS |
| create_unit | ORGANIZATION | NOT_APPLICABLE: new identity with unique constraints and idempotency | PASS |
| grant_capability | PLATFORM | NOT_APPLICABLE: new identity with unique constraints and idempotency | PASS |
| initiate_ownership_transfer | ORGANIZATION | expected_revision | PASS |
| invite_member | ORGANIZATION | NOT_APPLICABLE: new identity with unique constraints and idempotency | PASS |
| offboard_organization | PLATFORM | expected_revision | PASS |
| offboard_unit | ORGANIZATION | expected_revision | PASS |
| publish_projection | ORGANIZATION | expected_revision | PASS |
| reactivate_member | ORGANIZATION | expected_revision | PASS |
| reject_projection | ORGANIZATION | expected_revision | PASS |
| renew_attestation | PLATFORM | expected_revision | PASS |
| renew_capability | PLATFORM | expected_revision | PASS |
| renew_verification | PLATFORM | expected_revision | PASS |
| replace_internal_share_recipients | ORGANIZATION | expected_revision | PASS |
| revoke_capability | PLATFORM | expected_revision | PASS |
| revoke_internal_share | ORGANIZATION | expected_revision | PASS |
| revoke_invitation | ORGANIZATION | expected_revision | PASS |
| revoke_member | ORGANIZATION | expected_revision | PASS |
| set_organization_status | PLATFORM | expected_revision | PASS |
| set_organization_verification | PLATFORM | expected_revision | PASS |
| set_unit_membership | ORGANIZATION | expected_revision | PASS |
| start_ownership_recovery | PLATFORM | expected_revision | PASS |
| submit_projection_candidate | ORGANIZATION | source_revision | PASS |
| suspend_capability | PLATFORM | expected_revision | PASS |
| suspend_member | ORGANIZATION | expected_revision | PASS |
| transition_operational_record | ORGANIZATION | expected_revision | PASS |
| update_operational_record | ORGANIZATION | expected_revision | PASS |
| withdraw_projection | ORGANIZATION | expected_revision | PASS |

Every command checks authenticated/live actor and AAL2. Tenant actions recheck live membership and object organization; private record actions also recheck unit/scope. Platform authority is independent and never grants tenant access. Accepted receipt replay is authorized again and does not duplicate evidence. Consumed transfer/recovery approvals deny replay. Failed commands leave no mutation, receipt or audit residue. See the machine-readable matrix for each dimension and the two runtime vector files for executed checks.
