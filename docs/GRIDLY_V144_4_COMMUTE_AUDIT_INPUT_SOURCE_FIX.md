# GRIDLY V144.4 — Commute Audit Input Source Mismatch Fix

## Problem
`window.gridlyCrossingPipelineAudit()` could report merged unified incidents (for example total `3`), while `window.gridlyCommuteIntelligenceAudit()` reported `unifiedIncidentCount: 0` and `incidentsProcessed: 0`.

## Root Cause
The commute intelligence builder correctly computes `counts.unifiedIncidentCount` from the active unified incident list, but late-stage audit sanitization was checking a non-existent field:

- `commuteModelHelperCallCounts.unifiedIncidentCount` (always `undefined` -> coerced to `0`)

That forced empty-cycle sanitization even when incidents were present.

## Fix Applied
1. **Aligned sanitization check to the actual computed source**
   - Switched sanitization count source from `commuteModelHelperCallCounts.unifiedIncidentCount` to `counts.unifiedIncidentCount`.
2. **Added explicit audit visibility fields**
   - `commuteAuditInputSource`
   - `commuteAuditUnifiedIncidentCountBeforeBuild`
   - `commuteAuditUnifiedIncidentCountAfterBuild`
   - `commuteAuditSanitizerReason`
3. **Captured unified incident count once before build**
   - Reused this in cache payload and audit fields to avoid input ambiguity.

## Runtime/UI Impact
- No runtime feature behavior changes beyond fixing audit correctness.
- No visible UI changes.
- No optimization or pipeline logic changes.

## Manual Validation Steps
```js
await loadSharedReports("manual_pipeline_test")
window.gridlyCrossingPipelineAudit()
window.gridlyCommuteIntelligenceAudit()
```

Expected: commute audit `unifiedIncidentCount` tracks the active unified incident pipeline count unless explicitly filtered (which is now surfaced via `commuteAuditSanitizerReason`).
