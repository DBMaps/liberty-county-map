# Responder / Agency V1 state machines

Contract version: `responder.agency.v1.phase0.1`. Only transitions listed here are allowed. Every commanded transition checks authenticated identity, current membership/role or platform governance identity, organization status, expected revision, operation token, and action-specific predicates **at the server**. `aal2` applies to agency mutations and Gridly governance; an initial unaffiliated claim may use `aal1+`. Accepted commands append the named event in the same transaction. Business denials leave no business mutation/event. Public eligibility is recalculated on every read.

## Organization verification

| From → to; action | Actor and extra preconditions/checks | Required event; public effect | Reversible / new record |
| --- | --- | --- | --- |
| absent → `requested`; `request_verification` | Unaffiliated authenticated claimant; deduplicate, bounded evidence, no authority granted | `verification_requested`; none | Reapplication is a new claim after terminal result |
| `requested` → `pending_review`; `start_verification_review` | Gridly Admin; duplicate and reviewer triage | `verification_review_started`; none | No direct reversal; resolve review |
| `pending_review` → `verified`; `verify_organization` | Gridly Admin; independent official callback/evidence and initial-admin review | `organization_verified`; badge **eligibility only**, no automatic public post | Revocation only, not casual toggle |
| `pending_review` → `rejected`; `reject_organization` | Gridly Admin; bounded reason | `organization_rejected`; none | Terminal; new claim required |
| `verified` → `revoked`; `revoke_organization_verification` | Gridly Admin; case reason; atomically suspend operation and withdraw active posts | `verification_revoked`, `organization_suspended`, affected `update_withdrawn` events; hidden immediately | Terminal; new review/record required |

## Organization operation

| From → to; action | Actor and extra preconditions/checks | Required event; public effect | Reversible / new record |
| --- | --- | --- | --- |
| `inactive` → `active`; `activate_organization` | Gridly Admin; verified, current county authority, approved initial admin, bounded reason | `organization_activated`; future posts eligible only if agency gate on | May be suspended |
| `active` → `suspended`; `suspend_organization` | Gridly Admin; case reason; increment operation epoch and withdraw active posts atomically | `organization_suspended` plus affected `update_withdrawn`; hidden | May be reinstated after review; old posts stay terminal |
| `suspended` → `active`; `reinstate_organization` | Gridly Admin; verification still valid, fresh authority/admin checks, reason | `organization_reinstated`; **no old post republished** | May be suspended again; new update needed |

## Membership

| From → to; action | Actor and extra preconditions/checks | Required event; public effect | Reversible / new record |
| --- | --- | --- | --- |
| absent → `invited`; `invite_member` | Agency Admin or Gridly initial/recovery; verified org, one-org rule, unique live invite | `member_invited`; none | Invite can be revoked/expire |
| `invited` → `active`; `redeem_invite` | Matching invitee; unexpired single-use digest, email identity, `aal2`, one active org/user | `member_joined` and `invite_redeemed`; none | May suspend/revoke |
| `invited` → `revoked`; `revoke_member` | Agency/Gridly Admin; reason, cancel invite | `member_invitation_revoked`; none | Terminal; new invite required |
| `active` → `suspended`; `suspend_member` | Agency/Gridly Admin; no self-promotion or last-admin loss, reason | `member_suspended`; future commands denied; existing posts reviewed if compromise | May reactivate after review |
| `active` → `revoked`; `revoke_member` | Agency/Gridly Admin; reason and last-admin check | `member_revoked`; future commands denied | Terminal; new invite required |
| `suspended` → `active`; `reactivate_member` | Agency/Gridly Admin; renewed role/MFA/one-org checks | `member_reactivated`; no automatic role expansion | May suspend/revoke |
| `suspended` → `revoked`; `revoke_member` | Agency/Gridly Admin; reason | `member_revoked`; none | Terminal; new invite required |

## Invite

| From → to; action | Actor and extra preconditions/checks | Required event; public effect | Reversible / new record |
| --- | --- | --- | --- |
| absent → `created`; `invite_member` | Agency/Gridly Admin; role and target identity allowlist, expiry | `invite_created`; none | Can redeem, revoke, or expire |
| `created` → `redeemed`; `redeem_invite` | Matching invitee, token digest, `aal2`, clock before expiry, one use | `invite_redeemed`; none | Terminal; no second redemption |
| `created` → `revoked`; `revoke_invite` | Agency/Gridly Admin; reason | `invite_revoked`; none | Terminal; issue a new invite |
| `created` → `expired`; server clock | Time reaches immutable `expires_at`; read/redeem treats as expired without Cron | `invite_created` already records expiry; no time-triggered business event; none | Effective terminal state; new invite required |

## Agency update

`effective_expired` is a derived terminal **display** state, not a mutable stored status. An update is public only while stored `active` and all current projection predicates hold. Creation and every revision have an event. No automatic scheduler is required for disappearance at expiry.

| From → to; action | Actor and extra preconditions/checks | Required event; public effect | Reversible / new record |
| --- | --- | --- | --- |
| absent → `draft`; `create_draft` | Responder/Supervisor/Admin; verified active org, current county polygon, bounded type/point | `update_draft_created`; hidden | May submit/withdraw |
| `draft` → `draft`; `edit_own_draft` / `edit_another_draft` | Author or same-org Supervisor/Admin; revision and scope | `update_draft_edited`; hidden | May submit/withdraw |
| `draft` → `pending_review`; `submit_for_review` | Author or same-org Supervisor/Admin; complete fields, current county scope | `update_submitted`; hidden | May return/withdraw |
| `pending_review` → `draft`; `return_for_changes` | Same-org Supervisor/Admin; reason and revision | `update_returned`; hidden | May resubmit |
| `pending_review` → `active`; `activate_non_closure` | Same-org Supervisor/Admin; non-closure, gate on, current scope, 12h default/24h max | `update_activated`; visible | May edit/renew/resolve/withdraw until expiry |
| `pending_review` → `active`; `activate_road_closed` | Same checks plus approver Auth user ID **different** from immutable draft author ID | `road_closure_activated` with both actor IDs privately; visible | May edit/renew/resolve/withdraw until expiry |
| `draft` / `pending_review` → `withdrawn`; `withdraw_update` | Author for own unpublished draft or same-org Supervisor/Admin; reason | `update_withdrawn`; hidden | Terminal; new update required |
| `active` → `active`; `edit_active_update` / `renew_update` | Same-org Supervisor/Admin; gate on, unexpired, scope/authority/expiry/revision current | `update_edited` / `update_renewed`; revised public row | May continue until expiry |
| `active` → `resolved`; `resolve_update` | Same-org Supervisor/Admin; reason and revision; allowed while gate off | `update_resolved`; hidden | Terminal; new update required |
| `active` → `withdrawn`; `withdraw_update` or platform emergency hold | Supervisor/Admin or Gridly case action; reason; allowed while gate off | `update_withdrawn`; hidden | Terminal; new update required |
| `active` → `effective_expired`; server clock | `now >= expires_at`, even if no command runs | Activation/renewal event already encodes expiry; no time-triggered event; hidden | Terminal for public display; new reviewed update required |

## Explicitly prohibited shortcuts

No `draft → active`, `requested → verified`, `rejected/revoked verification → verified/active`, `revoked membership → active`, `redeemed/expired/revoked invite → redeemed`, `resolved/withdrawn/effective_expired update → active`, self-promotion, last-admin removal, same-author `road_closed` activation, public post without gate/approved polygon/verified active organization, or automatic repost on organization reinstatement. No client-supplied state, authority ID, role claim, or clock can bypass these rules.
