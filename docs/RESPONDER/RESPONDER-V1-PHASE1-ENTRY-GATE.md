# Responder / Agency Phase 1 entry gate

Contract version: `responder.agency.v1.phase0.1`. Phase 1 is **local/disposable private agency schema only**. This document is not authorization to create it. Owner approval of this package is required before a separately scoped implementation mission begins.

## Required Phase 0 exit evidence

1. All nine `docs/RESPONDER` contract files, two non-executing vector inventories, and the county manifest exist, parse where applicable, and link to valid repository paths.
2. Zero unresolved role/action, actor-class, gate, authority, state-transition, or command-status contradictions. Every vector action and role maps to the frozen contracts; all named states and expected statuses are bounded.
3. The county manifest contains exactly 254 unique, sorted Texas FIPS codes and 254 nonempty unique county IDs; every county has a `Polygon` with closed finite coordinate rings. Its canonical Git-blob SHA-256 equals the repository geometry manifest. The checkout line-ending difference is documented, not normalized by editing the source.
4. The exact public field allowlist and private denylist are disjoint and frozen. A synthetic private-field leak vector and source-family spoof vectors remain in the negative inventory.
5. Positive and negative vector IDs are unique, complete, deterministic, and non-executing. No secret, production row, account, or real pilot agency appears.
6. Owner decisions are classified `APPROVED`, `PROVISIONAL`, or `DEFERRED` accurately. Provisional 2–6 users/10 updates, invite expiry, and retention do not become policy by entering Phase 1.
7. No agency command reuses community `public.reports`, replay evidence, device links, `reporting_enabled`, or device identity. Existing community protocol-v2, privacy/retention, source separation, and owner export/archive boundaries remain intact.
8. The next mission needs **no production dependency**. Its local fixture target is PostgreSQL **17.10** plus PostGIS **3.6.2**, matching the installed local `psql` version and extension control-file default observed during Phase 0. Availability of a disposable instance and extension must be checked in that next mission before SQL runs.
9. `git diff --check`, JSON parsing, documentation link/path checks, conflict-marker scan, and sensitive-content scan pass. The pending LP244.26 popup worktree remains untouched and no Phase 0 file is staged/committed.

## Exact next implementation mission after approval

Create an isolated, disposable **private agency schema fixture only** with the ten logical table contracts, keys, enum/state checks, append-only event guards, independent gate default false, and local RLS deny-by-default skeleton. Use synthetic organization/user/geometry records and local PostgreSQL 17.10/PostGIS 3.6.2. Test schema creation and rollback, uniqueness, immutability, one-active-org rule, and zero client grants. Do **not** connect to Supabase, alter production, create Auth users, expose Data API tables, implement commands or dashboard UI, activate county authority in runtime, enable either reporting gate, or deploy. A later owner gate controls each of those separately.

The county geometry remains a proposed local fixture source. Its existing manifest authorizes package generation only, not responder production use. Municipal/district authority remains out of scope.
