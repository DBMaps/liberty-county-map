# GRIDLY V143.5 Label Helper Internal Audit

## Scope
This audit instruments internal sections for:
- `buildCommunityConsequenceLabel(...)`
- `buildLocalizedIncidentLabel(...)`

No label text, behavior, or logic outputs were changed.

## Added Internal Timing Sections
The helper-level instrumentation now captures per-call and per-refresh timing for:
- input normalization
- type/status mapping
- corridor/location inference
- crossing/road name lookup
- string/template construction
- fallback logic
- repeated helper calls

The implementation also records helper-internal call counts for repeated sub-helper usage.

## `window.gridlyCommuteIntelligenceAudit()` Additions
Three new fields are now exposed:
- `labelHelperInternalSections`
  - Aggregated milliseconds per internal section by helper name.
- `labelHelperCallStats`
  - Calls per refresh, total ms, average ms per call, repeated helper-call counters, and helper-level slowest internal section.
- `labelHelperSlowestCall`
  - The single slowest label-helper call in the refresh, including incident id/type and slowest internal section for that call.

## Manual Run
1. Trigger a refresh with the incident set under investigation.
2. In DevTools console, run:

```js
window.gridlyCommuteIntelligenceAudit()
```

3. Inspect:
- `labelHelperInternalSections.buildCommunityConsequenceLabel`
- `labelHelperInternalSections.buildLocalizedIncidentLabel`
- `labelHelperCallStats`
- `labelHelperSlowestCall`

## Expected Outcome
This reveals the exact internal operation(s) driving the observed helper delay while preserving existing output behavior.
