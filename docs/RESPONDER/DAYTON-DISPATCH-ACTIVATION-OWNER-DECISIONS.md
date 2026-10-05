# Dayton Dispatch activation — owner decision register

**PLANNING / GOVERNANCE ONLY — NO LIVE ACTIVATION AUTHORIZATION**

This register records subsequent activation decisions against the owner-approved Phase 29 baseline, commit `e48c7f459ca306e6d5eb95c5ab263ab888f984ee`. It supplements the frozen Phase 29 reporting contract and historical Phase 27/28 planning artifacts; it does not change their text, implementation, or certification evidence.

| Decision ID | Topic | Owner status | Approved decision |
| --- | --- | --- | --- |
| DAYTON-ORG-01 | Dayton pilot organization structure | OWNER_APPROVED | One municipal organization with separate Police, Fire, EMS and Public Works department/unit boundaries; independent participating agencies use separate organizations and governed bilateral sharing. |
| DAYTON-HOSTING-01-v1 | Dedicated hosting and secret storage | OWNER_APPROVED; LOCAL_IMPLEMENTATION_PENDING | Dedicated Cloudflare Worker, dedicated Dispatch Supabase, TLS Hyperdrive with caching disabled, Worker Secrets and narrow database principal; no production resource authorization. |

| DAYTON-REVIEW-01 | Public report review authority | OWNER_APPROVED; LOCAL_ALIGNMENT_CERTIFIED | Independent explicitly scoped department/unit review; no self-approval; at least two trained authorized reviewers per unit; no default cross-unit review. |
| DAYTON-RETENTION-01 | Retention/deletion/redaction | OWNER_APPROVED_POLICY_BASELINE; LEGAL_REVIEW_AND_EXECUTION_ALIGNMENT_REQUIRED | Bounded 1/2/3/7-year schedule, minimized evidence, earliest-completed remediation and maximum 30-day plaintext quarantine; scoped holds and restore obligations; see policy artifact. |

| DAYTON-INVITE-01-v1 | Invitation origin/sender/delivery | OWNER_APPROVED; RESEND_OWNER_APPROVED; DOMAIN_VERIFIED_OWNER_CONFIRMED; EXECUTION_ALIGNMENT_REQUIRED | Exact origin https://dispatch.gridlygo.com; sender dispatch@gridlygo.com; explicit same-origin redirects; transactional primary and controlled manual fallback; no sending/activation authorization. |

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

## DAYTON-RETENTION-01 — Retention / deletion / redaction

**OWNER_APPROVED POLICY BASELINE — LEGAL/PRIVACY REVIEW STILL REQUIRED BEFORE PRODUCTION ACTIVATION.**

The owner-approved operational baseline, complete retention matrix, precise clocks, minimized evidence rules, quarantine/redaction, offboarding, holds, backups/exports and source-based support assessment are recorded in [DAYTON-RETENTION-01-v1](DAYTON-DISPATCH-RETENTION-POLICY.md). This resolves the operational policy proposal; external legal/privacy acceptance and execution alignment remain activation gates. No frozen reporting-contract text is changed.

**STOP: implementation support is partial or missing.** There is no complete scoped hold system, disposition scheduler or restore-time reapplication; terminal anchors, offboarding inventory and remediation authorization/evidence need alignment. Rejected intake stores no quarantine plaintext; existing-record quarantine can retain source text until explicit redaction, without an enforced 30-day ceiling. No runtime/schema change or deletion is authorized in this task. Other governance decisions may continue, but real activation/retention execution remains blocked.

## DAYTON-INVITE-01-v1 — Invitation origin / sender / delivery

Owner-approved origin: **https://dispatch.gridlygo.com**. Owner-approved visible sender: **dispatch@gridlygo.com**; approved display name **Gridly Dispatch**. Transactional provider: **Resend — OWNER_APPROVED**; the subsequent owner decision closes provider selection. See [the invitation delivery policy](DAYTON-DISPATCH-INVITATION-DELIVERY-POLICY.md) for the approved lifecycle, redirects, fallback, content constraints and implementation support matrix.

This resolves origin/sender policy only. Exact route allowlists, provider configuration/domain verification, safe delivery/fallback integration and certification remain activation gates. **STOP before runtime alignment:** current expiry is a maximum seven days, not an enforced exact issuance default; atomic reissue, web origin/redirect controls and actual delivery are missing or partial. No real email, invitations, DNS/provider configuration or runtime changes are authorized here. Historical Phase 28 null configuration and the frozen Phase 29 reporting contract remain unchanged.

### DAYTON-INVITE-01-v1 — Resend provider closure

Authority: owner instruction GRIDLY DISPATCH — OWNER GOVERNANCE DECISION: RESEND INVITATION PROVIDER. Resend is OWNER_APPROVED for outbound invitations/onboarding; visible sender is Gridly Dispatch <dispatch@gridlygo.com>. Owner reports Cloudflare Email Routing forwards inbound Dispatch mail to the owner inbox; no production verification was performed. Inbound/outbound roles remain separate. The invitation policy records domain recommendations, credential/event handling and missing controls. Selection is closed; DNS, configuration, secrets and real sending remain unauthorized. Implementation gaps remain a STOP before activation.

### DAYTON-INVITE-01-v1 — Verified domain owner confirmation

Owner confirms Resend sending domain **gridlygo.com — VERIFIED**; required verification DNS records were added manually by the owner. Provider **Resend — OWNER_APPROVED**; visible sender **Gridly Dispatch <dispatch@gridlygo.com>**; origin **https://dispatch.gridlygo.com**. Cloudflare is authoritative DNS and inbound Email Routing; Resend is outbound transactional sending only. No account/DNS verification or changes were performed by this task.

Real API credentials are not yet created/configured and sending is not enabled. Credential configuration, delivery adapter, origin/redirect validation, atomic reissue, correlation, bounce/complaint suppression, controlled manual-copy fallback and webhook handling remain unimplemented/inactive as complete delivery controls. See the invitation policy for partial inherited primitives and exact gaps. Safe to proceed to separately authorized runtime implementation; real sending/activation remains blocked pending implementation and certification. No frozen contract or runtime/schema change.

## DAYTON-HOSTING-01-v1 — Dedicated hosting and secret storage

**OWNER_APPROVED ARCHITECTURE — GOVERNANCE AND LOCAL IMPLEMENTATION PLANNING ONLY.**

Authority: explicit owner instruction titled GRIDLY DISPATCH — OWNER APPROVAL: HOSTING + SECRET-STORE ARCHITECTURE. Baseline: branch RESPONDER-PHASE29-dispatch-durable-report-contract, commit 89ea4e648f18f9c2794e4ce4388aa4c5300a1b42.

Approved: dedicated Cloudflare Worker (proposed gridly-dispatch-delivery-production); dedicated Dispatch Supabase Database/Auth project; dedicated TLS Hyperdrive connection with parameterized queries, query caching DISABLED and no authorization-state caching. No consumer database binding.

Approved webhook: https://dispatch.gridlygo.com/api/resend/webhook. Only this narrow route is approved; the Worker must not automatically own unrelated Dispatch paths. Broader frontend/API routing requires separate approval.

Provider: Resend. Sender: Gridly Dispatch <dispatch@gridlygo.com>. Store GRIDLY_DISPATCH_RESEND_API_KEY and GRIDLY_DISPATCH_RESEND_WEBHOOK_SECRET in Cloudflare Worker Secrets. Cloudflare inbound Email Routing remains separate from Resend outbound sending.

Approve a LOGIN/NOINHERIT/NOBYPASSRLS delivery connection principal that may assume only dispatch_delivery_transport within the appropriate transaction. No service_role authority, command-owner authority, table-wide private access, schema creation, Auth administration or broad database ownership. Preserve the frozen NOLOGIN command owner and sole bounded postgres Auth bridge.

Dispatch must not use consumer Supabase, credentials, Edge Functions, application runtime or browser/client secrets. See [the invitation policy hosting plan](DAYTON-DISPATCH-INVITATION-DELIVERY-POLICY.md#dayton-hosting-01-v1--local-worker-integration-plan) for exact proposed components and boundaries.

Architecture approval does not authorize production resources or implementation execution in this recording task. No Worker, project, Hyperdrive, secret, API key, webhook, DNS change, deployment, production connection, real invitation or email is created. Actual account/project identifiers, region, backup settings, administrators and production acceptance/support paths remain subsequent decisions. Retention legal/privacy and execution gates remain open. Frozen reporting contract and runtime/schema are unchanged.

## DAYTON-PREINSTALL-01-v1 — Dedicated Supabase pre-install security

**OWNER_APPROVED, OWNER-APPLIED SETTINGS VERIFIED LIVE; BASELINE NOT INSTALLED.** Authority: GRIDLY DISPATCH — APPROVE PRE-INSTALL SETTINGS + COMMIT DEPLOYMENT-SAFE INSTALLER, following the original pre-install design instruction. Target Gridly Dispatch / DBMaps / cmrrvwgkgjhmdugzhnrh / us-east-1 / Micro.

Approved: open signup OFF; anonymous auth OFF; Site URL https://dispatch.gridlygo.com; exact Auth redirect allowlist https://dispatch.gridlygo.com/auth/callback and https://dispatch.gridlygo.com/auth/recovery. Access-token expiry 900 seconds; maximum session lifetime 12 hours; inactivity timeout 1 hour (OWNER_APPROVED PLATFORM VARIANCE); single-session enforcement ON; refresh-token replay detection ON with 10-second reuse interval; leaked-password protection ON; minimum password length 14; secure/current-password requirement for password changes ON; email confirmation ON; secure email change ON; SMS MFA OFF; TOTP ON/retained and AAL1 restriction ON, 15 minutes, retaining the reviewed posture. Frozen fresh-step-up requirements remain separate: transfer TOTP <=10 minutes; recovery TOTP <=5 minutes for each distinct approver.

Approved project settings: mandatory SSL ON without reducing TLS minimum; Data API ON; automatically expose new tables OFF; automatic RLS OFF; PITR not purchased now; restore rehearsal required before participant activation. Previously accepted daily backups / 7-day retention for empty setup and initial pilot preparation still require actual-state verification; no legal/compliance closure.

Do not apply IP/network restrictions yet. Owner-approved deferral lasts until Hyperdrive connectivity requirements, Cloudflare egress behavior and owner/admin/recovery access requirements are verified and finalized. This is NOT approval for unrestricted networking after activation.

The locally certified deployment-safe installer is OWNER_APPROVED as the candidate for the empty dedicated project. Certification: 57 static PASS; 15 installer, 15 reporting/reviewer/invitation and 10 delivery-principal runtime PASS; 97 total PASS / 0 FAIL; 329 runtime assertion groups. Security postflight, empty rollback/reapply, evidence-bearing destructive rollback refusal, Phase 27/29 continuity, DAYTON-REVIEW-01 and DAYTON-INVITE-01 passed. DAYTON-RETENTION-01-v1 execution/legal gaps remain OPEN.

See [the exact security/settings packet](DAYTON-DISPATCH-PREINSTALL-SECURITY.md) and [local installer design](../../tools/responder/phase29/installer/README.md). The owner applied the dashboard settings and fresh pre-install readback passed. This documentation/commit task does not apply settings, access production or authorize remote baseline installation, roles, credentials, Hyperdrive, deployment, email, participants or publishing. Route readiness remains an activation prerequisite. Frozen Phase 29 contract remains unchanged.

### Verified fresh pre-install readback — owner confirmation

Authority: GRIDLY DISPATCH — RECORD VERIFIED PRE-INSTALL SETTINGS + PLATFORM VARIANCE; reference: the preceding FRESH PRE-INSTALL READBACK AFTER OWNER DASHBOARD CONFIGURATION report, confirmed by the owner. Gridly Dispatch (`cmrrvwgkgjhmdugzhnrh`) is ACTIVE_HEALTHY, us-east-1 / North Virginia, Micro, and still empty: no Dispatch schemas/roles, application users/migrations/data or Storage application buckets.

Verified: signup OFF; anonymous auth OFF; confirm email, secure email change, secure password change, current-password requirement and leaked-password protection ON; minimum password length 14; TOTP enabled; SMS MFA disabled; AAL1 restriction ON / 15 minutes; single-session ON; maximum lifetime 12 hours; refresh replay detection ON / reuse interval 10 seconds; access-token expiry 900 seconds. Site URL https://dispatch.gridlygo.com with exactly https://dispatch.gridlygo.com/auth/callback and https://dispatch.gridlygo.com/auth/recovery; no wildcard, localhost or consumer redirects. Mandatory SSL ON, minimum TLS 1.2; Data API ON, automatic table exposure OFF, automatic RLS OFF; PITR OFF; network restrictions intentionally deferred.

Inactivity timeout is verified at **1 hour — OWNER_APPROVED PLATFORM VARIANCE**: the current hosted Supabase configuration does not offer the originally proposed 30 minutes. The owner-approved supported value supersedes that earlier value for DAYTON-PREINSTALL-01-v1. JWT expiry is already 900 seconds; no JWT alignment or signing-key change is needed. Daily backups are active and a physical backup was observed; exact retention duration remains independently unverified.

Readback result: **A. READY FOR BASELINE INSTALLATION**, only after separate explicit installation authorization and fresh installer target/preflight checks. No baseline is installed. Route/workflow readiness, restore rehearsal, retention legal/execution gaps and other participant-activation gates remain open. Networking deferral is not approval for unrestricted networking after activation. This documentation task does not reconnect to or modify the real project.
