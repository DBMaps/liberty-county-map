# GRIDLY V729 — Liberty Cleared Incident Count Reconciliation

## Determination

LIBERTY CLEARED INCIDENT COUNT RECONCILIATION
PASS

## Summary

V729 fixes the Liberty/Dayton mismatch where marker rendering suppressed cleared or recently-cleared records, but shared active-count surfaces could still read those rows as active nearby issues. The fix adds a shared active-count eligibility gate before alert, location-awareness, route-awareness, and active unified incident count consumers calculate their active issue totals.

## Implementation

- Added `gridlyIsActiveCountSurfaceEligibleRecord()` to reject `cleared`, `recently_cleared`, `hazard_cleared`, `expired`, `inactive`, `historical`, and `stale` records from active count/source surfaces.
- Added `getGridlyActiveCountSurfaceRows()` as the shared row-level count/source filter.
- Updated `getGridlyAlertsSurfaceActiveCommunityReportRows()` so Location Awareness, Route Awareness, Alerts surface headers, and related reconciliation audits consume lifecycle-filtered rows.
- Updated `getActiveUnifiedIncidents()` so active unified incident consumers also exclude cleared/recently-cleared records before count surfaces can treat them as active.
- Left marker skip diagnostics intact so `cleared_or_recently_cleared` still proves marker rendering suppression, but no longer masks an upstream count defect.

## Required behavior covered

1. Cleared road hazards are excluded from active nearby/location counts.
2. Cleared crossing reports are excluded from active nearby/location counts.
3. Recently-cleared records are not counted as active issues nearby.
4. Marker rendering skip count no longer masks an upstream active-count defect.
5. Real active records remain counted because only explicit cleared/recently-cleared/inactive lifecycle states and cleared report types are rejected.
6. Protected systems remain unchanged.

## Protected systems

| System | Required | V729 |
| --- | --- | --- |
| historicalReadsEnabled | false | false |
| historyUiEnabled | false | false |
| DriveTexasPaused | true | true |
| TransportationIntelligenceEnabled | false | false |
| TransportationIntelligenceDisplay | false | false |
| TransportationIntelligenceActivation | false | false |

## County boundaries

- Liberty County remains launch focus.
- Montgomery and San Jacinto remain support/maintenance.
- Jefferson remains deferred.
- County registry operational state was not changed.
- Directional intelligence was not modified.

## Denise browser testing steps

1. Open the app on the V729 branch and select Liberty County / Dayton.
2. Create one road hazard near Dayton.
3. Create one blocked crossing report near Dayton.
4. Confirm both appear as active issues before clearing.
5. Clear the road hazard and blocked crossing.
6. Confirm the top/local copy says `No active local issues reported`.
7. Confirm the bottom/location/route awareness copy shows `0 active issues nearby` unless another truly active incident exists nearby.
8. Run `window.gridlyUiSmokeTest?.()` and confirm cleared records are not reflected as active marker source/count defects.
9. Run `window.gridlyActiveHazardCountReconciliationAudit?.()` and confirm `alertsVsLocationDelta` is `0` when no other active nearby issues exist.
10. If another truly active issue exists outside Dayton but nearby, confirm that issue remains counted and visible.
