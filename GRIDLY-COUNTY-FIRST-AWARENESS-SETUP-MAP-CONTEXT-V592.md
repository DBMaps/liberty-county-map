# GRIDLY County-First Awareness Setup & Map Context Fix V592

## Determination

COUNTY-FIRST AWARENESS SETUP COMPLETE

## Summary

V592 replaces the single mixed onboarding awareness-area picker with a county-first setup step. Users now choose Liberty County or Montgomery County first, then see only the home-area options for that selected county.

## Runtime Behavior

- Liberty County remains the default county when no county or area is selected.
- Montgomery County and all Montgomery home-area selections resolve to `montgomery-tx`.
- Liberty County and Liberty home-area selections resolve to `liberty-tx` by default.
- Blank and unknown awareness-area values remain fail-safe through the Liberty default path and do not implicitly switch to Montgomery.
- Saving an awareness area now synchronizes the active county context so labels, settings/profile metadata, debug helpers, and the footer county context stay aligned.

## Map Context

- County-wide map fitting now uses selected-county bounds instead of a Liberty-only bounds helper.
- Montgomery has a safe bounds fallback derived from the packaged Montgomery boundary extent, so Montgomery setup does not leave the map centered over Liberty.
- Liberty map behavior continues to use the existing Liberty county bounds.

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

No Supabase changes, migrations, historical systems, DriveTexas resumption, or Transportation Intelligence activation were performed.

## Validation

Added `tests/county-runtime/countyFirstAwarenessSetupMapContextV592.test.js` to audit:

- county-first onboarding markup,
- county-specific home-area option separation,
- Montgomery and Liberty county resolution,
- default/fail-safe behavior,
- Montgomery map bounds fallback wiring,
- protected boundary preservation.
