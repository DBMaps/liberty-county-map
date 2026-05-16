# GRIDLY V142.8b — Intelligence Cache Key Audit/Fix

## Summary
- Audited all `buildCommuteConsequenceIntelligence(...)` call paths in:
  - `refreshPortraitV2LocalizedIntelligence`
  - `renderAlerts`
  - `updateDailyHabitStatus`
- Added refresh-cycle cache key audit outputs:
  - `cacheKeysThisCycle`
  - `cacheKeyMissReasons`
  - `cacheableEquivalentCalls`
- Kept meaningful option differences intact (`limit: 10` in `renderAlerts` remains separate).
- Normalized equivalent calls by aligning `updateDailyHabitStatus` to use the same intelligence limit (`6`) as `refreshPortraitV2LocalizedIntelligence`, enabling safe key reuse.

## Why misses were happening
Per-refresh calls were using different `limit` values (`6`, `10`, and `5`), generating distinct cache keys for the same function in a single cycle. That produced misses with no hits even though the function was cache-enabled.

## Fix details
- `updateDailyHabitStatus` now requests `buildUnifiedLocalizedCommuteIntelligence({ limit: 6 })`.
- `renderAlerts` still uses `limit: 10` (meaningfully different output set; not merged).
- Cache audit now records:
  - every key request and whether it hit,
  - miss reason per key,
  - repeated equivalent-key call activity.

## Validation
Run:

```bash
node --check js/app.js
```

Then after one refresh/report submit run in console:

```js
window.gridlyRefreshBreakdownAudit()
```

Expected:
- `cacheHits > 0` when equivalent calls happen in the same refresh cycle
- `cacheMisses` only for meaningfully different option sets
- no stale alert behavior
