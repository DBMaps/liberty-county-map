# Phase 28 — Dayton multi-department pilot hardening

**NON-PRODUCTION. PLANNING ONLY. No deployment authorization.**

Starting branch: `RESPONDER-PHASE28-dispatch-dayton-multidepartment-pilot-hardening`.
Starting HEAD: `4f89805ed836ab6e73dc383d99a2f24d55d83f5f`. The September 21 continuation started with untracked Phase 28 artifacts already present; it did not start with a clean working tree. Existing artifacts were preserved and reviewed.

## Decision and scope

Gridly Dispatch remains a neutral operational-awareness platform. Dayton, Texas is configuration, never schema policy. Public Works is first; Dayton Police Department is the second intended participant. The owner reviews each department individually. No real organization, personnel, or city official is seeded. The machine-readable configuration is `tools/responder/phase28/dayton-pilot.json` and is PLANNING with consumer publication disabled.

The current owner request approves the Phase 27 commercial/engineering choices for this local phase. It does not provide legal retention approval, an exact invitation origin/provider, real departmental legal structure, authoritative Dayton scope evidence, named recovery staff, production inventory, or production access. Those Phase 27 production prerequisites remain closed gates; they do not require contacting production to perform this local exercise.

## Architecture

Auth user → profile → live organization membership → fixed role permissions → operational scope → optional explicit unit membership → private operational record → immutable evidence. Selected organization/unit remains display/session context only. Server authorization rechecks AAL2, a same-user verified TOTP factor, live session/user/profile, membership, permission, scope and owning organization/unit. Unit type grants no access.

The five roles, four record types, six record states, and four source classes remain unchanged. Unit administration, internal sharing, and internal reading are organization permissions, not sector roles. Platform permissions do not imply tenant membership. Organizational ownership does not imply unit-private record access.

Two distinct projection paths exist:

1. Private record → authorized internal share decision → separately supplied, reviewed title/summary → explicit same-organization recipient units.
2. Private record → consumer candidate → independently reviewed sanitized payload → public-safe projection guarded by live capability, scope, source/version, verification and expiry.

Internal recipients never gain source access or publication permission. Consumer candidates have no direct anon/authenticated column grants. Public views expose only their exact underlying columns. No permanent responder compatibility wrapper is manufactured. Populated/referenced legacy state requires a separate migration-only plan; this package only installs into an empty synthetic baseline.

## Artifact map

| Artifact | Purpose |
|---|---|
| `phase28/dayton-pilot.json` | Approved decisions and inert pilot configuration |
| `PHASE28-ORGANIZATION-UNITS.md` | Organization/unit model, ownership and permissions |
| `PHASE28-INTERNAL-SHARING.md` | Separate internal projection contract |
| `PHASE28-ONBOARDING-RUNBOOK.md` | Owner-led activation, renewal and offboarding |
| `PHASE28-LAW-ENFORCEMENT-SAFETY.md` | Prohibited data and operational-awareness boundary |
| `PHASE28-RETENTION-BASELINE.md` | Non-legal retention model and deletion requirements |
| `PHASE28-AUTHORIZATION-MATRICES.md` | RLS, sharing and publishing matrices |
| `PHASE28-CONSUMER-INVALIDATION.md` | Live invalidation, cache and offline lease requirements |
| `phase28/extension.sql` | Additive local schema/command hardening |
| `phase28/build-package.mjs` | Hash-guarded deterministic package assembly |
| `phase28/run-clone-rehearsal.ps1` | Unlinked loopback Auth/PostgreSQL rehearsal and teardown |
| `phase28/rehearsal-runtime.test.mjs` | Real JWT/TOTP, unit isolation, sharing and publishing tests |
| `tests/responder-phase28-dayton-pilot.test.mjs` | Configuration and engineering policy tests |

## Security and migration design

Historical Phase 21–27 artifacts are not edited. The manufacturer pins the Phase 26 apply hash and composes its baseline and Phase 28 extension into one transaction. Historical broad privileges cannot become externally visible between those steps. Generated SQL is local-only and outside `supabase/migrations`. The install guard rejects a missing synthetic marker and populated Dispatch baseline. There is no supported production execution path.

The dedicated command owner retains NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/BYPASSRLS. It owns functions only. Its schema CREATE and temporary installer membership are revoked; table privileges are enumerated, not wildcard grants. New tables use ENABLE/FORCE RLS. Identity helpers are invokers reading the verified PostgREST request claims directly, avoiding grants on the reserved Auth schema. They never trust user_metadata or client-selected context. `has_live_aal2()` is the only postgres-owned definer; it has no parameters, returns only boolean, and reads reserved Auth state without exposing rows. All definers pin an empty search path.

Commands serialize against the owning organization, validate live access before receipt replay, use idempotency hashes and expected revisions, and append event evidence atomically. Failed commands roll back both mutation and evidence. Actor tokens are random and organization-specific. Completed user offboarding converts historical raw actor references, preserves evidence, and destroys the private identity mappings.

The closure covers the complete forty-command inventory, including missing/stale revision rejection, atomic evidence, explicit replay behavior, membership transitions and live authority loss. The machine-readable command certification records each applicable check and explains each non-applicable dimension.

The closure dispatcher supersedes the blocked recovery implementation. A protected transaction context lets the sole no-argument boolean Auth bridge revalidate both bound approvers without direct Auth table grants. Recovery requires distinct platform actors and five-minute TOTP freshness; transfer requires two bound members and ten-minute freshness. Consumed approval replay is denied. The old partial dispatcher is not executable by client roles. See `PHASE28-IMPLEMENTATION-CLOSURE.md` for the security design and the final execution report for certification.

The closure suite covers recovery, scoped historical actor conversion, all inherited commands, lifecycle transitions, renewal, offboarding and enum/runtime equivalence. Its machine-readable certification must pass before completion; a passing subset is never sufficient.

## Sources and version considerations

The [Supabase changelog](https://supabase.com/changelog?types=breaking-change) was checked for Data API exposure, Postgres 17, and reserved-schema changes. The runner explicitly chooses exposed schemas and uses the local stack's actual catalog. [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) distinguishes privileges from row filtering; [function guidance](https://supabase.com/docs/guides/database/functions) supports pinned definer search paths and explicit execute grants. Real TOTP enrollment and verification follow [Auth MFA](https://supabase.com/docs/guides/auth/auth-mfa). These references do not certify this package or any production configuration.

## Noninterference and acceptance

No consumer runtime, reporting activation, Android/iOS package, DriveTexas/weather/alerts/crossings/POI/Know Before You Go, `public-site/`, website HTML/CSS, Cloudflare, or production resource is in scope. SQL uses synthetic consumer/reporting sentinels to detect local interference. Final repository path audit is separate from that database check.

The baseline Phase 25 test reports a pre-existing SHA-256 mismatch for `tools/responder/phase25/owner-decisions.md`: committed content hashes to `d2d23b110f9b429e792fce724e6cc0f8c28a7b405b48425f4b5621e4b36db015`, while the historical manifest expects `2d5dec57d4205cf8a59c0740d10f6f295de33e951640d2549aaee08768b2e571`. The baseline was verified using `git show HEAD:path`. Historical certification was not rewritten to conceal the failure.

The final owner request accepts the conclusively proven historical Phase 25 mismatch as `KNOWN_PREEXISTING_NON_PHASE28_FAILURE`. It is not repaired or counted as a Phase 28 regression. Commit still requires every Phase 28 implementation/security gate, zero new regressions and zero unexplained failures. See the final execution report and acceptance-gap document.
