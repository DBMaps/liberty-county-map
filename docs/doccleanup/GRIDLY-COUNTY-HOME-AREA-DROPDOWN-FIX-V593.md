# GRIDLY County Home Area Dropdown Fix V593

## Determination

COUNTY HOME AREA DROPDOWN FIX COMPLETE WITH OBSERVATIONS

## Summary

V593 replaces the fragile county-first stacked home-area buttons with a controlled county selector and a filtered home-area dropdown. The onboarding flow now uses a two-step setup model:

1. Select County
2. Select Home Area

The selected county drives the available home-area options, and county changes immediately reset the home-area selection to that county's safe countywide default.

## Implemented Behavior

- Liberty County remains the default county when no county is selected.
- County switching is handled through a native `select` control and works in both directions:
  - Liberty County to Montgomery County
  - Montgomery County to Liberty County
- Home-area options are defined in a county-scoped registry.
- Montgomery County options exclude Liberty towns such as Dayton, Liberty, Ames, Hardin, Devers, and Hull.
- Liberty County options exclude Montgomery areas such as Conroe, The Woodlands, Magnolia, Willis, New Caney, Porter, and Splendora.
- County changes persist the reset home area immediately so setup state, profile state, awareness-area state, map context, and rendered labels remain synchronized.
- Montgomery-specific home-area selections resolve to `montgomery-tx`.
- Liberty-specific home-area selections continue resolving to `liberty-tx` through the existing default-safe resolver.
- Blank or unknown selections remain fail-safe and do not accidentally resolve to Montgomery County.
- The map context continues to use the selected awareness area's county bounds, including Montgomery bounds for Montgomery countywide context.

## Protected Boundaries

The following protected boundaries remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Supabase and Migration Status

- Supabase was not modified.
- No migrations were added or changed.
- Historical systems were not enabled.
- DriveTexas was not resumed.
- Transportation Intelligence was not enabled.

## Test Coverage

Added `tests/county-runtime/countyHomeAreaDropdownFixV593.test.js` to validate:

- County selector exists.
- Home-area dropdown exists.
- County switching handler exists and supports both county values.
- County changes reset incompatible home-area selections.
- Montgomery dropdown excludes Liberty towns.
- Liberty dropdown excludes Montgomery towns.
- Montgomery County + Conroe resolves to `montgomery-tx`.
- Liberty County + Dayton remains Liberty-safe.
- Completion/setup labels preserve county/home-area context.
- Main app/map awareness context uses selected county information.
- Protected boundaries remain unchanged.

## Observation

The existing Liberty area definitions rely on the historical default county fallback rather than declaring `countyId: "liberty-tx"` on every Liberty town. This is intentionally preserved for compatibility, and the V593 resolver keeps blank/unknown values defaulting to Liberty rather than Montgomery.
