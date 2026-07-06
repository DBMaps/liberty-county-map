# GRIDLY V894A Beta Interaction Latency Audit

## Objective

Audit the first controlled-beta reports of visible interaction delay before patching runtime behavior. This is an audit-only milestone for identifying likely latency sources and the smallest safe follow-up patch.

## Scope confirmation

No product behavior was changed. This audit does not modify Supabase schema, hazard lifecycle rules, alert generation logic, awareness filtering, Route Watch, report acceptance logic, clearing eligibility logic, or protected systems.

## Browser-console helper

Run this helper after app load, after opening Alerts, after submitting a report, or after clearing a hazard:

```js
window.gridlyBetaInteractionLatencyAudit?.()
```

The helper is read-only. It reports existing runtime/audit state and DOM visibility only; it does not synthesize clicks, submit reports, clear reports, force live refreshes, or mutate product data.

## Measurements covered

The helper reports:

- App startup readiness timing from `performance.getEntriesByType("navigation")`, `document.readyState`, loaded crossing/report counts, shared-report in-flight state, and crossing-load failure state.
- Time until Alerts can be opened by checking whether Alerts launch triggers exist and whether an Alerts surface is already visible.
- Alerts panel open tap-to-visible timing protocol, without firing synthetic clicks.
- Report submit tap-to-confirmation timing from the latest hazard submit lifecycle and V891 hazard propagation stages.
- Report submit confirmation-to-visible-marker/panel-update timing from V891 local propagation timing.
- Clear action tap-to-visible-removal ownership, identifying local containment plus post-clear refresh functions.
- Whether synchronous refresh chains may block UI interaction by exposing `gridlyRefreshAuditState.lastChildDurations` and refresh source counts.
- Whether panels wait on data before opening.
- Whether local optimistic UI is possible.
- Functions that appear to control report refresh, alert refresh, clear refresh, and panel open readiness.

## Likely delay sources

| Delay source | Classification | Evidence |
| --- | --- | --- |
| Initial shared-report/crossing readiness | Startup blocking | Early app readiness can depend on crossing/report loading and `loadSharedReports()` state before surfaces have settled. |
| `openGridlyPortraitV2Sheet("alerts")` plus immediate alert-location sync | Panel open blocking | The Alerts sheet opens synchronously from template/body rendering, then runs alert-location sync immediately after alert render. |
| Desktop `renderAlerts()` | Panel open blocking / propagation-re-render delay | Desktop Alerts rebuilds alert HTML from current corridor/incident intelligence and schedules alert-location sync. |
| `createSharedReport()` crossing path | Post-submit refresh blocking | The crossing report path awaits `runPostSubmitRefresh()` before completion, tying visible updates to live refresh latency. |
| `createSharedHazardReport()` hazard path | Post-submit refresh blocking / propagation-re-render delay | The hazard path already creates a local accepted hazard and schedules local surface refresh, then runs `loadSharedReports()` in the background. This is the best model for a safe follow-up. |
| `window.clearHazard()` | Post-clear refresh blocking | Clear applies local containment and confirms success, but then awaits `runPostSubmitRefresh()` and reapplies containment, so removal can still be coupled to live refresh and full render chains. |
| `loadSharedReports()` | Startup blocking / post-submit refresh blocking / post-clear refresh blocking | It reads live reports and recent cleared rows, normalizes records, filters by county/lifecycle, updates active collections, calls `refreshReportHazardViews()`, schedules marker render, and triggers additional unified-incident renders. |
| `refreshReportHazardViews()` | Propagation/re-render delay | It performs multiple synchronous child updates: localized intelligence, unified incidents, crossing scheduling, desktop alerts/road-hazard/trending/route intelligence/trust/growth/community-pulse previews, daily habit status, mobile alert mirror, smart-alert banner, last-updated text, movement intelligence, and corridor summary cards. |

## Delay classification summary

- **Startup blocking**: initial crossing/report readiness, Supabase live-report reads, `loadSharedReports()` in-flight/dedupe state, and first refresh cycle settlement.
- **Panel open blocking**: Alerts sheet template/body render, immediate alert-location sync, and desktop `renderAlerts()` rebuilding alert rows from current intelligence.
- **Post-submit refresh blocking**: crossing reports await `runPostSubmitRefresh()`; hazard reports are safer because they add a local accepted hazard before the background refresh.
- **Post-clear refresh blocking**: `clearHazard()` performs local containment but still awaits the same post-submit refresh chain after confirmation.
- **Propagation/re-render delay**: `loadSharedReports()` → `refreshReportHazardViews()` → child renders and delayed unified-incident timers can make panels/markers appear stale even after the write or clear succeeds.

## Function ownership map

- **Report refresh**: `runPostSubmitRefresh()`, `runPostSubmitRefreshInBackground()`, `loadSharedReports()`, `refreshReportHazardViews()`.
- **Alert refresh**: `renderAlerts()`, `scheduleGridlyAlertLocationSync()`, `runGridlyAlertLocationSyncAfterAlertRender()`, `updateMobileAlertsMirror()`.
- **Clear refresh**: `window.clearHazard()`, `gridlyApplyClearedHazardAwarenessContainment()`, `runPostSubmitRefresh()`.
- **Panel open readiness**: `openGridlyPortraitV2Sheet()`, `openPortraitV2Sheet()`, `bindV2SheetActions()`, and desktop `renderAlerts()`.

## Local optimistic UI assessment

Local optimistic UI is possible and already partially implemented for hazard submission: the hazard report path normalizes a local row, adds it to `activeHazards`, registers it as accepted local data, schedules local surface refresh, and records local marker/alert stages before the background live refresh completes.

The crossing report and clear paths are the safer follow-up candidates because they still have more user-visible coupling to `runPostSubmitRefresh()` / `loadSharedReports()`.

## Smallest safe follow-up patch recommendation

1. Keep panel opening instant: open Alerts immediately from cached/local state, then refresh content asynchronously if needed.
2. Mirror the hazard optimistic pattern for crossing report submission and clear actions: update local accepted/cleared collections and schedule local surface refresh before awaiting live `loadSharedReports()`.
3. Split `refreshReportHazardViews()` into immediate critical updates and deferred non-critical renders using existing scheduling helpers.
4. Do not change hazard lifecycle, alert generation, awareness filtering, Route Watch, report acceptance, clearing eligibility, or Supabase schema.

## Product behavior confirmation

Confirmed: V894A is audit-only. The runtime addition is a read-only browser-console helper, and this document records findings/recommendations only. No product behavior, protected system, report lifecycle, alert generation, or database behavior was changed.
