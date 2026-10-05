# Dayton Dispatch activation — owner decision register

**PLANNING / GOVERNANCE ONLY — NO LIVE ACTIVATION AUTHORIZATION**

This register records subsequent activation decisions against the owner-approved Phase 29 baseline, commit `e48c7f459ca306e6d5eb95c5ab263ab888f984ee`. It supplements the frozen Phase 29 reporting contract and historical Phase 27/28 planning artifacts; it does not change their text, implementation, or certification evidence.

| Decision ID | Topic | Owner status | Approved decision |
| --- | --- | --- | --- |
| DAYTON-ORG-01 | Dayton pilot organization structure | OWNER_APPROVED | One municipal organization with separate Police, Fire, EMS and Public Works department/unit boundaries; independent participating agencies use separate organizations and governed bilateral sharing. |

| DAYTON-REVIEW-01 | Public report review authority | OWNER_APPROVED; LOCAL_ALIGNMENT_CERTIFIED | Independent explicitly scoped department/unit review; no self-approval; at least two trained authorized reviewers per unit; no default cross-unit review. |

## DAYTON-ORG-01 — Organization structure

Authority: explicit owner instruction in the Dispatch planning conversation, titled “GRIDLY DISPATCH — OWNER GOVERNANCE DECISION: DAYTON ORGANIZATION STRUCTURE.” This is the approved default governance structure for the Dayton Dispatch activation plan.

Use **ONE MUNICIPAL ORGANIZATION** with separate department/unit boundaries for:

- Dayton Police Department
- Dayton Fire Department
- Dayton EMS
- Dayton Public Works

If a participating agency is legally or operationally independent from the City of Dayton, that agency must use separate-organization treatment and the governed bilateral-sharing model already supported by Phase 29.

## Access boundaries remain explicit

This decision creates no inherited access. Each unit must retain separate:

- membership
- reviewers
- capability grants
- governed scope
- internal sharing permissions
- audit lineage

City/organization administrators do not automatically gain access to unit-private records merely because they administer the parent organization. Police, Fire, EMS and Public Works do not inherit one another’s private information or publication authority.

Within the municipal organization, sharing requires explicit recipient-unit authorization. For independent agencies, sharing requires the separate-organization bilateral agreement path, including approval by both organizations and explicit recipient boundaries. Parent relationships, municipal affiliation and administrative roles are not substitutes for those controls.

## Activation-plan effect and remaining decisions

The default structural choice is resolved. Phase 29 already supports both the municipal-unit model and the independent-agency exception; no schema or runtime behavior change is required.

Operational onboarding remains Police → Fire/EMS → Public Works. All four department classifications remain supported from the beginning.

Named participants and reviewers, actual memberships, unit-specific scopes, authority evidence, capability grants and impact envelopes, sharing authorizations/agreements, retention/deletion and quarantine/redaction legal policies, invitation provider/sender/origin, recovery staffing, and safety/training sign-off remain separate owner/legal/operational decisions. This structure decision does not approve them by implication.

No organization, unit, participant, invitation, capability grant or sharing agreement is created or activated by this document. Public publishing remains disabled. Production, consumer Gridly and store work remain outside this documentation change.

## DAYTON-REVIEW-01 — Public report review authority

Authority: explicit owner instruction titled “GRIDLY DISPATCH — OWNER GOVERNANCE DECISION: PUBLIC REPORT REVIEW AUTHORITY.” Status: **OWNER_APPROVED governance policy; locally aligned and certified after the initial assessment below.** This decision does not modify the frozen Phase 29 reporting contract or retroactively extend its certification.

### Independent review and coverage

**THE AUTHOR OF A REPORT MAY NEVER APPROVE THEIR OWN PUBLICATION.** Public reporting must use independent department/unit review. The author and reviewer must be distinct users.

Dayton Police Department, Dayton Fire Department, Dayton EMS and Dayton Public Works must each plan for a minimum of **2 trained authorized reviewers** for public-report review coverage. Departments may appoint more. Staffing must avoid reliance on self-approval; no bypass is permitted when a second reviewer is unavailable. Actual reviewer appointments and training evidence remain activation prerequisites.

### Explicit reviewer scope and high-risk authority

A reviewer may approve only within the department/unit and capability scope they are explicitly authorized for. Department/unit membership alone and parent-organization administrator status do not create review authority.

Official Public Notice, hazard publication, full road closure and hazard-caused full road closure require a reviewer authorized for the matching publication capability and applicable risk gates. Authority must align with the exact report subtype, applicable hazard gate, applicable road-closure gate, governed geographic scope, department/unit, current verification and active capability grant. Hazard-caused full closure requires the matching subtype and both risk gates.

Default: **NO cross-unit approval.** Any later cross-unit review requires separately granted explicit authorization identifying exact permitted units, report/capability categories, scope, validity/expiry and separate owner/governance approval. A reviewer cannot obtain cross-unit authority merely by joining another unit. For legally independent organizations, a sharing agreement never confers cross-organization review authority.

### Immediate loss of authority — no grace period

Review authority becomes unusable immediately if participant membership or reviewer role is revoked; verification expires or is revoked; a capability grant expires or is revoked; governed scope/version becomes invalid; required public-capability attestation expires; or the account is suspended/offboarded.

### Separation of duties and audit

The reviewer must be currently eligible at approval time. Approval must bind to the exact report revision reviewed. Changing the report after approval invalidates that approval and requires new review; corrections and revisions require fresh review. Withdrawal removes public eligibility without re-approval.

Audit lineage must record the author token, reviewer token, decision, revision, policy version and timestamp.

### Initial read-only implementation comparison and stop (historical)

Reviewed committed implementation at `26d71ae6a6b7cbc4ab795c274e848f10b26429bc`, against the frozen certified Phase 29 implementation at `e48c7f459ca306e6d5eb95c5ab263ab888f984ee`. Findings are from source inspection, not a new runtime certification.

Already supported: author/reviewer separation, live identity/session and unit-access checks, stored source/details revisions and review lineage, publication eligibility invalidation after revision/withdrawal or expired/revoked authority, and no automatic reviewer access from bilateral sharing.

**Exact mismatches requiring separately authorized implementation alignment before activation:**

1. **Reviewer-specific authority is missing.** Phase 29 `report_execute` maps publication review to the general `projection.review` permission. `report_grants_valid` binds publication grants to the organization, source unit, subtype, scope/version and impact envelope; it does not bind review authority to the reviewing participant's exact subtype/risk/scope authorization. General role permission plus unit access is therefore broader than this policy. See `tools/responder/phase29/schema.local.sql` functions `report_execute` and `report_grants_valid`, and `tools/responder/phase28/package.local.sql` helpers `actor_membership`, `unit_access` and `record_access`.
2. **Separate cross-unit review authorization is missing.** The general review permission can operate across every unit for which the participant has explicit membership and the source unit has scope access. There is no separate reviewer-role grant requiring category/scope/expiry and owner approval for cross-unit review. Multiple explicit unit memberships must not substitute for the new policy's separate cross-unit authorization.
3. **Full eligibility is not revalidated at approval time.** `review_report_publication` checks access, pending state, author separation and decision, then sets the review decision. It does not recheck organization verification, public-capability attestation, current publication grants or review expiry before recording approval. These conditions are checked when submitting the candidate and/or in later `report_public_eligible`; later publication refusal does not meet the new approval-time requirement. The source-record access helper does check active record scope, but that is not the complete grant/scope-version/governance revalidation required here.
4. **Candidate revision equality is not checked at approval time.** The common command guard checks the caller's expected current details revision and current source/details alignment. The review branch does not also require `v.source_revision = r.current_revision` and `v.details_revision = d.revision`. Thus a stale pending candidate can receive an approval decision when the caller supplies the new current details revision, although later publication eligibility refuses it. The policy requires refusal at approval time.

The exact installed review branch is `tools/responder/phase29/package.local.sql:200-203`; later eligibility checks are in `report_public_eligible`. Reviewer staffing/training is an operational prerequisite, not evidence that these runtime gaps are resolved.

**STOP: no schema/runtime repair is authorized or performed in this decision-recording task.** No new certification claim is made for this policy. Public activation under DAYTON-REVIEW-01 remains blocked until the owner separately authorizes implementation alignment and focused certification. The previously certified Phase 29 baseline remains unchanged.

### DAYTON-REVIEW-01 — Local alignment resolution

The owner subsequently authorized reviewer-specific implementation alignment. The governance decision was preserved first in commit `6260218572cea1e124cf75fd765d15d348f6ee06`. The four historical gaps above are resolved by additive reviewer authorizations, explicit acting/target unit bindings, current-authority checks before receipt replay and approval, and immutable candidate-state snapshots covering report/detail/impact/candidate/contract/policy/scope state.

Final local certification: 10 static tests and 14 runtime tests passed with zero failures; 298 runtime assertion groups include 76 focused reviewer-policy assertions. The unchanged Phase 27 security postflight and frozen function/privilege comparison passed, including preservation of identity-map erasure. Evidence and limitations are recorded in `reports/responder/responder-phase29-review-authority.json`.

This resolves the implementation-alignment stop for owner review. Named reviewers, evidence of training and minimum two-reviewer staffing per unit remain activation prerequisites. No real reviewers/grants/participants were created; publication remains disabled. The frozen Phase 29 reporting contract, historical certification artifacts and existing commits remain unchanged.
