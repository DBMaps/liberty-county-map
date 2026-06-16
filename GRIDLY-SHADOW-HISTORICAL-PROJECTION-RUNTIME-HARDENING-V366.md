# V366 — Shadow Historical Projection Runtime Hardening

## Runtime hardening strategy

V366 hardens the shadow historical projection runtime without changing production reads, production writes, lifecycle behavior, alert behavior, awareness behavior, marker behavior, Route Watch, DriveTexas, or schema requirements.

The runtime hardening adds audit-only diagnostics around the existing shadow projection builder:

- repeated generation from one source snapshot;
- deterministic projection snapshot creation;
- drift comparison between repeated generations;
- projection health reporting;
- parity audit confidence fields that include runtime stability and determinism.

All V366 behavior is diagnostic and shadow-only. It does not approve any production integration.

## Determinism validation

`window.gridlyHistoricalProjectionRuntimeAudit?.()` builds the projection twice from the same source state and the same fixed audit timestamp. It validates that repeated generation produces identical:

- projection identities;
- projection counts;
- grouping behavior;
- timestamp normalization.

The audit reports repeat-generation consistency, identity stability, shadow memory state validity, feature-flag state, parity readiness, determinism confidence, and runtime stability confidence.

## Drift detection

V366 adds audit-only drift detection through lightweight projection snapshots and snapshot comparison. Drift detection checks repeated projections for:

- identity changes;
- grouping changes;
- count changes.

Detected drift is classified as `identity`, `grouping`, `count`, a combined classification such as `identity+count`, or `none` when no drift is found.

## Projection health model

`window.gridlyHistoricalProjectionHealthAudit?.()` exposes the current shadow projection health model:

- projection availability;
- projection count;
- projection age;
- generation status;
- last generation timestamp;
- drift status;
- validation status;
- feature-flag state.

The health audit is read-only and reports diagnostic state only.

## Snapshot comparison approach

The projection snapshot helper reduces a generated projection to stable diagnostic fields:

- sorted incident identities;
- sorted incident grouping records;
- report, confirmation, and clear counts;
- source-kind membership;
- normalized first and last observed timestamps.

The comparison helper compares two snapshots and returns count deltas, identity additions/removals, grouping changes, and a drift classification. This capability is intended only for diagnostics and audit output.

## Known limitations

- Projection diagnostics depend on the currently loaded in-memory source arrays.
- Runtime audits do not persist snapshots.
- Runtime audits do not backfill historical records.
- Health status is scoped to the current browser/runtime session.
- Drift checks validate repeat generation from the same runtime source state; they do not certify future schema migrations.

## Future migration prerequisites

Before any future migration or production activation, Gridly should require separate approval for:

- storage schema design;
- backfill strategy;
- read-path integration;
- write-path integration;
- history UI design;
- privacy and retention review;
- production monitoring and rollback plans;
- DriveTexas activation decisions, if ever applicable.

## Explicit safety statement

V366 is shadow-only runtime hardening. V366 does **not** approve:

- migrations;
- production read changes;
- production write changes;
- history UI;
- schema migration;
- DriveTexas activation.
