# GRIDLY V143.2 — Commute Timing Boundary Correction

## Goal
Correct timing attribution in `buildCommuteConsequenceIntelligence()` so `route_relevance_checks` contains only route relevance work.

## What Changed
- Introduced `commute_model_build` timing section around per-incident model construction work.
- Narrowed `route_relevance_checks` to only the `isIncidentRouteRelevant(...)` call path.
- Added `uncategorized_or_wrapper_overhead` to capture wrapper/runtime overhead outside explicit timing sections.
- Updated `window.gridlyCommuteIntelligenceAudit()` to report grouped `sectionAttribution` buckets:
  - `route_relevance_checks`
  - `commute_model_build`
  - `corridor_model_build`
  - `route_context_setup`
  - `uncategorized_or_wrapper_overhead`

## Scope Guardrails
- No behavior optimization.
- No output changes.
- No route-watch logic changes.
- Timing boundaries only.

## Validation
- Run: `node --check js/app.js`
- Manual:
  1. Hard refresh
  2. Submit one report
  3. Run `window.gridlyCommuteIntelligenceAudit()`

Expected:
- `route_relevance_checks` near 0ms when route watch is idle
- slow work attributed to its actual section
