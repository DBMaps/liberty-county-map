# LP006 Display Candidate Architecture Audit

## 1. Current cold Alerts execution map

The Alerts dock entry calls `invokeMobileAlertsEntry()`, which delegates to `openAlertsSurfaceFromDock()`. The open handler immediately records an audit run, marks the shell as opening, binds row focus behavior, and then builds the Alerts payload in this order:

1. `getAlertsSurfaceSnapshot()` through the measured `alert snapshot creation` phase.
2. `gridlyFilterAlertRecordsBySelectedAwarenessArea()` through the measured `alert merge` phase in `openAlertsSurfaceFromDock()`.
3. `getGridlyAlertsPresentationCountModel(alertsForRender)` through `presentation model creation`.
4. `presentationCountModel.alerts` selection through `situation clustering`.
5. First-card and full-card renderer work through `first visible card DOM generation`, `DOM generation`, and pre-insertion subphases.
6. `window.openGridlyPortraitV2Sheet("alerts", ...)` through first-card and final `DOM insertion` phases.
7. `bindAlertsPanelClick()` owns alert row click/focus wiring and `runGridlyAlertLocationSyncAfterAlertRender()` is scheduled after insertion.

`getAlertsSurfaceSnapshot()` owns the current snapshot. It collects active unified incidents, fallback road hazards, preferences, route state, active community reports, unified localized commute intelligence, provider promotion, selected-awareness-area filtering, and official situation merge/sort before returning `snapshot.alerts`.

## 2. Phase timing breakdown

Existing LP004/LP005 instrumentation already records the major phases needed for LP006: `alert snapshot creation`, snapshot-internal `community alert collection`, `DriveTexas official situation promotion`, `weather situation promotion`, `deduplication`, snapshot-internal `alert merge`, open-level `alert merge`, `presentation model creation`, `situation clustering`, `first visible card DOM generation`, `DOM generation`, `pre-insertion work`, `DOM insertion`, and animation timing.

The 48-65 second symptom should be attributed with `window.gridlyDisplayCandidateArchitectureAudit?.()` after a cold Alerts open. The helper is passive and maps the recorded phase names into the audit buckets: data collection, individual transformation/filtering, grouping, PresentationRecord enrichment, rendering, and insertion.

## 3. Exact point where the first valid individual alert becomes available

The first valid individual alert is currently available only after `getAlertsSurfaceSnapshot()` returns and `snapshot.alerts` has been assigned to `snapshotAlerts` in `openAlertsSurfaceFromDock()`. The snapshot does build normalized alert objects earlier inside `getAlertsSurfaceSnapshot()` (`normalizedAlertItemsFromIntel`, `normalizedAlertItemsBeforeAreaFilter`, `areaFilteredAlertItems`, then `normalizedAlertItems`), but those are local to snapshot creation and are not emitted incrementally.

Because provider/snapshot ownership is synchronous from the Alerts open perspective, the earliest current consumer-visible handoff point is `snapshot.alerts[0]` after `alert snapshot creation`, not raw provider arrival.

## 4. Exact point where grouping begins

Grouping begins inside `getGridlyAlertsPresentationCountModel()` during `event-grouping pass: source iteration`. Each filtered alert is assigned a cluster key by `getAlertClusterKey()`, then accumulated into a group map with source indexes and evidence rows.

A second presentation-layer grouping fallback exists inside `openAlertsSurfaceFromDock()` as `buildAlertPresentationGroups()`, but the authoritative current path calls `getGridlyAlertsPresentationCountModel()` first.

## 5. Exact point where PresentationRecord becomes available

The grouped PresentationRecord objects become available at the end of `presentation-record construction` inside `getGridlyAlertsPresentationCountModel()`. The open handler receives them as `presentationCountModel.alerts`; `presentationAlerts` is then selected from that model before any card rendering.

## 6. Fields available before grouping

Before grouping, normalized alert records can provide individual-alert fields: source id, type/category/subtype, title/headline/localized summary, subtitle/detail/description, severity, minutes text or timestamps, report kind, road/crossing/location fields, coordinates, source/raw provider payload, route relevance, priority model/score/reason, and awareness-area-like fields.

These are sufficient for temporary awareness copy limited to what happened, where, and how recent, as long as the copy avoids counts and aggregation claims.

## 7. Fields unavailable before grouping

The following require grouping or complete collection context: group counts, source indexes, evidence rows, grouped status, community evidence totals, duplicate-group counts, grouped alert count, final priority count when it takes the max of representative count/community count/raw group count, multi-source claims, community confirmation, final grouped status, and final PresentationRecord trust language.

## 8. Proposed minimal Display Candidate contract

A future Display Candidate should be non-authoritative and minimal:

| Field | Classification | Notes |
| --- | --- | --- |
| `candidateId` | Available before grouping | Deterministic temporary id from source id plus stage. |
| `sourceAlertId` | Available before grouping | From `id`, `reportId`, `uuid`, `incidentId`, or provider equivalent. |
| `alertType` | Available before grouping | From `type`, `category`, `hazardType`, or `reportType`. |
| `consumerTitle` | Available before grouping, potentially expensive | Use only narrow individual-alert wording; do not call aggregate PresentationRecord helpers. |
| `consumerLocation` | Available before grouping, potentially expensive | Prefer existing normalized road/location fields; coordinate road lookup is optional and should be budgeted. |
| `observedAt` | Optional | Use timestamp fields when present. |
| `freshnessLabel` | Available before grouping | From `minutesText`, `timeAgo`, or timestamp. |
| `latitude` | Optional | From normalized coordinate fields. |
| `longitude` | Optional | From normalized coordinate fields. |
| `awarenessAreaId` | Optional | Safe if already present; unsafe if deriving requires protected awareness filtering changes. |
| `sourceType` | Available before grouping | Provider/source classification only; no multi-source claim. |
| `priority` | Optional / expensive | Existing individual priority model may be used; final grouped priority is not safe. |
| `trustState` | Unsafe before grouping | Avoid except neutral source label such as `reported`; no final confidence. |
| `replacementKey` | Available before grouping | Use stable normalized source id or cluster-like key for later replacement. |

Smallest safe contract: `candidateId`, `sourceAlertId`, `alertType`, `consumerTitle`, `consumerLocation`, `freshnessLabel`, optional coordinates, `sourceType`, and `replacementKey`.

## 9. Proposed ownership model

Display Candidate ownership should be a neutral, read-only adapter at the boundary between normalized snapshot alerts and grouping. Mobile Portrait Alerts may own temporary display and replacement, but PresentationRecord remains authoritative for final cards. Provider normalization, awareness filtering, grouping, final presentation records, row selection, and protected systems should remain unchanged.

## 10. Proposed replacement or enrichment lifecycle

The safe lifecycle is:

1. Create at most one temporary candidate from the first normalized alert after snapshot availability.
2. Render it in a temporary slot owned by the Alerts sheet, explicitly marked non-authoritative.
3. Continue existing grouping and PresentationRecord creation unchanged.
4. Replace the temporary slot atomically when final `presentationAlerts[0]` and full sheet HTML are ready.
5. Bind focus only to final authoritative rows, or gate temporary focus by the same `replacementKey` and coordinates.

## 11. Duplicate and flicker prevention strategy

Use a single temporary slot id and a `replacementKey`. The final insertion should replace the entire temporary container rather than append to it. The temporary row must not increment counts, must not participate in hidden-row expansion, and must not mutate `window.__gridlyLatestAlertsForRender`. Final cards remain the only authoritative row set.

## 12. Protected-system risk assessment

A Display Candidate is feasible only if implemented after normalized alert availability and before PresentationRecord grouping without modifying provider normalization, selected-awareness-area filtering, alert lifecycle, Supabase synchronization, Mobile Portrait startup, final rendering, grouping, or protected systems. Emitting before snapshot completion would require provider/snapshot architecture changes and is not safe in this milestone.

## 13. Recommendation

Proceed with a future Display Candidate only as a tightly scoped, non-authoritative, post-snapshot/pre-grouping milestone. Do not attempt pre-snapshot provider streaming without an additional provider-ownership audit. Do not progressively render PresentationRecord.

## 14. Smallest possible future implementation milestone

Add a disabled-by-default, browser-validated experiment that creates one candidate from `snapshot.alerts[0]` after `alert snapshot creation` and before `presentation model creation`, renders it in a replace-only temporary container, and then atomically replaces it with the existing final Alerts sheet. The experiment must prove no final output, sorting, grouping, focus, or protected-system behavior changes.
