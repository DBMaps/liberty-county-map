# GRIDLY LP028.8 — DriveTexas Area Retention and Refresh Repair

## 1. Previous destructive ownership

Before LP028.8, the live connector normalized each successful DriveTexas response and immediately filtered it against the currently selected awareness area. The filtered array was then stored as the connector's `normalizedRecords` value. That made the presentation view the only retained connector-owned data. Selecting another county or community could replace the previous area's official records with the newly filtered subset, so switching back depended on another successful fetch or another correct normalization/filter pass.

## 2. New source-versus-presentation ownership

LP028.8 separates source preservation from consumer presentation:

- `allNormalizedRecords` is the complete retained normalized DriveTexas source snapshot from the last successful fetch.
- `awarenessNormalizedRecords` is the current selected-awareness presentation view derived from `allNormalizedRecords`.
- `getNormalizedRecords()` remains compatible with existing consumers by returning the awareness presentation view.
- `getAllNormalizedRecords()` exposes the retained source snapshot for audits and tests.
- `getAwarenessRecords()` explicitly exposes the current awareness view.

## 3. Complete retained dataset owner

`js/gridlyDriveTexasLiveConnector.js` owns `allNormalizedRecords`. A successful fetch validates the GeoJSON payload, normalizes all provider rows once, clones the normalized rows, and atomically installs the new complete snapshot only after normalization succeeds. Area filters do not mutate or shrink this array.

## 4. Current area-view owner

`js/gridlyDriveTexasLiveConnector.js` also owns `awarenessNormalizedRecords`. It is rebuilt from `allNormalizedRecords` by `deriveAwarenessView()` and installed only through `installAwarenessView()`. The awareness view is the only DriveTexas array read by current Travel Brief consumers through the existing `getNormalizedRecords()` compatibility getter.

## 5. Fetch lifecycle

A fetch follows this lifecycle:

1. Build the configured DriveTexas endpoint.
2. Request the complete source payload using the existing retry and timeout policy.
3. Validate the GeoJSON contract.
4. Normalize all rows through the provider normalizer.
5. Atomically replace `allNormalizedRecords` after successful normalization.
6. Capture source timestamps and fetch generation metadata.
7. Derive the current awareness view from the complete retained source snapshot.
8. Notify the existing official-provider consumer refresh owner once for the derived view.

Failed fetches record `lastFetchError` and preserve the prior retained source snapshot and awareness view instead of replacing valid retained data with an empty array.

## 6. Area-change lifecycle

County, community, or awareness-mode changes call the connector's `refreshAwarenessView(reason)` hook. The hook:

1. Captures the authoritative selected awareness context once.
2. Filters the retained complete source snapshot once.
3. Installs the new area view.
4. Records the filter reason, county, community, coordinates, radius, mode, generation, and timestamp.
5. Notifies the existing official-provider consumer refresh owner once after the derived view is ready.

The authoritative context fields are `countyId`, `label`/community, `storageValue`, `key`, `lat`, `lng`, `radiusMiles`, `countyWide`/mode, and text fallback terms derived from label, storage value, key, and county id. Current map viewport bounds are not used as ownership for the selected area.

## 7. Race protection

Area-view derivation uses `areaViewGeneration`. Stale completions that do not match the latest generation are ignored and counted by `staleAreaViewCompletionIgnoredCount`.

Fetch replacement uses fetch generation metadata (`fetchGeneration`, `lastInstalledFetchGeneration`, and `staleFetchCompletionIgnoredCount`). The connector preserves bounded duplicate in-flight behavior by returning the existing in-flight promise for normal `fetchNow()` calls, while still recording fetch-generation ownership for late-response protection.

## 8. Travel Brief refresh owner

The bounded refresh owner remains `gridlyOfficialProviderConsumerRefresh()`. The connector does not render the Travel Brief per record and does not scatter direct rendering calls into low-level filtering. After a successful fetch or area-view replacement, the connector sends one provider evidence notification and the official-provider activation layer coalesces the consumer refresh.

## 9. Failure behavior

LP028.8 preserves the existing connector freshness interval (`180000` ms) and retry budget. It does not introduce a new long-lived stale-data policy. On failure, the connector truthfully records the error, marks the latest fetch as unsuccessful, and keeps the last successful complete source snapshot and derived awareness view when safe.

## 10. LP016 protection

Filtering captures selected awareness once per filter operation through `activeAwarenessArea()` and passes that captured context into `matchesAwarenessArea()`. The per-record matching function does not call awareness resolution. LP016 counters remain protected: filter operations increment once per derivation and `driveTexasPerRecordAwarenessLookupCount` remains zero.

## 11. Source-field preservation

The complete retained dataset stores the provider-normalized rows without presentation-category trimming. Unknown categories, raw advisory text, roadway fields, coordinates, timestamps, direction fields, lane data, closure details, identifiers, and unmapped useful fields remain in `allNormalizedRecords` even when they are outside the current awareness area or not currently presented in Travel Brief.

## 12. Browser validation steps

1. Select Livingston.
2. Wait for DriveTexas refresh and derived filtering.
3. Open Current Conditions.
4. Run `window.gridlyLp028TravelBriefOfficialSourceTrace?.()` or `window.gridlyLp028DriveTexasAreaLifecycleAudit?.()`.
5. Record complete source count, Livingston awareness-view count, selected record IDs, and official Travel Brief lines.
6. Switch to Dayton without reloading.
7. Run the audit again.
8. Confirm the complete source count remains preserved, Dayton has its own derived awareness view, Livingston records remain in `getAllNormalizedRecords()`, and Travel Brief matches Dayton.
9. Switch back to Livingston without reloading.
10. Confirm Livingston awareness records return from retained source data when applicable, no new fetch was required if data remained fresh, selected Livingston IDs match retained source records, Travel Brief matches Livingston, and no stale Dayton text appears.
11. Repeat with Polk County mode and Livingston community mode if their radius behavior differs.
12. Trigger a manual DriveTexas refresh using the existing supported UI/runtime action.
13. Confirm successful fetch replacement is atomic, the current area view is re-derived, Travel Brief updates after derivation, and previous records remain available until successful replacement.

## 13. Remaining separate DriveTexas unified-incident work

This milestone does not promote DriveTexas records into unified incidents. Full DriveTexas unified-incident restoration remains separate from LP028.8 and should be handled in a focused future milestone.
