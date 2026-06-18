# V596 — Montgomery Road Resolver & Incident Location Label Fix

## Determination

**MONTGOMERY ROAD RESOLVER LOCATION FIX COMPLETE WITH OBSERVATIONS**

## Summary

V596 fixes the post-V595 Montgomery launch issue where incident titles, alert subtitles, and hazard popup location lines could preserve the Liberty-only fallback road label `Local Road Impact Into Liberty`.

The fix makes the county-aware display pipeline reject that phrase as a road name outside Liberty, convert Montgomery fallback copy into selected awareness context such as Conroe or Montgomery County, and preserve valid resolved roads such as TX 105, West Davis Street, Wayne Street, and FM 1484 when they are available.

## Resolver and Labeling Behavior

- Montgomery hazards continue to use selected coordinates and active-county context for resolver attempts.
- Roadway geometry lookup remains active-county scoped through `gridlyGetActiveCountyConfig().roadSegmentsPath`.
- If Montgomery road geometry is unavailable or no road is resolved, the UI uses safe context fallback wording:
  - Conroe
  - Montgomery County
  - this area
- `Local Road Impact Into Liberty`, `Impact Into Liberty`, and related local-road-impact placeholders are rejected as valid road labels.
- Liberty context preserves existing fallback wording for backward compatibility.
- Unknown county context remains fail-safe through the default county normalization and containment checks.

## User-Facing Copy Rules

Montgomery alert copy now prefers:

1. `{Hazard Type} on {resolved road}` when a valid road is resolved.
2. `{Hazard Type} near {selected awareness area}` when no valid road is resolved.
3. `Reported in {selected awareness area}` or `Reported near {selected awareness area}` for subtitles and popup location lines.

It must not generate Montgomery user-facing copy that says:

- `Local Road Impact Into Liberty`
- `Reported on Local Road Impact Into Liberty`
- generic Liberty fallback wording

## Protected Boundaries

No Supabase schema changes, migrations, historical systems, DriveTexas resumption, or Transportation Intelligence activation were performed.

Protected flags remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Tests

Added `tests/county-runtime/montgomeryRoadResolverIncidentLocationV596.test.js` covering:

- Montgomery title does not include `Local Road Impact Into Liberty`.
- Montgomery subtitle does not include `Reported on Local Road Impact Into Liberty`.
- Montgomery popup location does not include Liberty.
- Liberty fallback text is not treated as a valid Montgomery road name.
- Montgomery fallback uses Conroe, Montgomery County, or neutral nearby-area wording.
- Valid Montgomery road names remain preserved.
- Liberty resolver behavior remains unchanged.
- Unknown county behavior remains fail-safe.
- Protected boundaries remain unchanged.
