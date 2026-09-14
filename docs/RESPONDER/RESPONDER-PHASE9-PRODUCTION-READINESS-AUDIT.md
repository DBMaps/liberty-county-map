# Responder Phase 9 — production readiness audit

**Scope and decision.** This is a local-source, design-only audit at branch RESPONDER-PHASE9-production-readiness-audit, starting from Phase 8 commit df21c4baf8c8154f58fb61b9bf099cc2e9c254df. The Phase 8 [vector map](../../reports/responder/responder-phase8-vector-map.json) reports 54/54 complete. The local fixtures certify contract behavior, not deployed Auth, RLS, data, hosting, email, backup, legal policy, or consumer behavior. No Supabase or production endpoint was contacted. No production migration or deployment is authorized.

**Decision: CONDITIONAL GO for guarded production implementation planning only.** The frozen contract and eight local increments give a coherent migration design. Production release remains blocked by the explicit B01–B13 gates below. A migration candidate may be drafted after the design gates; it must not be applied until live-environment preflight, review, rehearsal, and separate owner authorization. Current publishing gate must remain false throughout translation.

## Evidence and limits

Primary contract: [V1 contract](RESPONDER-V1-CONTRACT.md), [roles](RESPONDER-V1-ROLE-MATRIX.md), [state machines](RESPONDER-V1-STATE-MACHINES.md), [commands](RESPONDER-V1-COMMAND-CONTRACT.md), [authority](RESPONDER-V1-AUTHORITY-CONTRACT.md), [consumer projection](RESPONDER-V1-CONSUMER-PROJECTION.md), [source governance](RESPONDER-V1-SOURCE-GOVERNANCE.md), and [owner decisions](RESPONDER-V1-OWNER-DECISIONS.md). Implementation evidence: [Phase 1](RESPONDER-PHASE1-LOCAL-SCHEMA.md), [2](RESPONDER-PHASE2-LOCAL-AUTH-MEMBERSHIP.md), [3](RESPONDER-PHASE3-LOCAL-COUNTY-AUTHORITY.md), [4](RESPONDER-PHASE4-LOCAL-RLS-AUTHORIZATION.md), [5](RESPONDER-PHASE5-LOCAL-COMMAND-RPC.md), [6](RESPONDER-PHASE6-LOCAL-GOVERNANCE-VERIFICATION.md), [7](RESPONDER-PHASE7-LOCAL-RATE-LIMIT-CONSUMER-PROJECTION.md), and [8](RESPONDER-PHASE8-LOCAL-DASHBOARD-CONTRACT.md). SQL evidence is in [db/responder-local](../../db/responder-local/); these scripts are disposable local fixtures and are **not production migrations**.

Tracked environment evidence: [Supabase config](../../supabase/config.toml), [migrations](../../supabase/migrations/), [package manifest](../../package.json), [consumer app](../../js/app.js), [consumer shell](../../index.html), [service worker](../../service-worker.js), [county source manifest](../../assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json), [LP168 environment review](../../LP168-PRODUCTION-ENVIRONMENT-READINESS-REVIEW.md), [LP169 production certification](../../LP169-PRODUCTION-CONFIGURATION-AND-REMOTE-SERVICE-CERTIFICATION.md), [recovery runbook](../LEGAL/LP24421-RECOVERY-RUNBOOK.md), and [privacy policy](../LEGAL/GRIDLY-PRIVACY-POLICY.md). Repository inspection cannot establish what migrations actually ran, live Auth capabilities/config, plan entitlements, SMTP, current DNS/TLS, backups/PITR, production grants, or deployed data. All such facts are **unknown**, not passed.

## 1. Identity, Auth, MFA, and offboarding

Local synthetic UUIDs should map one-to-one to production Auth user UUIDs. On every dashboard read and privileged command, derive actor identity from a server-validated authenticated request, then recheck current live membership, role, organization verification/active state, suspension, county authority, and operation epoch in the same database transaction or bounded read. One active organization per responder remains the V1 rule. Derive the acting organization from that membership; never accept a client-selected actor, role, organization, county grant, or verification state as authority. A stale JWT may remain cryptographically valid after an operator changes a role; claims are hints until live DB recheck. An operation epoch blocks previously issued command contexts after suspension or revocation. Offboarding must revoke live membership and sessions where the platform supports it, but command denial cannot depend on token expiry or session invalidation alone. Lost-admin recovery is a separate, recorded governance operation with independent reviewer and no implicit authority restoration.

The production Auth design must verify a stable subject UUID and reliable aal2/TOTP assurance for **dashboard entry, all agency mutations, and governance actions**. Enrollment, factor loss, recovery, and re-enrollment need operator-tested UX and procedures. Do not equate a locally supplied aal2 boolean with a server-validated assurance claim; verify the platform's current claim/session semantics and whether its MFA challenge is enforced on each privileged request. Reject missing, downgraded, or unverifiable assurance. Do not trust email, user metadata, app metadata, client-side MFA display state, or an old access token for current membership or authority. No tracked responder Auth integration or real TOTP enrollment flow was found; the package has supabase-js but the existing consumer client is not a responder login. B01 blocks implementation acceptance.

**Fixture-only, must not ship:** local_auth_identities, phase4_session_bindings, synthetic PostgreSQL login roles and session_user mapping, BYPASSRLS fixture roles, local test claims and credential setup, phase2_identity_ok with caller-supplied actor/aal2, and direct exposure of phase2_membership_command or phase3 authority helpers accepting a caller-supplied actor. The [Phase 4 SQL](../../db/responder-local/004_phase4_rls_authorization_apply.sql) and [Phase 5 SQL](../../db/responder-local/005_phase5_local_command_apply.sql) explicitly identify the synthetic boundary. Production should use a verified Auth-to-DB identity adapter and private command functions whose actor argument cannot be spoofed.

## 2. RLS translation and safe reads

The Phase 4 model enables and forces RLS on 13 tables; Phase 6 adds the 14th governance receipt table. The useful portable principle is default-deny private tables plus narrow own-organization SELECT and controlled mutation functions. Production must review owner/role behavior under FORCE RLS, service roles, connection pooling, schema exposure, and the actual Auth adapter. Apply RLS **before** granting authenticated access; install policies and views before exposing them, and revoke default PUBLIC function/schema privileges immediately. No direct INSERT/UPDATE/DELETE policy is intended for agency clients. Governance and command mutations must occur through narrowly granted, audited functions with live checks; no general table write grant to authenticated, anon, or agency roles. Test as real anon/authenticated/governance identities, including cross-org and suspended states; test owner and service execution separately. A security-invoker view still needs valid underlying grants and RLS; a default owner-rights view is unsafe.

| Private table | Production SELECT / mutation boundary | FORCE RLS and exposure note |
| --- | --- | --- |
| organizations | Current eligible org summary for member; governance read through dedicated bounded function; no direct writes | RLS + FORCE; do not expose raw verification evidence |
| organization_memberships | Own current roster by role; no direct writes | RLS + FORCE; recheck active membership inside commands |
| organization_authorities | Own current authority summary; no direct writes | RLS + FORCE; revoke must invalidate active publishing atomically |
| agency_updates | Own-org queue/inspector via bounded views; no direct writes | RLS + FORCE; public reads only through projection |
| agency_update_events | No raw agency/public SELECT; bounded audit export to governance | RLS + FORCE; append only via command boundary |
| organization_verification_events | Governance-only bounded evidence; no agency/public SELECT | RLS + FORCE; append only |
| organization_governance_events | Governance-only bounded evidence; no agency/public SELECT | RLS + FORCE; append only |
| organization_invites | Agency Admin bounded summary, governance operations; no raw token read | RLS + FORCE; invite acceptance is server-side command |
| agency_operation_receipts | No agency/public raw SELECT; server-side replay lookup only | RLS + FORCE; unique immutable token digest |
| agency_program_controls | Only bounded gate status; owner/governance-controlled writes | RLS + FORCE; default false; one row |
| county_geometry_catalog | No direct agency/public read needed for authority checks | RLS + FORCE if kept; reconcile with existing boundary table |
| governance_operation_receipts | Governance command replay lookup only | RLS + FORCE; separate replay domain |
| local_auth_identities | **Fixture only: omit from production** | Replace with Auth subject integration |
| phase4_session_bindings | **Fixture only: omit from production** | Replace with validated session identity |

Phase 4 safe views (organization context, roster, current authority, invite summary, update queue) and Phase 8 records/queue/map/inspector/affordance views are portable **with identity/grant adaptation**; retain security_invoker and column allowlists. Phase 8 command affordances are UI hints, never authorization. Agency governance denial is a bounded negative interface, not a grant. Agency publishing and community reporting gates remain separate.

## 3. Security-definer and helper audit

All listed local definers set search_path to pg_catalog and schema-qualify objects; production candidates must preserve that and explicitly REVOKE EXECUTE FROM PUBLIC before any role-specific GRANT. Ownership must be a dedicated least-privilege database role, not an app login or fixture BYPASSRLS owner. Audit default function EXECUTE and schema USAGE separately. These functions use fixed SQL/JSON parsing rather than dynamic user SQL, so the primary injection risk is spoofed JSON identity/context and privilege escalation, not observed string-built SQL. Re-review any future dynamic SQL.

| Local function | Purpose and production disposition | Owner / EXECUTE / object grants and risk |
| --- | --- | --- |
| phase4_actor_id | session_user-to-UUID adapter; **discard** | Fixture mapping can impersonate users in production; no public exposure |
| phase4_member_role | policy membership lookup; **rewrite** around validated Auth subject and live DB | Dedicated policy helper owner; narrow EXECUTE to intended roles; recursive policy / FORCE RLS review |
| phase4_governance_ok | fixture governance check; **rewrite** around verified separate admin identity | Never infer GRIDLY_ADMIN from agency membership or client claim |
| phase4_governance_organization_context | bounded governance read; **adapt or invoker if feasible** | Admin-only EXECUTE, minimum SELECT, no raw evidence leak |
| phase5_agency_update_command | superseded local command entry; **do not deploy** | Local BYPASSRLS owner unacceptable; no production grant |
| phase6_governance_command | governance mutation/replay; **rewrite** | Separate governance owner and EXECUTE only to verified admin boundary; minimum table DML; aal2 and independent review |
| phase7_agency_update_command | final local command/rate entry; **rewrite** | Command owner with scoped DML and live Auth/aal2/membership/authority checks; no direct table DML grants |
| phase7_consumer_projection_at | time-parameterized public projection; **do not expose raw to public** | Controlled test/admin EXECUTE only; caller time can bypass current visibility if exposed |
| phase7_consumer_projection_now | current 18-key public allowlist; **adapt** | Projection owner read-only, narrow public-facing boundary, gate false default; exact anon exposure review |

The Phase 7 responder_public.agency_updates view is default view-owner context and relies on the gated definer; evaluate a dedicated read endpoint or security_invoker wrapper with explicit least-privilege grants before exposure. No private event, receipt, controls, session binding, Auth identity, or cross-org row may leak through it. Phase 2 invoker helpers and Phase 3 invoker county functions with caller-supplied actor are also unsafe as public RPCs. Phase 8 entry and denial helpers are invokers and can remain so after Auth adaptation. Trigger guards are invoker-side invariants and require ownership/grant tests. Production RLS may require a narrow owner path because FORCE RLS affects ordinary owners; do not solve recursion by granting BYPASSRLS broadly.

## 4. Ordered production migration design — no SQL created

Before each stage, record deployed schema inventory, grants/policies/roles, extension location/version, row counts and checksums, a tested rollback artifact, owner sign-off, and gate=false proof. A stage postflight uses negative permission tests and immutable evidence checks. DDL may be transaction-safe in PostgreSQL, but a long transaction can lock live traffic; avoid unbounded backfills in a DDL transaction. No stage applies from this audit.

| Stage | Dependency / preflight | Postflight / rollback boundary | Destructive, lock, window |
| --- | --- | --- | --- |
| 0 live preflight | Authorized read-only production inventory, Auth/MFA capability, backup/restore proof, schema/name collision review | Frozen baseline and deployment plan; no rollback | No DDL; none |
| 1 private schema and tables | 0; compare existing names, extensions, ownership; create controls false | Tables private with default-deny RLS and zero app grants; drop only while empty and unexposed | Non-destructive; short catalog locks; planned low traffic |
| 2 constraints/indexes | 1; size and lock estimate, uniqueness/backfill proof | PK/FK/check/index valid; repair forward if populated | Index build/validation may lock; maintenance window if measured |
| 3 county catalog/binding | 0–2; approve source, compare existing county table, canonical hash/version/coverage | 254 complete FIPS and geometry checks, spatial index; quarantine new version on failure | Bulk load and GiST may be heavy; scheduled window |
| 4 Auth/membership adapter | 1–3; verified Auth subject/aal2 behavior and account recovery | Negative spoof/stale JWT/offboarding tests; disable adapter if no accounts | Identity cutover sensitive; low traffic window |
| 5 RLS policies and safe views | 4; full grant inventory, FORCE RLS owner test | Real-role cross-org/direct-write matrix; revoke access to rollback, never weaken RLS | ALTER TABLE locks; schedule |
| 6 agency commands | 5; frozen command contract and dedicated owner | Gate false, 12/24h, review, road_closed separation, replay/stale revision tests; revoke EXECUTE on failure | Function replace short lock; maintain gate false |
| 7 governance | 5–6; verified admins, evidence SOP, independent callback | Verification, revoke/suspend, atomic withdrawal, lost-admin and denial tests; revoke EXECUTE / suspend operations | Data mutation irreversible as history; planned window |
| 8 rate limiting | 6; index and concurrent load benchmark | 60/60m at boundary, multi-session serialization, resolve/withdraw exemption; disable activation on failure | Index and row lock contention; benchmark before pilot |
| 9 consumer projection | 7–8; strict 18-key review and cache design | Gate false yields zero; suspension/expiry/withdraw disappear; disable endpoint or revoke public grant | Public exposure risk; separate launch gate |
| 10 dashboard views/assets | 5–9; aal2 UX, CSP, hosting, no-store | Role matrix, queue/map/inspector identity, access after suspension; take assets offline on failure | App release reversible; no data rollback |
| 11 grants and final verification | All; exact anon/authenticated/admin EXECUTE and schema USAGE diff | Independent security review, clean negative tests, gate=false; revoke grants on failure | Grant DDL short lock; planned low traffic |
| 12 pilot enablement | 0–11 plus B01–B13 closed and separate owner approval | One-org observation and rollback drill; gate false / org suspend on failure | Live publication; explicit release window |

Stages 1–11 can be decomposed into transactional, reviewable migrations after production preflight. Stage 3 data load and any concurrent index require their own transaction plan. A failed or partially populated postlaunch schema is forward-fixed or access-disabled; dropping events, receipts, authority history, or published updates is not an acceptable rollback.

## 5. Existing migration collision inventory

Fourteen tracked Supabase migration files were inventoried; none creates a responder namespace or uses the phase fixture names. **This is not proof of deployed state.** Exact semantic overlaps are: public.gridly_texas_county_boundaries (202607290200, multipolygon EPSG:4326 with county_fips PK, boundary_version and GiST) versus the local responder county catalog; public.reports/community admission and report_retention receipts versus responder's separate agency/governance replay domains; public.historical_incidents, incident_events, incident_recurrence_index and history_capture versus responder update events; public.gridly_feedback versus agency verification/incident reports; and existing public address lookup SECURITY DEFINER/extension search path versus new function ownership/grants. Do not reuse community gate, report rows, replay ledger, retention, or consumer identity for AGENCY_OFFICIAL. Do not replay the tracked prelaunch reset migration as a rollback. Check custom enum/type/function names and actual installed extensions against the live catalog before naming migrations. [Supabase config](../../supabase/config.toml) exposes public and graphql_public; keep agency_private out of Data API exposure and test grants independent of schema exposure. Existing gridly-geocode has verify_jwt=false; it is unrelated and must not be an agency Auth route.

## 6. County geometry and authority governance

The frozen county package declares 254 counties and a 13,934,264-byte canonical source with a recorded hash, but activateRuntimeAuthorized=false and deployAuthorized=false. The local loader validates the Git blob and loads only a disposable database. Working-copy byte count can differ through line endings; validate the canonical blob/version rather than an arbitrary filesystem copy. Production already has a **tracked** public.gridly_texas_county_boundaries migration using PostGIS geometry(MultiPolygon,4326). First inspect its actual deployed completeness, source version, county FIPS uniqueness, geometry validity, point-on-boundary semantics and hash against the frozen responder source. Prefer a single governed geometry source or a versioned private authority binding to that table; duplicate only with a documented reason and synchronization/retirement plan. The local catalog uses Polygon and public.ST_* assumptions, so literal copy is unsafe where PostGIS lives under extensions. One-time load requires 254-row/coverage checks, canonical hash, source_version and immutable authority references, idempotent upsert into a new version, GiST, dry-run, and old-version retention for audit. No live authority grant until owner approves runtime use and independent org/county verification. Replacing geometry must not silently widen existing authority; stale geometry or revoked authority fails closed.

Authority approval requires verified active organization, county scope, independently recorded GRIDLY_ADMIN decision, geometry hash/version, bounded evidence and receipt; revocation increments operation epoch and withdraws affected active posts without erasing history. Suspension does likewise across the org; reinstatement restores access only after current verification/membership/authority checks and never auto-reactivates withdrawn posts. Operator SOP must specify callback to a independently obtained government contact, reviewer separation, evidence minimum, reason codes, rejection/re-review and export. None of that human process is certified by local SQL.

## 7. Replay, rate limit, and consumer projection

Agency and governance command receipts have separate uniqueness domains and immutable token/payload digests. Repeated matching operations return the prior result without a second event; token reuse with changed payload conflicts; transaction failure leaves no false accepted receipt. These ledgers must remain durable at least as long as a replayed operation can be accepted, including after restore. A cleanup job cannot discard replay protection without an owner-approved expiry, archival/rejection rule and restore test. Existing community report_retention cannot be silently applied. Backup/restore must recover *both* receipts and update/governance event history at a consistent point; if not, disable commands and quarantine/reconcile tokens before reopening. The provisional 3/7-year owner figures are not adopted retention policy.

The approved rate is 60 successful activations per org per rolling 60 minutes; resolve/withdraw are exempt. Phase 7 locks the organization row and counts indexed activated_at rows in the same primary database transaction. This serializes an org across app instances and survives app restarts without a cache, assuming all activation writers use the same database boundary. Validate transaction isolation, strict timestamp boundary, deadlock/lock timeout behavior, index selectivity, connection pool load and realistic agency counts before pilot. Alert on rate_limited spikes and high lock wait; never turn a rate-limit error into a partial activation.

The Phase 7 18-key public projection produces AGENCY_OFFICIAL only when the independent agency gate and all current visibility checks pass. The existing [consumer app](../../js/app.js) categorizes official/DriveTexas/TxDOT text into OFFICIAL_ROADWAYS and has no dedicated AGENCY_OFFICIAL pipeline; a literal adapter would merge lineage. Design a separate source family, stable canonical ID, attribution (“Verified Agency” / “Agency update”), condition and expiry behavior for intended Alerts, KBYG, map and Active Issues surfaces. Verify current schema/UX fields individually; no current integration is certified. Withdrawal, suspension, authority loss, expiry or gate-off must remove stale items at the projection and cache layers. Define service-worker and CDN cache invalidation/no-store, bounded polling, and offline behavior before any consumer launch. Consumer exposure has a separate owner gate after pilot.

## 8. Dashboard, invitation, and governance operations

responders.gridlygo.com can likely be a static dashboard using the existing app stack, but actual hosting, subdomain control, build headers, routing, DNS/TLS and plan entitlements are unverified. Verify those before deciding cost. Serve a pinned dependency build rather than copying the current consumer index's major-only CDN supabase-js reference. Require HTTPS, strict CSP and security headers, origin-scoped service worker, no secret/service-role key in client assets, no-store for private data, short bounded sessions and server-authoritative RPCs. The dashboard must never derive eligibility from UI affordances. Production release needs separate asset build/review, rollbackable deployment, Auth redirect allowlist and per-origin cookie/storage testing. Static hosting is suitable if the authenticated API boundary and headers pass; no server-rendered service is intrinsically required by this contract.

No tracked production outbound SMTP or invite delivery proof was found. The privacy documentation's Cloudflare Email Routing is inbound and is not an outbound invitation channel. Owner decisions explicitly call default Supabase SMTP unsuitable for pilot; verify an approved existing SMTP path or separately approve tightly bounded manual pilot onboarding with individual accounts, one-time token handling, out-of-band identity check, expiry, no shared login and audit. Without one of those, live invitations cannot launch. The 7-day invite expiry is provisional. A manual path is an operational exception, not a silent change to email security.

GRIDLY_ADMIN must be a separate individual identity with enforced aal2, least privilege, audit and independent lost-access recovery. Recommend two named governance operators for availability and review separation, with no shared account; the owner must approve staffing and emergency coverage. An admin who also has agency membership must not inherit agency powers through governance identity or vice versa. Before first verification, adopt a written SOP for government directory lookup, independent callback, evidence storage/access, verification/rejection reason, re-review, authority approval, suspension/reinstatement, audit export, and incident escalation. The local Phase 6 workflow is product logic, not proof these operators exist.

## 9. Backup, retention, monitoring, and incident response

Backup scope includes organizations/memberships/invites, verification/governance events and evidence references, county source/version/authority history, updates/events, agency and governance receipts, and program controls. Restore order is Auth identity availability and schema/roles/RLS, county source/version, org/membership/authority, updates/events, both replay ledgers, then projections/dashboard; hold gate=false and API closed until consistency and replay tests pass. Validate PITR/WAL and backup schedules/retention, isolated restore permissions, RPO/RTO and export of append-only evidence. The [LP24421 runbook](../LEGAL/LP24421-RECOVERY-RUNBOOK.md) requires isolated restore and complete independent replay ledger certification; it does not prove current provider backup settings. Never reconnect public reads or commands merely because tables restored.

Legal review must classify organization identity, employee/Auth references, memberships, invites/token hashes, verification evidence, governance events, authorities, public updates/events and both receipt domains. Current legal policy does not state an operative responder retention schedule. Resolve deletion rights, immutable evidence versus erasure, backups, privacy publication, recipient access, export and hold procedures; approve periods before cleanup jobs. The provisional 3-year update-event and 7-year governance/membership figures remain provisional. Keep responder policy separate from community report_retention, and reconcile with the [privacy policy](../LEGAL/GRIDLY-PRIVACY-POLICY.md) publication block rather than treating it as lifted.

Use existing logging/health channels if their live capacity and retention are verified; do not assume a new paid monitor. Minimum signals: command accept/reject/error, rate_limited and lock waits, governance failure, replay conflict, anomalous RLS denials, projection query failures/zero-result expectation under gate-off, stale/changed authority, suspended-org attempts, active update expiry lag, and gate change. Log correlation IDs and result classes, not invite tokens, private verification evidence or full payloads. Test alerts and an on-call owner before pilot; production observability currently unknown.

Emergency controls should independently disable global agency publishing (existing false-by-default gate), suspend one organization, revoke one authority, disable one member, and remove consumer projection exposure while preserving history. Agency gate blocks new public visibility; test whether gate-off also hides existing active rows immediately. A separate global responder kill switch is not justified by current contract if gate-off plus endpoint/grant disablement is independently operable and tested; revisit only if a concrete failure mode remains. Maintain read-only forensic access under incident procedures.

## 10. Rollback, rollout, and pilot

Rollback layers: (1) dashboard assets/route: withdraw build and Auth redirect; (2) projection: gate=false and revoke endpoint/public grant, invalidate caches; (3) agency commands: gate=false and revoke EXECUTE, preserve receipts/events; (4) governance: restrict EXECUTE to emergency operator, preserve suspension/revocation history; (5) RLS: revoke app grants and forward-fix bad policies, **never disable RLS** to recover availability; (6) schema: only drop empty, unexposed additions, otherwise forward-fix and retain immutable history. A backup restore is an incident recovery, not a routine migration rollback. Rehearse each switch under one-organization fixtures before release.

Guarded order: stage 0 live read-only preflight and decision closure; 1 private schema/constraints/county binding with default-deny RLS, no app grants and gate=false; 2 Auth/MFA adapter and individual test identities; 3 scoped RLS policies, safe views and grant-negative tests; 4 commands and replay with gate=false; 5 governance verification, authority and suspension drills; 6 read-only dashboard pilot; 7 consumer projection installed but gate=false and unpublished; 8 separately authorized one verified county agency pilot after cache/incident readiness; 9 bounded expansion only after observed pilot and fresh owner approval. Authority approval must follow certified geometry and human verification; no stage implies publishing approval.

Smallest pilot: one named county-level agency, one certified county, one Agency Admin, one Supervisor, one or two Responders (2–4 distinct agency accounts total), and at least one separate GRIDLY_ADMIN with an independent backup/reviewer. Enforce individual TOTP aal2. Start gate=false with create/edit/submit/return, authority approval, activation denial, rate/replay/stale revision, suspension/restore, withdrawal and rollback dry runs. Before first real active post require B01–B13 closed, second qualified activator for road_closed, owner approval of active-post cap and user cap, monitored rollback, consumer gate decision, legal/privacy acceptance, and explicit owner publishing authorization. The owner register's 2–6 users and 10 active posts are provisional, not live policy.

## 11. Cost and capability dependencies

| Dependency | Local evidence / classification | Verification before spend or release |
| --- | --- | --- |
| Supabase database/Auth/MFA | Existing source dependency; live plan/capability **unknown** | Verify Auth aal2, grants, extension, limits, project plan |
| PostGIS county geometry | Tracked migration; deployed/data state **unknown** | Reuse existing source if equivalent; no duplicate paid store |
| Dashboard hosting | Static consumer exists; responder subdomain support **unknown** | Test current host build, headers, SPA routing and cost |
| DNS and TLS | Desired subdomain only; availability **unknown** | Owner-controlled DNS, certificate and redirect proof |
| Outbound email | No approved SMTP proof; **unknown** | Existing approved SMTP or authorized manual pilot; pricing unverified |
| Monitoring/logging | Prior runbooks, runtime capacity **unknown** | Verify existing channel, alert tests and retention |
| Backups/PITR | Runbook exists; actual entitlement/state **unknown** | Isolated restore and replay proof; pricing unverified |
| MFA enrollment/support | Local design only; operational capacity **unknown** | TOTP/recovery drills and plan check |

No additional paid service is demonstrated as definitely required by local evidence; equally, no existing provider entitlement is certified. Do not buy hosting, SMTP, monitoring or backup add-ons before checking current capacity and an owner-approved manual bounded pilot path where safe.

## 12. Bounded threat review

| Threat | Local control | Production proof and residual risk |
| --- | --- | --- |
| Compromised responder | aal2, current membership, limited role, audit | Validate real MFA/session revocation; attacker may act until detection |
| Compromised Agency Admin | role matrix and invite limit | Separate identity, invite audit and independent org verification; social engineering remains |
| Compromised GRIDLY_ADMIN | separate governance, receipts, audit | Two-person SOP, aal2, emergency lockout; highest-impact residual risk |
| Cross-org read/write | FORCE RLS, current-org checks | Real-role negative tests and view/grant audit; misconfigured definer remains risk |
| Replay or altered retry | token/payload digest and unique receipts | Restore-complete ledger and concurrency tests; backup gap risk |
| Stale JWT / suspension bypass | live checks and operation epoch | Auth adapter must check every command/read; cache lag remains |
| Privilege escalation / direct write | no DML grants, command boundary | EXECUTE/owner/search_path audit and real anon/authenticated matrix |
| Spoofed county / fake authority | polygon and governed approval | Canonical source approval, independent callback and version binding |
| Update flood | 60/60m durable limit | Concurrent load test and alert; distributed clients share DB lock |
| Malicious road closure | independent qualified activator | Verify distinct Auth UUID and current roles/aal2 at activation; collusion residual |
| Dashboard scraping | own-org bounded views and inspector | CSP, no-store, rate/abuse signals; authorized user can still copy data |
| Invite theft | token digest, lifecycle | Delivery/expiry/acceptance proof, out-of-band identity; email compromise risk |

## 13. Exact blockers and owner decisions

| ID | Blocker to production deployment and required closure |
| --- | --- |
| B01 | Verify actual Supabase Auth aal2/TOTP/session claims and implement nonspoofable production identity adapter, enrollment/recovery/offboarding tests. |
| B02 | Live read-only inventory of deployed migrations, roles, grants, RLS, extensions, functions, data, and schema collisions; reconcile with tracked source. |
| B03 | Approve county geometry runtime/deployment source and prove existing boundary table equivalence or versioned replacement, hash, 254 coverage and PostGIS semantics. |
| B04 | Design/review real-role RLS, fixed-path least-privilege function owners and grants; pass cross-org, direct-write, governance and suspended negative matrix. |
| B05 | Select/verify pilot organization and county; staff and rehearse independent GRIDLY_ADMIN verification/authority/recovery SOP. |
| B06 | Approve outbound SMTP or bounded manual onboarding, invite expiry and factor-recovery process. |
| B07 | Verify hosting, responders subdomain DNS/TLS, CSP, secret handling, Auth redirects, deployment and rollback capability. |
| B08 | Approve responder legal/privacy and retention schedules for all data classes, receipts, immutable evidence and backups; reconcile publication block. |
| B09 | Prove backup/PITR entitlement, isolated restore, full agency/governance replay ledger and RPO/RTO, recovery owners. |
| B10 | Implement/review separate AGENCY_OFFICIAL consumer pipeline, cache invalidation and visibility removal; separately authorize consumer launch. |
| B11 | Load-test 60/60m lock/index behavior and verify production monitoring/incident alert owners and kill-switch drills. |
| B12 | Rehearse migration, negative security tests and layered rollback with gate=false; independent security/operations acceptance. |
| B13 | Owner approves named pilot limits, first publishing window and later expansion; keep agency gate false until then. |

**Owner decisions still required:** county source runtime authorization and geometry-reuse choice; named pilot agency/county and human verification approvers; number and recovery coverage of governance admins; invite expiry and approved delivery path; pilot user and active-post caps; responder retention/privacy schedules and evidence handling; hosting/DNS/consumer launch approval; backup RPO/RTO and incident owner; separate authorization for first active publication and expansion. Municipality/SSO/mutual aid/roadway-segment policy remain V2 and are not V1 blockers unless scope changes. Current external service limits, costs and deployed state require evidence, not an assumed owner decision.

The machine-readable [readiness matrix](../../reports/responder/responder-phase9-readiness-matrix.json) maps these gates to deployment phases. Planning may proceed only with the uncertainties explicitly carried; no production implementation, release or publication is certified here.

PRODUCTION IMPLEMENTATION PLANNING: CONDITIONAL GO
