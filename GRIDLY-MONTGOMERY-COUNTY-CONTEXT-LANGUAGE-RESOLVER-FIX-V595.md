# GRIDLY Montgomery County Context Language & Resolver Fix V595

## Determination

**MONTGOMERY COUNTY CONTEXT LANGUAGE FIX COMPLETE**

## Objective

V595 fixes the post-V594 display-language regression where Montgomery-created hazards were visible in the Montgomery / Conroe runtime context but user-facing alert, card, popup, and fallback location copy could still inherit Liberty County wording.

## Root Cause

The county metadata and containment work from V594 correctly allowed Montgomery hazards to render, but some consumer display paths still used county-agnostic fallbacks or hardcoded Liberty cleanup assumptions. Generic road/location fallback strings such as `Local Road Impact Into Liberty`, `Liberty County`, and `Liberty` could survive into:

- hazard titles,
- alert card subtitles,
- hazard popup location lines,
- road resolver fallback labels,
- lifecycle metadata city fallback,
- active alert render output.

## Implementation Summary

V595 adds centralized county-aware display helpers in `js/app.js`:

- `gridlyGetCountyDisplayContext(record, options)` resolves the active/record county, county label, default city, selected awareness label, and safe fallback area label.
- `gridlyResolveCountyAwareFallbackLocation(record, options)` chooses the selected awareness label, county default city, county name, or neutral area fallback.
- `normalizeGridlyCountyAwareDisplayText(value, record, options)` sanitizes user-facing text so Montgomery context does not inherit Liberty wording while Liberty context remains unchanged.

The helpers are wired into key user-facing display paths:

- hazard history metadata,
- hazard popup road label and location line,
- road-hazard authoritative location/headline generation,
- alert-card title and location-line model,
- active alert row title/subtitle render path,
- road-hazard segment headline fallback handling.

## Montgomery Behavior

When the active or record county is `montgomery-tx`, display fallback language now prefers:

1. the selected awareness area, such as `Conroe`, when it belongs to Montgomery County;
2. the Montgomery default city (`Conroe`);
3. `Montgomery County`;
4. neutral `this area` fallback.

Montgomery-created hazards should not display:

- `Local Road Impact Into Liberty`,
- `Liberty County`,
- Liberty-only alert card wording,
- Liberty-only popup location wording.

## Liberty Behavior

When the active or record county is `liberty-tx`, V595 intentionally leaves Liberty wording available. Existing Liberty County behavior remains unchanged for Liberty-owned hazards and default fail-safe runtime behavior.

## Unknown County Behavior

Unknown active county values still fail safe through the existing county normalization path and do **not** activate Montgomery by default. Unknown county rows remain blocked by containment checks.

## Protected Boundaries

V595 does not change Supabase schema, does not add migrations, does not enable historical systems, does not resume DriveTexas, and does not enable Transportation Intelligence.

Protected boundaries remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Validation

Added `tests/county-runtime/montgomeryCountyContextLanguageResolverV595.test.js`, which verifies:

- Montgomery hazard title does not contain Liberty.
- Montgomery alert card language does not contain Liberty.
- Montgomery hazard popup language does not contain Liberty.
- Montgomery fallback road/location copy uses Conroe, Montgomery County, or neutral wording.
- `Local Road Impact Into Liberty` no longer appears for Montgomery context.
- Liberty hazard wording still works in Liberty context.
- Unknown county remains fail-safe and does not default to Montgomery.
- Protected boundaries remain unchanged.
