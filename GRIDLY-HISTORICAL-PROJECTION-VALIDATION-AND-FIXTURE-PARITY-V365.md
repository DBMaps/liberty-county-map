# GRIDLY V365 — Historical Projection Validation & Fixture Parity

## Scope

V365 validates the default-off V364 shadow historical projection. It does not migrate data, add history UI, activate production reads, or make the projection a dependency of the live incident pipeline.

The protected production ownership chain remains unchanged:

`reports → loadSharedReports() → activeHazards → getLiveHazardIncidents() → unifiedRoadIncidents → activeUnifiedIncidents → alerts / awareness / markers / Route Watch`

DriveTexas remains paused.

## Validation Strategy

V365 adds `window.gridlyHistoricalProjectionValidationAudit?.()` as a shadow-only audit. The audit builds or accepts a projection, inspects the same source-shaped arrays used by the V364 projection builder, and returns pass/fail findings without mutating production state.

The validation checks are focused on:

- projection identity stability
- projection count integrity
- report counting
- confirmation counting
- clear counting
- timestamp consistency
- duplicate grouping consistency

## Fixture Coverage

V365 adds a lightweight fixture parity validation framework through `window.gridlyHistoricalFixtureParityValidation?.()`.

The framework validates these fixture categories:

### Hazards

- single hazard
- duplicate hazards
- same-type same-location
- same-type nearby
- different-type same-location

### Hazard Types

- flooding
- debris
- traffic backup
- other hazard
- downed power line

### Crossings

- blocked crossing
- crossing clear

### Lifecycle

- clear
- recently cleared
- expiration
- rehydration suppression

### Filtering

- county
- town
- selected area

### Regression

- duplicate submit malfunction
- confirmation growth

## Parity Methodology

`window.gridlyHistoricalParityAudit?.()` still compares shadow projection identities against the production incident view, but now also reports:

- fixture coverage summary
- identity grouping summary
- parity confidence
- difference classification
- optional fixture result details

The production incident view is read only for comparison. The audit does not write back to production structures and does not alter the live incident pipeline.

## Projection Identity Validation

The projection identity model is validated against duplicate reports, confirmation records, and clear records. Fixture results confirm that repeated explicit incident IDs remain grouped into a single projection identity while count fields continue to grow independently.

Known identity edge cases:

- Records without explicit IDs continue to rely on existing cluster-key behavior when available.
- Nearby same-type reports can legitimately group or split depending on the production cluster key available in the runtime.
- Lifecycle labels such as `expired` and `suppressed` are preserved as shadow projection evidence only; they do not change production lifecycle behavior.

## Grouping Validation

Same-type same-location fixtures validate that production-style grouping expectations remain stable for shadow projection construction. Different-type same-location fixtures validate that hazard type remains part of the projection identity when cluster-key fallback is used.

## Known Limitations

- The fixture framework is intentionally lightweight and synthetic.
- It validates projection shape and parity assumptions; it is not a replacement for live runtime smoke tests.
- It does not activate the historical pipeline.
- It does not backfill historical data.
- It does not introduce a persistence layer.
- It does not validate DriveTexas behavior because DriveTexas remains paused.

## Future Requirements Before Migration Consideration

Before any migration or production dependency is considered, future milestones should require:

- larger real-world fixture replay coverage
- persisted historical schema review
- read/write migration plan review
- production rollback plan
- UI requirements review
- explicit DriveTexas reactivation decision, if applicable
- renewed lifecycle, alert, awareness, marker, and Route Watch safety audits

## Explicit Safety Statement

V365 does **not** approve:

- migrations
- production read changes
- production write changes
- history UI
- schema migration
- DriveTexas activation
