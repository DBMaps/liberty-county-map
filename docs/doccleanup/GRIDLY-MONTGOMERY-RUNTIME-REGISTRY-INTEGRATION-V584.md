# GRIDLY Montgomery Runtime & Registry Integration V584

## Objective

V584 begins authorized Montgomery runtime implementation by adding staged county package recognition to the runtime registry while preserving Liberty County as the only operational default. This milestone wires Montgomery into county-registry awareness for validation only; it does not activate Montgomery in production.

## V583 Review Summary

V583 identified the minimum remaining Montgomery launch work as production authorization, runtime county package integration, production registry integration, county selection and containment validation, production-consumable asset integration, post-integration validation, observation-period execution, rollback acceptance, and a final go/no-go decision.

V584 addresses only the staged runtime and registry-recognition portion of that matrix. It does not close the launch-readiness gaps for production authorization, production activation, observation, rollback acceptance, Supabase, migrations, DriveTexas, historical systems, or Transportation Intelligence.

## Liberty Runtime County Assumptions Identified

The runtime previously assumed Liberty as both the default and only known county registry entry. Active county selection, county-scoped storage keys, report metadata, report visibility checks, crossing paths, local crossing paths, road segment paths, crossing override paths, and boundary paths all resolved through the Liberty-only registry. Missing report county metadata also intentionally fell back to Liberty.

V584 preserves those assumptions for operational behavior while separating "known county" recognition from "operational county" activation.

## Runtime Changes

- Added explicit county stages for `operational` and `disabled-staged` registry entries.
- Preserved `liberty-tx` as the default, selectable, production-enabled, operational county.
- Added `montgomery-tx` as a disabled staged registry entry with `operational: false`, `productionEnabled: false`, `selectable: false`, and `GRIDLY_MONTGOMERY_RUNTIME_GATE = false`.
- Pointed Montgomery runtime package references at `assets/county-implementation/montgomery/` rather than `data/`.
- Updated county normalization so disabled staged counties cannot become the active county and instead fall back to Liberty.
- Added runtime status and containment helpers for staged county validation.
- Expanded the county storage readiness audit to prove staged Montgomery recognition, Liberty default behavior, protected boundaries, no Supabase changes, and Montgomery/Liberty containment blocking.

## Asset Placement Decision

Montgomery package assets remain under `assets/county-implementation/montgomery/`. V584 does not place Montgomery assets under `data/` because `data/` remains Liberty-operational runtime storage for this milestone. Any future movement into production-consumable data paths requires explicit authorization and documentation in a later milestone.

## Containment Validation

V584 adds runtime containment checks that require an expected county to normalize to an operational county and require a row's `county_id` to match that operational expected county. A staged Montgomery row is therefore blocked from Liberty context, and Liberty rows remain allowed in Liberty context.

## Protected Boundaries

The following protected boundaries remain unchanged:

| Boundary | V584 State |
| --- | --- |
| `historicalReadsEnabled` | `false` |
| `historyUiEnabled` | `false` |
| `historicalApiExposure` | `false` |
| `consumerFacingHistoryDashboard` | `false` |
| `DriveTexasPaused` | `true` |
| `TransportationIntelligenceEnabled` | `false` |
| `TransportationIntelligenceDisplay` | `false` |
| `TransportationIntelligenceActivation` | `false` |

## Validation Evidence

| Check | Evidence |
| --- | --- |
| Liberty still works | `node tests/county-runtime/montgomeryRuntimeRegistryV584.test.js` validates Liberty as active default, Liberty config availability, and Liberty report visibility. |
| Montgomery recognized only as disabled/staged | The same test validates `montgomery-tx` as known, disabled-staged, non-operational, non-production, and non-selectable. |
| No production activation occurred | `node scripts/county-runtime/v584-protected-boundary-audit.mjs` validates `GRIDLY_MONTGOMERY_RUNTIME_GATE = false` and `productionEnabled: false`. |
| No Supabase changes occurred | The protected-boundary audit checks changed paths for `supabase/` and `migrations/` prefixes and fails if present. |
| Protected systems remain unchanged | The protected-boundary audit validates historical, DriveTexas, and Transportation Intelligence states. |
| Montgomery assets remain outside `data/` | The runtime registry test validates Montgomery boundary paths under `assets/county-implementation/montgomery/`, and the audit rejects Montgomery `data/` paths. |
| Cross-county containment | The runtime registry test validates Montgomery rows are blocked from Liberty context and Liberty rows are allowed in Liberty context. |

## Non-Goals Confirmed

V584 does not activate Montgomery in production, modify Supabase, perform migrations, enable historical systems, resume DriveTexas, enable Transportation Intelligence, or expose consumer-facing history.

## Final Determination

**STAGED RUNTIME INTEGRATION COMPLETE WITH OBSERVATIONS**

Observation: Montgomery is now recognized by runtime registry helpers as a disabled staged county package, but it remains non-operational and non-selectable. Additional authorized runtime, asset-promotion, validation, observation, rollback-acceptance, and launch-decision work remains required before any production activation.
