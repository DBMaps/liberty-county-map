# Gridly Passive Historical Capture Phase 1A Hook Readiness Audit — V398

## Scope and non-authorization

V398 is an audit-only artifact for future Phase 1A passive historical capture hook readiness. It does not add hooks, enable historical writes, add historical reads, add UI, add DOM changes, add SQL, run migrations, deploy Supabase changes, change production behavior, or restart DriveTexas.

Core rule for any later milestone remains: **Capture Everything. Show Nothing. Depend On Nothing.**

Protected systems reviewed but not modified:

- `js/app.js` behavior
- `createSharedReport()`
- `createSharedHazardReport()`
- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness
- markers
- Route Watch
- DriveTexas

## Audit inputs

Read-only inspection focused on these existing production boundaries in `js/app.js`:

- Crossing report submission: `createSharedReport(crossing, reportType, confidence, buttonEl = null)` at `js/app.js:56179`.
- Crossing persistence call: `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)` at `js/app.js:56217`.
- Crossing post-success boundary: after `if (error) throw error;` at `js/app.js:56219` and before UI success lifecycle begins at `js/app.js:56226`.
- Road-hazard report submission: `createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "", originalTapCoords = null, options = {})` at `js/app.js:53267`.
- Road-hazard persistence call and fallback decision: `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)` at `js/app.js:53409`, followed by fallback audit assignment at `js/app.js:53411-L53419` and `if (error) throw error;` at `js/app.js:53421`.
- Road-hazard post-success boundary: after `js/app.js:53421` and before local hazard normalization/mutation begins at `js/app.js:53426`.
- Existing road-hazard clear-report path: the current clear helper builds a `report_type: "hazard_cleared"` row at `js/app.js:53886-L53900`, persists it at `js/app.js:53908`, gates success at `js/app.js:53910`, and then performs post-success local history/UI refresh work from `js/app.js:53912-L53920`.

## 1. Crossing `report_created` readiness

### Candidate future boundary

Future candidate insertion point: inside `createSharedReport()` immediately after successful report persistence is known and before the current UI success lifecycle begins:

```text
js/app.js:56217  const { error } = await gridlyInsertWithCountyMetadataFallback(...)
js/app.js:56219  if (error) throw error;
[FUTURE POST-SUCCESS PASSIVE CAPTURE HOOK CANDIDATE]
js/app.js:56221  const localCrossingRows = normalizeReports(...)
js/app.js:56226  runUnifiedReportSuccessLifecycle(...)
```

### Readiness finding

This boundary is ready as the preferred future crossing `report_created` candidate because:

- It is after the primary insert/fallback helper returns.
- It is after the error decision is known.
- It does not run on failed inserts because failures throw before the boundary.
- It can observe the already-built `row`, `crossing`, `reportType`, `confidence`, and `copy` without introducing historical reads.
- It is before UI success flow (`runUnifiedReportSuccessLifecycle`, sync text, share card, quick-clear card, refresh, map recentering), so a future fail-open sidecar can be kept independent from visible success behavior.

### Required future classification

- Map to `report_created` when `reportType !== "cleared"`.
- Do not infer clear/create from UI labels or button state.
- Do not mutate `row`, `crossing`, `activeReports`, markers, alerts, awareness, route state, or DOM.

## 2. Crossing `report_cleared` readiness

### Candidate future boundary

Use the same post-success boundary in `createSharedReport()` after `js/app.js:56219` and before `js/app.js:56221`, but classify only when `reportType === "cleared"`.

### Readiness finding

This boundary is ready for future crossing `report_cleared` capture with a strict type guard because:

- The same persistence success decision has already completed.
- Current cleared UI behavior starts later at `js/app.js:56261-L56264`; a future passive hook can run before that without changing it.
- The current quick-clear/report button behavior remains owned by the existing success lifecycle and must not depend on sidecar capture.

### Required future classification

- Map to `report_cleared` only when `reportType` is exactly the canonical cleared value used by the current code: `"cleared"`.
- Unknown, empty, malformed, or non-canonical report types must not be classified as cleared.
- A malformed crossing payload must be dropped/monitored by the future audit helper without throwing into `createSharedReport()`.

## 3. Road-hazard `report_created` readiness

### Candidate future boundary

Preferred future insertion point: inside `createSharedHazardReport()` immediately after persistence success and before local UI/incident lifecycle mutation:

```text
js/app.js:53409  const insertResult = await gridlyInsertWithCountyMetadataFallback(...)
js/app.js:53411-L53419  fallback/audit state records final persistence decision details
js/app.js:53421  if (error) throw error;
js/app.js:53423-L53425 current success debug markers
[FUTURE POST-SUCCESS PASSIVE CAPTURE HOOK CANDIDATE]
js/app.js:53426  const localHazardRows = normalizeReports(...)
js/app.js:53461-L53472 activeHazards / marker / incident rendering mutations
```

### Readiness finding

This boundary is conditionally ready and is the safest future road-hazard `report_created` candidate because:

- It is after the insert/fallback decision is known.
- It stays post-success only because `if (error) throw error;` precedes it.
- It can run before `localHazardRows` normalization and before `activeHazards`, map layer, report/hazard view refresh, unified rendering, and marker scheduling mutations.
- It can observe `row`, `hazardType`, `lat`, `lng`, `confidence`, `locationName`, optional tap-map coordinates, location payload metadata, and fallback audit state without requiring historical reads.

### Risk note

A future hook inserted after `js/app.js:53425` must not change `lastMobileReportSubmitDebug`, `submitAudit`, duplicate suppression, pending submit locks, `activeHazards`, marker scheduling, alert behavior, or the success lifecycle. If a future implementation needs audit telemetry, telemetry must be sidecar-owned and fail-open, not production-lifecycle-owned.

## 4. Road-hazard `report_cleared` readiness

### Candidate future boundary in `createSharedHazardReport()`

`createSharedHazardReport()` currently handles hazard creation-style rows using `report_type: hazardType` at `js/app.js:53368-L53384`; it does not currently contain a canonical clear branch in this inspected function. If a later milestone routes a clear/cleared hazard type through `createSharedHazardReport()`, the candidate boundary must be the same post-success location after `js/app.js:53421`, but classification must be gated to canonical clear/cleared hazard values only.

### Existing current clear-report path outside `createSharedHazardReport()`

The current road-hazard clear path observed in `js/app.js` builds a separate clear row with `report_type: "hazard_cleared"`, inserts it, throws on error, then performs local clear history/UI refresh work. Its post-success candidate boundary would be after `js/app.js:53910` and before `js/app.js:53912`, but V398 does not authorize hook installation there either.

### Readiness finding

- Future road-hazard clear capture is not ready to be installed in `createSharedHazardReport()` until a later milestone explicitly defines whether clear reports are routed through `createSharedHazardReport()` or remain in the existing separate clear path.
- If routed through `createSharedHazardReport()`, map only when `hazardType` resolves to a canonical clear/cleared value.
- If using the existing clear path, map only rows with the existing canonical `report_type: "hazard_cleared"` or a later explicitly approved equivalent.
- In both cases, the hook must remain post-success only and must not affect hazard marker/alert behavior.

## 5. Required future guards

Any later implementation must include all of these guards before production integration is considered:

1. Feature flag disabled by default.
2. Writer disabled by default, independently from the feature flag.
3. No throw into production callers; all hook failures must be swallowed or routed to sidecar monitoring.
4. No dependency on sidecar success for report submission success, clear success, UI success messages, refresh, marker rendering, alerting, awareness, or Route Watch.
5. No historical read path.
6. No UI feedback.
7. No incident mutation.
8. No alert, awareness, or marker mutation.
9. No writes unless a future milestone explicitly enables writer behavior and proves guards are active.
10. No Supabase schema or migration dependency for hook installation readiness.
11. No modification of `activeHazards`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, DriveTexas state, or Route Watch state.

## 6. Required future validation

A future implementation milestone must provide validation evidence for:

- Parity before/after hook install across protected report and clear flows.
- Crossing `report_created` tests.
- Crossing `report_cleared` tests.
- Road-hazard `report_created` tests.
- Road-hazard `report_cleared` tests for whichever approved clear path is used.
- Disabled-flag tests proving no capture attempt and no behavioral change.
- Writer-disabled tests proving no Supabase write occurs even when event construction is enabled.
- Malformed payload tests proving no throw into production callers.
- Audit helper verification for accepted, dropped, malformed, duplicate, disabled, and writer-disabled outcomes.
- No Supabase write unless explicitly enabled in a future milestone.
- No historical read under any Phase 1A hook path.
- No DOM/UI/file changes for hook-only operation.
- No mutation to incidents, alerts, awareness, markers, Route Watch, DriveTexas, or local active incident inventories.

## 7. Explicit NO-GO findings

V398 does not authorize:

- hook installation;
- historical writes;
- Supabase schema changes;
- lifecycle adapter implementation;
- incident transition capture;
- `report_updated` capture;
- history UI;
- production activation;
- SQL changes;
- migration creation, application, or execution;
- Supabase deployment;
- DriveTexas restart or lifecycle change;
- protected-system modification.

## Acceptance criteria for a later hook milestone

A later milestone may be considered hook-ready only if it proves all of the following before merge:

- The candidate hook is post-success only.
- The candidate hook cannot throw into `createSharedReport()` or `createSharedHazardReport()`.
- The candidate hook does not modify existing production data structures or UI state.
- The feature flag and writer flag default to disabled.
- With both flags disabled, before/after behavior is byte-for-byte or assertion-equivalent for protected flows.
- With writer disabled, no Supabase historical write can occur.
- With malformed payloads, production submission still succeeds when the original report insert succeeds.
- Clear events are classified only from canonical clear values.
- No historical reads, UI, SQL, migration, incident mutation, marker mutation, alert mutation, awareness mutation, Route Watch mutation, or DriveTexas change is introduced.

## V398 conclusion

The crossing create/clear future hook boundary is identifiable and suitable for a later guarded, fail-open, post-success sidecar hook. The road-hazard create future hook boundary is also identifiable and best placed after insert success but before local hazard UI/incident mutation. Road-hazard clear capture needs one additional routing decision in a later milestone because the inspected `createSharedHazardReport()` path is creation-oriented, while the currently observed clear behavior is implemented in a separate clear-report path. No hooks, writes, reads, UI, SQL, migrations, or production behavior changes were added by V398.
