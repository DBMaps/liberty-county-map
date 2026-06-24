# GRIDLY V730 — Liberty Mobile Launch Readiness Surface Audit

## Determination

LIBERTY MOBILE LAUNCH READINESS SURFACE AUDIT  
PASS WITH OBSERVATIONS

## Executive answer: If a Liberty County resident used Gridly every day, what would fail first?

The first likely failure would not be the V729 cleared-count defect. Static review shows V729's shared active-count eligibility gate is now used before alert/location/route count surfaces read active rows, and the marker diagnostics still expose cleared-marker suppression separately.

The highest-risk remaining launch surface is **mobile lifecycle confidence under real browser refresh/rehydration timing**: a submitted road hazard or crossing can pass the static ownership pipeline, but Denise should still complete one real mobile browser submit → clear → refresh → reopen pass before final launch sign-off. This is an observation, not a blocker, because the current code has read-only audit helpers for the critical stages and no new static inconsistency was found.

## Scope guard

- Audit only.
- No runtime behavior changes.
- No UI behavior changes.
- No county onboarding.
- No Dispatch Board changes.
- No directional intelligence changes.
- No county operational status changes.

## Required user journey validation plan

| Step | Journey item | Static/audit status | Browser validation expectation |
| --- | --- | --- | --- |
| 1 | Open app | Covered by `gridlyUiSmokeTest` and `gridlyHealthCheck` availability. | App opens without stale runtime state. |
| 2 | Select Liberty / Dayton | Liberty default county and Dayton default city remain configured. | County/awareness selection reads Liberty/Dayton. |
| 3 | Create road hazard | Report visibility pipeline checks registration, county filtering, clustering, alert input, marker input, and awareness count stages. | New hazard appears in awareness, alerts, and markers. |
| 4 | Create blocked crossing | Crossing promotion audit checks crossing candidates, bottom count source, county/lifecycle/area refresh pass, and promotion state. | New crossing appears as crossing, not generic road hazard. |
| 5 | Verify visibility | Active reconciliation audit compares alerts, location awareness, route awareness, and markers. | No visible-but-uncounted or counted-but-invisible active issue. |
| 6 | Confirm active | Active-count eligibility rejects only cleared/recently-cleared/inactive rows. | Active issue remains counted until clear action. |
| 7 | Clear road hazard | Cleared persistence audit exists for cleared lifecycle review. | Cleared hazard is suppressed from active markers/counts. |
| 8 | Clear crossing | Crossing lifecycle should follow latest clear state. | Cleared crossing stops showing as active. |
| 9 | Refresh app | Refresh breakdown and post-submit refresh audits exist. | Counts remain reconciled after refresh. |
| 10 | Reopen app | Storage/county readiness audit keeps Liberty default and protected boundaries. | Rehydrated state does not resurrect cleared rows as active. |
| 11 | Verify lifecycle completion | V729 evidence says marker/count deltas returned to zero after clear. | Quiet copy returns when no other active issue exists. |

## Required surface inventory

| Surface | Owner/render path reviewed | V730 finding |
| --- | --- | --- |
| Awareness Area card | Lightweight active awareness model and awareness classification audit. | No static active/cleared mismatch found. |
| Location Awareness card | `getGridlyAlertsSurfaceActiveCommunityReportRows` shared count source plus active reconciliation audit. | Shares lifecycle-filtered source rows. |
| Alerts panel | Alerts snapshot/localized intelligence rows lifecycle-filtered by V729 helper. | No static cleared-as-active count path found. |
| Map markers | Unified marker audit/debug state and marker skip reasons. | Cleared/recently-cleared marker suppression remains observable. |
| Marker clusters | Marker audit includes clustered marker count and marker layer counts. | No separate blocker identified; validate on device. |
| Nearby filter | Geo filter state surfaced in UI smoke test. | Static helper can expose selected filter; browser pass still required. |
| Area filter | Awareness area/county helpers and crossing area filter state reviewed. | No Liberty/Dayton static exception found. |
| County filter | County registry, containment helpers, and storage readiness audit reviewed. | No county status changes made. |
| Delays filter | Covered as map/filter surface in static review only. | Browser-only consistency check recommended. |
| All filter | Covered as map/filter surface in static review only. | Browser-only consistency check recommended. |
| Road hazard popup | Report visibility pipeline covers road hazard registration and marker input. | No static blocker. |
| Crossing popup | Crossing promotion audit covers crossing candidates and naming quality. | No static blocker. |
| Bottom dock actions | UI smoke test checks report/route/alerts/settings/layers binding. | No static blocker. |
| Search button | Static surface review only. | Browser tap validation recommended. |
| Report flow | Report visibility pipeline and post-submit refresh audit reviewed. | No static blocker. |
| Settings access | UI smoke test and settings audit surface reviewed. | No static blocker. |
| Route/awareness counts | Active reconciliation audit explicitly compares route/location/alerts/markers. | No V729 regression found statically. |
| Recently-cleared behavior | Active-count eligibility rejects recently-cleared lifecycle states. | No static active-count leakage found. |
| Refresh behavior | Refresh breakdown and post-submit refresh audit reviewed. | Browser validation required for timing confidence. |
| Rehydration behavior | County storage readiness and localStorage/Supabase read paths reviewed. | No static blocker; real reopen pass recommended. |

## Required questions

1. **Do all surfaces agree on active incidents?** Static review says yes by ownership path: active count surfaces now share lifecycle-filtered rows; browser evidence should confirm on device.
2. **Do all surfaces agree on cleared incidents?** Static review says yes for active suppression; recently-cleared presentation remains a separate lifecycle behavior to verify visually.
3. **Do all surfaces agree after refresh?** No static blocker; browser refresh is the primary remaining observation.
4. **Do all surfaces agree after rehydration?** No static blocker; browser reopen is the primary remaining observation.
5. **Are any incidents visible but not counted?** No static evidence found. Use active reconciliation audit to confirm.
6. **Are any incidents counted but not visible?** V729 specifically addressed the cleared-count mismatch. No new static count-only path found.
7. **Do filters behave consistently?** Static paths exist, but Nearby/Area/County/Delays/All require Denise browser taps for final confidence.
8. **Does Dayton differ from Liberty County view in expected ways?** Expected: Dayton is an awareness-area/local view inside Liberty; county-wide Liberty can include broader county reports.
9. **Are there mobile-only defects?** No static blocker found. Remaining risk is mobile browser timing/rehydration, not a known defect.
10. **Is there any launch-blocking inconsistency remaining?** No. V730 is PASS WITH OBSERVATIONS.

## Static review: ownership and rendering paths

- **Awareness Area:** county registry declares Liberty default city Dayton and Liberty awareness areas; awareness classification builds candidate groups from active hazards, active reports, unified incidents, and alerts.
- **Location Awareness:** mobile awareness summary consumes active awareness/count models and displays quiet copy when no active incidents exist.
- **Alerts panel:** alert rows are filtered through `getGridlyAlertsSurfaceActiveCommunityReportRows`, which delegates to the shared active-count row filter.
- **Marker rendering:** marker audit/debug state tracks source count, rendered count, clustered marker count, and skip reasons.
- **Filter switching:** `activeGeoFilter` is exposed through `gridlyUiSmokeTest`; geo filter controls are structurally audited.
- **Report lifecycle:** `gridlyReportVisibilityPipelineAudit` walks accepted report → active inventory → county filter → cluster input → alert input → marker input → awareness counted.
- **Clear lifecycle:** `gridlyClearedHazardPersistenceAudit` exists, and active-count eligibility rejects cleared/recently-cleared/hazard-cleared rows.
- **Rehydration lifecycle:** county storage readiness audit validates active county identity, county-scoped metadata, and protected runtime boundaries.
- **Recently-cleared lifecycle:** V729 helper rejects recently-cleared records from active count surfaces while marker skip diagnostics remain available.

## Helper coverage and gaps

| Helper | V730 status |
| --- | --- |
| `gridlyUiSmokeTest` | Present; covers dock bindings, alerts/settings/layers visibility, marker source/render counts, and current filter. |
| `gridlyHealthCheck` | Present; basic app health helper remains exposed. |
| `gridlyActiveIncidentAudit` | Not found as exact helper name in `js/app.js`; equivalent active incident coverage exists through active hazard/count reconciliation and visible surface helpers. |
| `gridlyActiveHazardCountReconciliationAudit` | Present; central count/surface reconciliation helper. |
| `gridlyReportVisibilityPipelineAudit` | Present; report lifecycle pipeline helper. |
| `gridlyClearedHazardPersistenceAudit` | Present; clear persistence helper. |
| `gridlyCrossingAwarenessPromotionAudit` | Present; crossing classification/promotion helper. |
| `gridlyRefreshBreakdownAudit` | Present; refresh lifecycle breakdown helper. |
| `gridlyPostSubmitRefreshAudit` | Present; post-submit refresh helper. |

## Protected systems

| System | Required | V730 audit |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Unchanged / protected false. |
| `historyUiEnabled` | `false` | Unchanged / protected false. |
| `DriveTexasPaused` | `true` | Unchanged / protected true. |
| `TransportationIntelligenceEnabled` | `false` | Unchanged / protected false. |
| `TransportationIntelligenceDisplay` | `false` | Unchanged / protected false. |
| `TransportationIntelligenceActivation` | `false` | Unchanged / protected false. |

## County program boundaries

- Liberty: Launch Focus.
- Montgomery: Maintenance Mode.
- San Jacinto: Maintenance Mode.
- Jefferson: Deferred.
- V730 did not alter county registry, operational state, or Dispatch Board readiness.

## Final determination answers

1. **Is Liberty safe to continue toward launch?** Yes. Liberty is safe to continue toward launch.
2. **What is the highest-risk remaining defect?** Mobile browser refresh/rehydration timing could still be the first resident-facing failure if a cleared report is resurrected or if filter-specific counts drift after a real reopen.
3. **What is the next recommended launch-readiness milestone?** V731 should be a Denise-operated mobile browser lifecycle certification pass using the exact journey below, collecting helper output before/after clear, refresh, and reopen.
4. **Is a V731 fix required?** Not based on static review. V731 can be a validation milestone unless Denise reproduces a refresh/rehydration mismatch.
5. **Is Dispatch Board work safe to begin in parallel?** Yes, provided Dispatch Board work remains isolated and does not modify Liberty mobile awareness, filters, directional intelligence, or lifecycle/count ownership.

## Denise browser testing steps

1. Open the app on a mobile browser or mobile-sized browser session on this branch.
2. Hard refresh once.
3. Select **Liberty County**.
4. Select **Dayton** as awareness area.
5. Run `window.gridlyUiSmokeTest?.()` and save output.
6. Run `window.gridlyHealthCheck?.()` and save output.
7. Create one road hazard near Dayton.
8. Run `window.gridlyReportVisibilityPipelineAudit?.()` and save output.
9. Confirm the road hazard is visible in Awareness Area, Location Awareness, Alerts, map marker, and relevant filters.
10. Create one blocked crossing near Dayton.
11. Run `window.gridlyCrossingAwarenessPromotionAudit?.()` and save output.
12. Confirm the blocked crossing appears as a crossing, not as a generic road hazard.
13. Run `window.gridlyActiveHazardCountReconciliationAudit?.()` and save output.
14. Tap Nearby, Area, County, Delays, and All filters; confirm active issue count and visible marker rows agree for each filter.
15. Clear the road hazard.
16. Clear the blocked crossing.
17. Run `window.gridlyClearedHazardPersistenceAudit?.()` and save output.
18. Run `window.gridlyActiveHazardCountReconciliationAudit?.()` and confirm no cleared/recently-cleared item is counted as active.
19. Refresh the app.
20. Run `window.gridlyRefreshBreakdownAudit?.()` and `window.gridlyPostSubmitRefreshAudit?.()`.
21. Close and reopen the app/browser tab.
22. Run `window.gridlyUiSmokeTest?.()` and `window.gridlyActiveHazardCountReconciliationAudit?.()` again.
23. Expected final quiet state when no other active issue exists: `Community activity is quiet`, `No recent reports nearby`, marker source/render counts `0`, cleared/recently-cleared active count `0`, and alerts/location delta `0`.

## Merge recommendation

Merge V730 as an audit-only launch-readiness evidence milestone. Do not require a code fix before merge. Do require the V731 Denise mobile lifecycle certification before final launch sign-off.
