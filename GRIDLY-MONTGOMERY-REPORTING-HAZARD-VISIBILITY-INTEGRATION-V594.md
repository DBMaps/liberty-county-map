# Gridly Montgomery Reporting & Hazard Visibility Integration — V594

## Determination

**MONTGOMERY REPORTING HAZARD VISIBILITY COMPLETE WITH OBSERVATIONS**

## Summary

V594 closes the post-V593 gap where Montgomery onboarding selected `montgomery-tx`, but newly created road hazards could fall back to Liberty identity during reporting, history capture, or active hazard visibility.

## Root Cause

The active county helpers were available, but road-hazard submission and local history relied on report shapes that could lose county identity when Supabase rejected top-level metadata columns and the legacy retry removed `county_id`. Local hazard lifecycle history also derived `county` from `LOCATION_DEFAULTS.county`, which always resolved to Liberty County when a normalized hazard lacked a human-readable county field.

## Fix

- Road-hazard submission now resolves county-scoped metadata once and writes it to both top-level report fields and structured detail metadata.
- Legacy Supabase retry rows retain county identity inside existing string detail metadata without schema changes or migrations.
- Report normalization can recover county identity from top-level county fields or structured detail metadata.
- Hazard lifecycle history records both `county_id` and `countyId` aliases and maps the display county from the active county registry instead of defaulting Montgomery hazards to Liberty County.
- County containment now treats unknown explicit county IDs as unknown, not as Liberty fallback, preserving fail-closed behavior.

## Protected Boundaries

Unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

No Supabase schema changes, migrations, historical-system enablement, DriveTexas resume, or Transportation Intelligence activation were performed.

## Validation

Added `tests/county-runtime/montgomeryReportingHazardVisibilityV594.test.js` to prove Montgomery payload metadata, non-Liberty persistence metadata, active hazard visibility, marker pipeline handoff, lifecycle history metadata, Liberty baseline preservation, unknown county blocking, and protected boundary preservation.
