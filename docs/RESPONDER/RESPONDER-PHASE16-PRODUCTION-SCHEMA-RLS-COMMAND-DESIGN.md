# Responder Phase 16 — production schema / RLS / command design

Status: **GO for the Phase 16 production-candidate design; NOT DEPLOYED**
Contract: `responder.agency.v1.phase0.1`
Baseline: `a5beccdfc17ebe9ebc6d1e9baf9dfb37bab51614`
Candidate: [`phase16_production_candidate.sql`](../../db/responder-local/phase16_production_candidate.sql)

## 1. Executive decision

The candidate implements the required production database boundary for the frozen Responder V1 core. It separates private agency authorization and employee evidence from a dedicated 18-column consumer surface, denies direct browser mutations, derives every actor from Supabase Auth, applies the Phase 15A live session/AAL/factor/AMR predicate, derives county authority from the stored point, enforces revision/event uniqueness and two-person `road_closed` activation, and serializes the organization-scoped 60-per-60-minute successful-activation limit.

The architecture verdict is **GO** for design completion and for a separately authorized Phase 17 migration-readiness exercise. It is not approval to deploy, expose the API schema, seed a real organization, create users/grants, or enable publishing. The SQL remains outside `supabase/migrations`; no production connection was used.

Current Supabase guidance was checked on 2026-09-15. The 2026 Data API default change requires explicit grants rather than assuming newly created objects are exposed. The candidate therefore makes every grant explicit, enables RLS on every reachable table, uses `TO` clauses, keeps privileged functions in an unexposed schema with empty search paths, and exposes only security-invoker wrappers. References: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [views](https://supabase.com/docs/guides/database/views), [Data API security](https://supabase.com/docs/guides/api/securing-your-api), and [breaking-change changelog](https://supabase.com/changelog?types=breaking-change).

## 2. Schema map and trust boundaries

`agency_private` is not a Data API schema. It owns identity eligibility, memberships, Gridly grants, county authority, current update pointers, immutable revisions/events, closure approvals, successful-activation evidence, replay receipts, invites, and governance evidence. Managed `auth.*` remains owned by Supabase and is read only through one narrow helper layer; the migration creates no Auth trigger and performs no Auth mutation.

`responder_public` is the only proposed Data API schema. It owns the exact consumer projection table and three `SECURITY INVOKER` wrappers. The wrappers delegate to private `SECURITY DEFINER` commands after PostgreSQL verifies the caller is `authenticated`. `anon` receives SELECT on the consumer table only. `service_role` receives no Responder privilege from this migration.

Community `public.reports`, `report_retention`, `history_capture`, `gridly_control`, DriveTexas, NWS, and community receipts are neither referenced nor altered. `AGENCY_OFFICIAL` is a checked constant.

## 3. Table inventory

| Schema / table | Purpose | Mutable through |
| --- | --- | --- |
| `agency_private.organizations` | Verified/operational organization, per-org publishing gate, operation epoch and governance revision | governance command only |
| `agency_private.principals` | `auth.users.id` binding, active/disabled kill switch, optional integer `minimum_iat` | future governed administration only |
| `agency_private.organization_memberships` | One active organization per user and exact V1 agency role | membership command only |
| `agency_private.gridly_admin_grants` | Separate individual UUID platform grants | future owner-governed administration only |
| `agency_private.organization_county_authorities` | Versioned org-to-county FIPS authorization bound to the certified boundary version | governance command only |
| `agency_private.agency_updates` | Stable update identity and current revision/state pointer | update/governance commands only |
| `agency_private.agency_update_revisions` | Immutable complete snapshot for every accepted update mutation | append only |
| `agency_private.road_closure_approvals` | Immutable distinct creator/approver evidence bound to the pending revision | append only |
| `agency_private.agency_update_events` | One immutable lifecycle event per update revision | append only |
| `agency_private.activation_rate_events` | One immutable row per successful activation for the rolling limit | append only |
| `agency_private.operation_receipts` | SHA-256 UUID-token replay domain and bounded result | append only |
| `agency_private.governance_events` | Bounded before/after governance evidence | append only |
| `agency_private.organization_invites` | Single-use private invite state | membership command only |
| `responder_public.agency_updates` | Exact 18-column public projection | private projection refresh only; public SELECT |

Identity-bearing history stores UUIDs without exposing them publicly. `principals.user_id` is the disposable live Auth binding and cascades when Supabase deletes a user; immutable audit/revision rows deliberately do not FK to `auth.users`, so Auth cleanup cannot erase historical accountability.

## 4. Auth helper design

`agency_private._live_auth_context()` is the only function that reads managed Auth relations. It is `STABLE SECURITY DEFINER`, has `SET search_path=''`, schema-qualifies every non-catalog object, has no dynamic SQL, accepts no parameter, and is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. It returns at most the caller UUID and live session UUID.

It denies unless all of these agree:

1. `auth.uid()` is non-null and equals signed JWT `sub`.
2. `session_id` is present and parses as UUID.
3. signed `aal` is exactly `aal2` and signed `amr` is an array containing `method=totp`.
4. `auth.sessions(id,user_id)` exists for that exact caller and session.
5. live `auth.sessions.aal=aal2` and `factor_id` is non-null.
6. the joined same-user factor is live `totp/verified`.
7. the same session has a live `auth.mfa_amr_claims.authentication_method=totp` row.
8. the private principal is active and, if configured, integer JWT `iat >= minimum_iat`.

Any parse error, managed-schema drift, missing row, stale signed/live disagreement, or cross-user join returns no row. This directly closes Phase 15A’s logout and factor-reset cases: a stale JWT cannot substitute for missing/downgraded managed state.

`current_responder_security_context()` adds one active membership and a verified/active organization and returns only `(actor_user_id, session_id, organization_id, agency_role)`. The partial unique membership index makes the organization singular. `current_gridly_admin_security_context()` instead requires the separate active UUID grant and never confers an agency role.

## 5. RLS matrix

All 13 private tables have RLS enabled and forced. They have no INSERT/UPDATE/DELETE policy and `authenticated` has no private mutation grant. All private reads require a current live Auth context; JWT membership metadata is never consulted.

| Surface | `anon` | Agency member | Supervisor/Admin | `GRIDLY_ADMIN` |
| --- | --- | --- | --- | --- |
| organization / authority | none | own active org | own active org | all for investigation |
| principal | none | self | self | all for investigation |
| memberships | none | self | own roster | all for investigation |
| update current rows | none | own org; Viewer excludes drafts/review | own org | all for investigation |
| revisions/events | none | Responder’s authored rows only | own org | all for investigation |
| closure/rate evidence | none | none | own org | all for investigation |
| receipts | none | caller’s own | caller’s own | all for investigation |
| governance evidence/invites | none | none | Agency Admin own org | all for investigation |
| consumer projection | eligible rows | eligible rows | eligible rows | eligible rows |

The public table has RLS enabled and forced. Its SELECT policy calls a narrow boolean eligibility helper that rechecks the private current revision, activation lineage, organization/gate/authority, strict geometry, and derived expiry. This deliberately avoids a creator-privileged view and avoids granting consumer roles any private-table SELECT.

## 6. RPC and role matrix

The three exposed wrappers are `SECURITY INVOKER`; the private implementations alone are `SECURITY DEFINER`. All reject unknown envelope/payload keys, bound payloads, actor fields, county/authority selectors on update commands, invalid UUIDs, stale revisions, and hidden cross-org targets with bounded statuses.

| Private implementation | Core actions | Required identity |
| --- | --- | --- |
| `agency_update_command(jsonb)` | create/edit draft, submit/return, non-closure/closure activation, active edit, renew, resolve, withdraw | live responder context and exact role |
| `agency_membership_command(jsonb)` | invite/redeem, role change, suspend/reactivate/revoke member, revoke invite | live Agency Admin or separately authorized Gridly oversight; invitee redemption uses live TOTP context |
| `agency_governance_command(jsonb)` | review/verify/reject/revoke verification, activate/suspend/reinstate org, approve/revoke county authority, change publishing gate | live separate Gridly Admin context |

Role enforcement is frozen: Viewer cannot mutate; Responder can create/edit/submit own work and withdraw own unpublished work; Supervisor and Agency Admin can review, activate, edit active, renew, resolve, and withdraw; Agency Admin manages membership; Gridly Admin governs but cannot call update publication as an agency member.

Manual verification requires bounded evidence, an explicit official-callback assertion, and an already active private `AGENCY_ADMIN` principal. Gate enablement requires a recorded owner-authorization UUID. All gates default false.

## 7. Lifecycle, transaction and replay semantics

Every accepted update command inserts one complete immutable revision, advances the current pointer by exactly one, inserts exactly one event with the same `(update_id,revision)`, and inserts its receipt in the same statement transaction. The deferred current-revision FK permits create to insert the stable row and revision atomically. Unique constraints reject duplicate revisions and events. Unexpected exceptions execute inside the PL/pgSQL exception subtransaction and return only `retryable_failure`; partial state/event/receipt writes are rolled back.

Receipts hash canonical UUID bytes with SHA-256 and separately hash the canonical JSON request with `operation_token` removed. Exact replays return `already_processed`; token reuse with a changed actor, org, action, target, or payload returns `invalid_request`. Only accepted mutations receive a receipt.

Stored states are exactly `draft`, `pending_review`, `active`, `resolved`, and `withdrawn`. Expiry is derived. The update command denies edits/renewals after effective expiry and no Cron is created.

## 8. Two-person `road_closed`

Creation records the creator’s Auth UUID and then-live session UUID after the complete live TOTP predicate. Activation requires a different current Supervisor/Agency Admin Auth UUID, another complete live TOTP predicate, an active same-org creator principal/membership, verified active organization, enabled gate, current strict county authority, pending revision, and quota availability.

The immutable approval row has `creator_user_id <> approver_user_id`, unique `(update_id,pending_revision)`, a FK to that pending revision, and the approver session/time. The activation event requires an approval FK by CHECK constraint. Replays cannot add an approval, and a second activation is denied after the state advances. Email is never used for uniqueness.

## 9. County authority

The migration preflight requires exactly 254 nonempty valid EPSG:4326 MultiPolygons in `public.gridly_texas_county_boundaries`; the production column is correctly named `geom`. Authority approval stores the current certified `boundary_version` and county FIPS. Update callers cannot send a county FIPS or authority ID. The server derives the only matching current authority with:

```sql
extensions.ST_Contains(county.geom, submitted_point)
```

`ST_Contains` provides strict interior semantics: the exact boundary is false. There is no `ST_Covers`, nearest-county fallback, tolerance, buffer, PLACE point, municipal scope, or caller override. The test suite proves exterior denial, exact-edge denial, and interior acceptance.

## 10. Activation lineage and rate limit

An active revision carries its historical `activation_revision`. Consumer eligibility requires that historical event to be `update_activated` or `road_closure_activated` from `pending_review` to `active`, and requires the current revision’s event to be activation, `update_edited`, or `update_renewed` with matching authority. Missing or contradictory lineage hides the row.

Every activation first locks the organization row. It then counts `activation_rate_events` in the strict interval `(server_now - 60 minutes, server_now]`. At 60, the next activation returns `rate_limited` before any revision/event/receipt write. The successful activation and rate row commit together; failures never count. The composite `(organization_id, activated_at DESC)` index supports the window. Resolve and withdraw do not execute the rate check, proven at quota.

## 11. Consumer projection and privacy

`responder_public.agency_updates` has exactly these 18 columns, in frozen order:

`update_id`, `organization_public_name`, `approved_department_name`, `verified_agency`, `verified_agency_label`, `condition_type`, `impact_level`, `title`, `detail`, `location`, `road_name`, `cross_street`, `crossing_id`, `source_family`, `activated_at`, `updated_at`, `expires_at`, `display_lifecycle_state`.

The row contains no employee name/email, Auth UUID, role, session/factor identifier, authority metadata, receipt digest, review evidence, or audit snapshot. `source_family`, badge values, and lifecycle label are checked constants. Active commands refresh the row atomically; terminal commands remove it. RLS still rechecks current eligibility at read time, so gate disable, suspension, revocation, lineage damage, authority expiry, strict-geometry failure, or `expires_at <= now()` immediately hides it. A non-null `crossing_id` remains fail-closed for publication until a separately governed production crossing registry exists.

## 12. Audit evidence

Revisions, closure approvals, update events, rate events, receipts, and governance events have statement-level triggers that reject UPDATE, DELETE, and TRUNCATE even for accidental owner operations. Normal roles also lack mutation grants and policies. Evidence stores the actor UUID, organization UUID, target/revision, server timestamp, action, bounded before/after state, and operation correlation without raw credentials, tokens, TOTP data, email in event rows, or unbounded request bodies.

## 13. Rollback and recovery

[`phase16_production_candidate_rollback.sql`](../../db/responder-local/phase16_production_candidate_rollback.sql) is a pre-activation-only rollback. It refuses to proceed if any principal, organization, membership, Gridly grant, update, receipt, or governance evidence exists. Only after that proof does it drop `responder_public` and then `agency_private`. The disposable suite proves the empty rollback.

Once real data or evidence exists, destructive rollback is prohibited. Recovery becomes a forward migration: force every organization gate false, revoke exposed wrapper EXECUTE if necessary, preserve/export immutable evidence, correct the fault, rerun RLS/security tests, and only then consider re-enablement under separate authorization. Community schemas and gates are never rollback targets.

## 14. Production deployment prerequisites

Phase 17 may perform migration readiness, but not deployment, after it:

1. creates a real migration filename through the installed Supabase CLI rather than copying this candidate directly into history;
2. rechecks that both schemas are absent and the certified county table is still 254 valid EPSG:4326 MultiPolygons with the expected boundary version;
3. pins the current managed Auth columns/enums used by the helper and reruns stale-session/factor-reset cases;
4. confirms Data API exposed schemas include only `responder_public`, never `agency_private`;
5. validates in a production-version staging clone (PostgreSQL 17.6/PostGIS 3.3.7); the local proof used PostgreSQL 17.10/PostGIS 3.6.2;
6. runs Supabase security and performance advisors after applying to non-production;
7. confirms all organization publishing gates remain false and no real principal, membership, invite, grant, or update is seeded;
8. obtains separate owner authorization for deployment and later, separate pilot/gate enablement.

The broader claimant onboarding, public-name profile approval, lost-admin recovery, and governed crossing-ID resolver remain closed surfaces rather than permissive placeholders. They must receive separate command designs before those product features are enabled; their absence does not weaken the implemented core.

## 15. Verification result and explicit non-deployment statement

The disposable harness created isolated localhost clusters under the Windows temporary directory, applied the test-only Auth/county bootstrap and candidate, executed **38/38 security vectors** and **22/22 structural database checks**, verified empty pre-activation rollback, stopped PostgreSQL, and deleted the clusters. Required vectors 1–36 all passed; vectors 37–38 additionally prove exact replay and mismatched replay behavior.

No production read or write was performed. No production migration, schema, function, table, policy, role, grant, user, Auth row, responder row, community row, gate change, publication, push, or merge occurred. The protected LP244.26 worktree was not touched.
