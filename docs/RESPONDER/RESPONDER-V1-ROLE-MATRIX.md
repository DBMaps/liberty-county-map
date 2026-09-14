# Responder / Agency V1 role and action contract

Contract version: `responder.agency.v1.phase0.1`. Action IDs in the first column are canonical for non-executing vectors and future local tests. `V/R/S/A` mean `VIEWER/RESPONDER/SUPERVISOR/AGENCY_ADMIN`; `G` means `GRIDLY_ADMIN` in a separate platform-governance context. `claimant`, `invitee`, and `public` are identity classes, not agency roles. `own` means the current active organization, `self` means the actor's own draft, `review` means same-org reviewer, and `platform` never grants agency impersonation.

`aal2` is mandatory for all dashboard/agency actions. An initial unaffiliated claim request is allowed at `aal1+` because it grants no membership. A public projection read requires no responder session. `gate=on` means independent `agency_publishing_enabled`; `gate=either` never bypasses other status checks. `authority=approved` requires a current, versioned county polygon and server-side point validation. Every accepted mutation emits at least one append-only business event; denied requests may emit bounded security telemetry but no business event. Read actions emit no business event. Active/public changes always recheck the gate and current organization/authority status.

| Canonical action ID | Allowed caller | Relationship | AAL | Second actor | Gate | Authority | Mandatory server checks | Business audit | Public effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `read_dashboard` | V,R,S,A; G investigation | own/platform | aal2 | no | either | none | live membership, verified active org; G separate oversight | no | none |
| `read_own_membership` | V,R,S,A | self | aal2 | no | either | none | Auth ID equals membership user | no | none |
| `read_org_roster` | S limited, A full; G investigation | own/platform | aal2 | no | either | none | live role, field-level roster projection | no | none |
| `create_draft` | R,S,A | own | aal2 | no | either | approved | org verified/active, type allowlist, bounded payload, county point | yes | hidden |
| `edit_own_draft` | R,S,A | self | aal2 | no | either | approved | draft state, author ID, revision, county point | yes | hidden |
| `edit_another_draft` | S,A | review | aal2 | no | either | approved | same org, draft state, revision | yes | hidden |
| `submit_for_review` | R self; S,A same org | self/review | aal2 | no | either | approved | complete draft, same org, revision, county point | yes | hidden |
| `return_for_changes` | S,A | review | aal2 | no | either | approved | pending state, bounded reason, revision | yes | hidden |
| `activate_non_closure` | S,A | review | aal2 | no | on | approved | pending, non-closure type, current point, expiry, revision | yes | visible |
| `activate_road_closed` | S,A | review | aal2 | **different Auth user ID** | on | approved | pending, author != approver, current point, expiry, revision | yes | visible |
| `edit_active_update` | S,A | review | aal2 | no | on | approved | active/unexpired, scope, expiry, revision | yes | revised |
| `renew_update` | S,A | review | aal2 | no | on | approved | active/unexpired, new expiry <= 24h from command, revision | yes | extended |
| `resolve_update` | S,A | review | aal2 | no | either | none | same org, active, reason, revision | yes | hidden |
| `withdraw_update` | R own unpublished; S,A; G emergency hold only | self/review/platform | aal2 | no | either | none | own draft or same org/platform case, reason, revision | yes | hidden |
| `invite_member` | A; G initial/recovery only | own/platform | aal2 | no | either | none | verified org, one-org rule, bounded role/email, not duplicate | yes | none |
| `redeem_invite` | invitee | invite target | aal2 | no | either | none | token digest, email identity, single use, expiry, one-org rule | yes | none |
| `change_member_role` | A; G recovery only | own/platform | aal2 | no self-promotion | either | none | live target, no last-admin loss, bounded role | yes | none |
| `suspend_member` | A,G | own/platform | aal2 | no | either | none | live target, no last-admin loss, reason | yes | no automatic post deletion |
| `reactivate_member` | A,G | own/platform | aal2 | no | either | none | suspended target, role review, one-org rule | yes | none |
| `revoke_member` | A,G | own/platform | aal2 | no | either | none | invited/live target, no last-admin loss, reason | yes | no automatic post deletion |
| `manage_org_profile` | A request; G approve public identity | own/platform | aal2 | no | either | none | bounded fields, public-name review | yes | approved identity only |
| `request_verification` | unaffiliated claimant | claimant | aal1+ | no | either | none | deduplicate, no automatic rights | yes | none |
| `start_verification_review` | G | platform | aal2 | no | either | none | requested state, duplicate triage | yes | none |
| `verify_organization` | G | platform | aal2 | independent agency contact | either | none | pending review, evidence, first-admin decision | yes | badge eligibility only |
| `reject_organization` | G | platform | aal2 | no | either | none | pending review, reason | yes | none |
| `revoke_organization_verification` | G | platform | aal2 | no | either | none | verified state, reason, affected-post hold | yes | hide posts |
| `activate_organization` | G | platform | aal2 | no | either | approved | verified, initial admin, county version, reason | yes | future eligibility only |
| `approve_authority` | G | platform | aal2 | no | either | certified county | FIPS, source hash, full polygon, immutable version | yes | future eligibility only |
| `revoke_authority` | G | platform | aal2 | no | either | existing version | case reason, version, atomically withdraw affected posts | yes | hide affected posts |
| `suspend_organization` | G | platform | aal2 | no | either | none | active org, reason, withdraw active posts atomically | yes | hide posts |
| `reinstate_organization` | G | platform | aal2 | no | either | approved | renewed verification/admin checks, reason | yes | **no automatic repost** |
| `recover_lost_admin` | G | platform | aal2 | independent agency contact | either | none | verified recovery evidence, no self-claim transfer | yes | none |
| `revoke_invite` | A,G | own/platform | aal2 | no | either | none | created invite, reason | yes | none |
| `view_update_audit` | R own; S,A org; G investigation | self/own/platform | aal2 | no | either | none | scoped actor and field projection | no | none |
| `view_governance_audit` | A org; G investigation | own/platform | aal2 | no | either | none | private scope and field projection | no | none |
| `change_agency_publishing_gate` | G with recorded owner authorization | platform | aal2 | owner authorization | either | none | explicit decision record, affected-publication review | yes | on/off eligibility |
| `read_consumer_projection` | public | public | none | no | on | approved | exact public allowlist and current eligibility | no | public rows only |

`GRIDLY_ADMIN` does not inherit `R/S/A` rights. A Supervisor/Admin who authored a `road_closed` draft cannot activate it. Membership revocation blocks future actions immediately; suspected-compromise posts may be withdrawn by a separately audited Supervisor or Gridly emergency hold. The first Agency Admin is verified by Gridly, not appointed by a claimant's domain alone.
