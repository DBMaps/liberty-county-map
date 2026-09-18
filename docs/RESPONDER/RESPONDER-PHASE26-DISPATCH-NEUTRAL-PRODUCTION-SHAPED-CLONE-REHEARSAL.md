# Gridly Dispatch Phase 26 — Neutral Production-Shaped Clone Rehearsal

**LOCAL DISPOSABLE REHEARSAL ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

## 1. Executive Summary

Phase 26 manufactured the Phase 25 design into an executable local package and rehearsed it on an unlinked, loopback-only Supabase stack using synthetic data. Preflight, apply, exact catalog postflight, real Auth/TOTP/AAL2, RLS, all 26 command names, concurrency, compatibility, failure injection, empty rollback, clean reapply, evidence-bearing rollback refusal, certification, and teardown passed. Production interaction was zero.

## 2. Clone Strategy

The runner initialized a random temporary Supabase project under the OS temporary directory, verified absence of link metadata, used a dedicated Docker bridge bound to `127.0.0.1`, and removed all state in `finally`. A disposable migration created only `dispatch_api` so PostgREST could start with the intended exposed-schema list; the runner dropped that stub before preflight, leaving zero Dispatch objects at baseline.

## 3. Production-Shaped Baseline

The baseline used PostgreSQL 17.6 and the local Supabase Auth schema/roles. Synthetic sentinels represented Consumer Gridly and disabled reporting. Baseline evidence recorded `auth`, `public`, `gridly_rehearsal`, and `report_retention`, one consumer row, zero Auth users, and reporting disabled.

## 4. Package Manufacturing

The package under `tools/responder/phase26` contains executable baseline, preflight, apply, seeds, compatibility, postflight, rollback, failure stages, runtime tests, catalog certification, and lifecycle runner. It remains outside `supabase/migrations` and contains no production endpoint or credential.

## 5. Preflight Results

PASS: exact local marker, `postgres` database/principal, zero Dispatch collisions, Auth facilities, pgcrypto, API roles, synthetic-only baseline, consumer sentinel, disabled reporting, and rollback artifact presence were established. Mismatch raises `PHASE26_STOP`.

## 6. Apply Results

PASS: the ordered transaction created roles/schemas, 23 types, 22 tables, constraints/indexes, deterministic seeds, helpers, forced RLS, 17 policies, 26 private command functions, 26 API wrappers, compatibility views, and explicit grants. Apply was followed by a PostgREST schema reload notification.

## 7. Schema / Catalog Results

PASS: four schemas, 23 enums, 22 tables, 64 functions, and 17 policies exactly matched Phase 25 counts. All 22 storage tables had RLS enabled and forced. Five roles and 26 permissions were seeded.

## 8. Auth / MFA Results

PASS: seven canonical local Auth users were created through GoTrue, enrolled real TOTP factors, completed challenge/verification, and received AAL2 sessions. AAL1 failed the protected command. Live session/user/factor/profile checks guarded commands; factor removal denied the next request. Supabase documents `aal2` and verified factor handling separately, matching this layered check ([MFA](https://supabase.com/docs/guides/auth/auth-mfa)).

## 9. RLS Results

PASS: owner visibility was tenant-bounded, cross-organization reads/writes failed, VIEWER writes failed, suspended membership failed, removed factor failed, and anon could not read private records. Authorization used live membership, organization, permission, and Auth evidence.

## 10. Command Results

PASS: receipts contained all 26 designed command names. Functional vectors covered record create/update/assign/close; invite/revoke/accept and membership state; ownership transfer; capability grant/suspend/revoke; projection submit/approve/reject/publish/withdraw; recovery; and organization verification/status. Exact replay returned stored output, payload mismatch failed, and failed commands produced no success receipt.

## 11. SECURITY DEFINER Results

PASS with documented deviation: every definer pinned empty `search_path`, all internal references were qualified, PUBLIC/anon/service-role execution was revoked, browser grants were allowlisted, and no runtime dynamic SQL existed. A NOLOGIN BYPASSRLS function owner was necessary for command writes to forced-RLS tables. Three Auth bridge functions remain `postgres`-owned because local Supabase reserves `supabase_auth_admin` memberships. Supabase recommends pinned search paths and explicit execute revocation for definers ([Database Functions](https://supabase.com/docs/guides/database/functions)).

## 12. Concurrency Results

PASS: concurrent record update, invitation acceptance, ownership acceptance, capability revocation, and projection approval each produced exactly one safe winner. Idempotency used a transaction advisory lock, while row predicates and uniqueness constraints prevented duplicate terminal state.

## 13. Invitation Results

PASS: a digest-only invitation bound to the canonical Auth UUID, wrong-user acceptance failed, the correct AAL2 user accepted, and that identity held memberships in two organizations. A separately pending invitation was revoked through the wrapper.

## 14. Ownership / Recovery Results

PASS: normal transfer required recipient acceptance and preserved exactly one active owner. Recovery required two distinct platform users, an unchanged organization revision, and restored the target membership without granting platform actors tenant publisher identity.

## 15. Capability / Scope Results

PASS: COUNTY and ROUTE scope rows coexisted; a platform actor granted, suspended, and revoked a scope-bound capability. Wrong-tenant command access failed, and capability revocation removed projection eligibility.

## 16. Private Record Results

PASS: a HAZARD record stored private JSON, revisions 1 and 2 were immutable, assignment was tenant-qualified, stale concurrent revision failed, and closure used the expected revision. Static enums preserve all four record types and six lifecycle states; the runtime selected representative behavior rather than duplicating identical transitions for every enum value.

## 17. Projection Results

PASS: private record → candidate → approval → sanitization → public projection succeeded. `internal_notes` never crossed the boundary. Organization suspension, scope suspension, grant expiry/revocation, source revision change, terminal record state, and withdrawal each removed anon-visible eligibility.

## 18. Compatibility Results

PASS: the compatibility view returned exactly 18 fields, retained stable identifiers, used the neutral eligible projection, and could not bypass neutral authorization or resurrect invalidated data.

## 19. Consumer / Reporting Non-Interference

PASS: the consumer sentinel remained one row, its policy/schema were untouched, and reporting remained disabled before and after apply, rollback, reapply, runtime vectors, and rollback refusal. No application source was changed.

## 20. Data API Exposure

PASS: local PostgREST exposed `dispatch_api` in addition to existing local schemas. `dispatch_private`, `dispatch_audit`, and `dispatch_projection` were absent from the exposed list. Current Supabase behavior requires explicit grants/configuration for Data API reachability, independently of RLS ([API security](https://supabase.com/docs/guides/api/securing-your-api)).

## 21. Grants / Revokes

PASS: PUBLIC had no Dispatch function execution; anon was limited to public-safe/compatibility reads; authenticated received explicit views/wrappers and guarded private implementation execution; service_role received no command grant. Underlying projection SELECT/USAGE grants are required by security-invoker views but remain unreachable through unexposed schemas.

## 22. Postflight Results

PASS both after initial apply and clean reapply, and again after evidence-bearing rollback refusal. Postflight failed closed on count, forced-RLS, search-path, PUBLIC execute, seed, consumer, or reporting drift.

## 23. Catalog Certification

The canonical sorted catalog SHA-256 is `072df764dcb20eb0317990a5091befaf219d0a90c122b2c1a4a6750478e02d33`. The committed evidence includes schemas, tables, enum types, function signatures, policies, and sentinel state.

## 24. Failure Injection Results

PASS: controlled failures at type/table, RLS, command, and grants stages rolled back their transactions. No failure schema/table/function/grant residue remained and consumer/reporting sentinels were unchanged.

## 25. Pre-Data Rollback Results

PASS: after first postflight and before Auth/Dispatch data, rollback removed all Dispatch schemas/functions/types/tables/policies/grants and the custom role. Preflight then passed again with zero collision.

## 26. Real-Data Rollback Simulation

PASS: after synthetic evidence existed, rollback raised `PHASE26_ROLLBACK_REFUSED`, preserved schemas/data/audit/receipts, and required freeze/forward repair. Postflight still passed afterward.

## 27. Reapply Results

PASS: the package reapplied after clean empty rollback with identical exact counts, deterministic seeds, no duplicate objects, and the certified final catalog.

## 28. Teardown Results

PASS: remaining Phase 26 containers, networks, temporary databases, project directories, Auth state, and remote connections were all zero. Docker Desktop remained running.

## 29. Deviations

Three deviations are explicit: the forced-RLS command owner requires BYPASSRLS; three Auth bridge definers remain `postgres`-owned due reserved Auth ownership; and security-invoker API views require underlying SELECT/USAGE grants while private schemas remain unexposed. Also, runtime exercised representative record/scope enum values rather than every equivalent value. These require owner acceptance before guarded package preparation.

## 30. Owner Decisions Remaining

All 11 Phase 25 owner decisions remain open. Additionally, owners must approve the function-owner model, the three Auth bridges, and the unexposed underlying grants. No production preparation should begin until those security decisions and compatibility mode are closed.

## 31. Production Readiness Assessment

The design is technically rehearsable and its main security/rollback invariants passed, but it is not ready for production deployment. The findings require owner/security review and a hardened package-preparation phase. No production connection, credential, migration, Auth user, RLS change, consumer change, reporting change, or deployment occurred.

## 32. Phase 27 Recommendation

Recommend option **B: owner-decision closure**, followed by guarded package preparation only after the three rehearsal deviations are explicitly approved or redesigned. Suggested branch: `RESPONDER-PHASE27-dispatch-neutral-owner-decision-closure`. Do not deploy from Phase 26.
