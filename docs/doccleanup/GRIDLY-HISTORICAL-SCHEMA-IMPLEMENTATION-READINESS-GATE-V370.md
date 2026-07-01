# V370 — Historical Schema Implementation Readiness Gate

## 1. Executive Summary

V370 decides whether historical schema implementation may begin in a later milestone.

No implementation is approved here.

This milestone is a documentation-only readiness gate for determining whether future additive Supabase schema implementation is safe to draft. It does not create schema, migrations, app integration, production reads, production writes, historical reads, historical writes, history UI, lifecycle changes, alerts, awareness changes, marker changes, Route Watch changes, or DriveTexas activation.

Current readiness context:

- V363 — Readiness Gate is complete.
- V364 — Shadow Historical Pipeline Foundation is complete.
- V365 — Historical Projection Validation & Fixture Parity is complete.
- V366 — Runtime Hardening is complete.
- V367 — Shadow Enablement Test is complete.
- V368 — Merge Baseline is complete.
- V369 — Additive Historical Incident Schema Design is complete.
- Shadow projection exists.
- Forced enablement passed.
- Drift state is `none`.
- Production safety remains isolated.
- Additive schema design exists.
- Current data is fake/test-generated.
- There is no current-history preservation requirement.
- DriveTexas remains paused.

## 2. Readiness Questions

| Question | V370 answer |
| --- | --- |
| Is schema design additive? | **YES.** The V369 design is additive and keeps future historical tables beside the existing production evidence model. |
| Can schema be added without production reads? | **YES.** Future schema can be created without changing any app read path or production query dependency. |
| Can schema be added without production writes? | **YES.** Future schema can be created without changing current report submission, production write paths, or lifecycle writes. |
| Can rollback avoid data restoration? | **YES.** Because the future schema boundary is additive and current production paths must not depend on it, rollback should not require production data restoration. |
| Can current test data be ignored? | **YES.** Current rows are fake/test-generated artifacts and do not require preservation or backfill. |
| Can historical writes remain disabled? | **YES.** Historical writes must remain disabled until a future milestone separately approves them. |
| Can history UI remain disabled? | **YES.** History UI must remain disabled until a future milestone separately approves history reads and UI exposure. |
| Can DriveTexas remain paused? | **YES.** DriveTexas remains paused and is not part of this readiness gate or any additive schema-only implementation. |

## 3. Minimum Safe Implementation Boundary

If future implementation proceeds, it may only:

- Create additive tables.
- Create indexes.
- Create RLS policies.
- Create documentation.
- Create SQL validation scripts.

It may **NOT**:

- Change app read paths.
- Change app write paths.
- Enable historical writes.
- Enable history UI.
- Migrate or backfill current reports.
- Change lifecycle behavior.

## 4. Required Future Feature Flags

The following are future flags only and are not implemented by V370:

```text
GRIDLY_ENABLE_HISTORICAL_WRITES = false
GRIDLY_ENABLE_HISTORY_READS = false
GRIDLY_ENABLE_HISTORY_UI = false
```

Future milestones must keep these disabled unless a separate approval explicitly changes the boundary.

## 5. Rollback Strategy

Since the historical schema must remain additive, rollback should be:

- Disable feature flags.
- Leave unused tables in place, or
- Drop new tables only if no production dependency exists.

No production data restoration should be required.

Rollback must not require rewriting current reports, changing live lifecycle state, restoring production reads, restoring production writes, reactivating DriveTexas, or repairing UI behavior because future additive schema must not become a production dependency.

## 6. Supabase Readiness Requirements

Before implementation, require all of the following:

- Migration file reviewed.
- Table names approved.
- RLS policies reviewed.
- Indexes reviewed.
- No app dependency confirmed.
- No production query dependency confirmed.
- Dry-run SQL reviewed.
- Rollback SQL drafted.

These requirements are prerequisites for a later migration-draft milestone and are not satisfied by V370 alone.

## 7. Security / RLS Requirements

Future RLS expectations:

- App clients should not freely write historical tables unless explicitly approved.
- Historical write access should be controlled.
- Read access should remain disabled until future history UI approval.
- Source report IDs should not expose sensitive device information.
- `device_hash` should remain non-identifying.

Any future policy must be reviewed before migration execution and before any historical read/write feature is enabled.

## 8. No Backfill Decision

No backfill is required for current rows.

Current rows are test artifacts.

Future historical storage may start fresh after schema is ready.

Backfill of current reports is not part of V370 and should not be introduced into the next additive-schema-only milestone.

## 9. Validation Gates Before Implementation

Before implementation, require:

- **Gate A — migration review:** Review the exact migration file before execution.
- **Gate B — rollback review:** Review rollback SQL and confirm it avoids production data restoration.
- **Gate C — RLS review:** Review all historical table RLS policies and client access assumptions.
- **Gate D — no-production-read verification:** Confirm app read paths and production queries do not reference historical tables.
- **Gate E — no-production-write verification:** Confirm app write paths do not insert, update, or delete historical rows.
- **Gate F — browser smoke test plan:** Define a smoke test plan proving current UI behavior remains unchanged.
- **Gate G — Supabase table inspection plan:** Define post-migration table and policy inspection steps.
- **Gate H — shadow projection compatibility check:** Confirm shadow projection outputs remain compatible with the future schema without enabling writes.

## 10. Go / No-Go Decision

V370 decision: **GO for V371 only if V371 remains additive-schema-only.**

Do not proceed to historical writes.

Do not proceed to historical reads.

Do not proceed to history UI.

If V371 attempts app integration, write-path enablement, read-path enablement, UI exposure, lifecycle coupling, report backfill, or DriveTexas activation, the decision becomes **NO-GO**.

## 11. Recommended Next Milestone

Recommended next milestone:

**V371 — Additive Historical Schema Migration Draft**

V371 should still have no app integration. It should draft additive schema migration artifacts, SQL validation scripts, and rollback SQL for review without enabling historical reads, historical writes, or history UI.

## 12. Explicit Non-Approvals

V370 does **NOT** approve:

- Schema implementation in this milestone.
- Migrations in this milestone.
- Production reads.
- Production writes.
- Historical writes.
- Historical reads.
- History UI.
- Lifecycle changes.
- DriveTexas activation.
