# GRIDLY V143.3 Commute Model Build Breakdown Audit

This patch adds **audit-only instrumentation** for `commute_model_build` inside `buildCommuteConsequenceIntelligence()`.

## Added nested timing inside commute_model_build

Per-incident nested timing buckets now include:
- incident mapping
- title/label generation
- severity/status derivation
- corridor label inference
- location/crossing lookup
- date/time/freshness formatting
- confidence/impact scoring
- object cloning/spreading
- repeated helper call tracking

## Added counts

Audit now records:
- incidents processed
- helper calls per incident
- corridor labels inferred
- crossing lookups
- formatting calls
- repeated helper call count

## Expanded `window.gridlyCommuteIntelligenceAudit()` output

Added fields:
- `commuteModelNestedSections`
- `commuteModelPerIncidentTimings`
- `commuteModelHelperCallCounts`
- `commuteModelSlowestIncident`

## Manual validation steps

1. Hard refresh.
2. Submit one report or trigger refresh.
3. Run:
   - `window.gridlyCommuteIntelligenceAudit()`

Expected: the slowest operation inside `commute_model_build` is explicitly visible with per-incident timing and helper-call breakdowns.

## Scope guard

- Audit only.
- No behavior changes intended.
- No optimization/refactor included.
