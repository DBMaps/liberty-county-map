# GRIDLY V144.5 — Commute Audit Counts/Sanitizer Alignment

## Summary
Aligned commute audit output counts and empty-cycle sanitization with the verified unified incident build input count.

## What was fixed

1. Final `counts.unifiedIncidentCount` now resolves to the verified post-build incident count (`commuteAuditUnifiedIncidentCountAfterBuild`), with fallback to existing count.
2. `emptyCycleSanitized` now triggers only when the verified unified incident count is `0`.
3. `counts.incidentsProcessed` is now explicitly populated from the commute model helper counter.
4. Added exclusion telemetry:
   - `commuteAuditExcludedIncidentCount`
   - `commuteAuditExclusionReasons`
5. Audit state now initializes and publishes the new exclusion fields every cycle.

## Behavioral intent

If audit shows:
- `commuteAuditUnifiedIncidentCountBeforeBuild = 3`
- `commuteAuditUnifiedIncidentCountAfterBuild = 3`

Then audit output should now report:
- `counts.unifiedIncidentCount = 3`
- `emptyCycleSanitized = false`
- `counts.incidentsProcessed = 3` (unless explicit exclusions are recorded)

## Scope boundaries kept

- No UI behavior changes.
- No optimization work added.
- No hazard/report data logic changed.
