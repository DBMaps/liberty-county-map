# GRIDLY V891 — Hazard Propagation Timing Audit

## Purpose

V891 adds audit-only instrumentation for measuring how quickly a newly submitted road hazard is acknowledged, inserted, restored into the reporting device's local incident inventory, rendered locally, and verified from another device. The milestone is for beta confidence only: it does not change reporting submission logic, Supabase write behavior, hazard lifecycle rules, alert generation, map rendering, Community Pulse, Know Before You Go, Alerts, Search, Route Watch, Weather, Settings, or protected systems.

## Timing stages

The reporting-device timing helper records these stages when the existing report flow reaches them:

1. `report_flow_opened` — report UI opened.
2. `hazard_type_selected` — hazard type or Other Hazard subtype selected.
3. `location_selected` — tap-map location selected when applicable.
4. `submit_tapped` — submit flow entered.
5. `validation_complete` — existing validation completed and payload metadata is ready.
6. `supabase_write_started` — existing Supabase insert starts.
7. `supabase_write_completed` — existing Supabase insert succeeds.
8. `local_refresh_requested` — existing post-submit local refresh is requested.
9. `local_incident_source_refreshed` — local active hazard / incident source has the accepted hazard or post-submit refresh completed.
10. `local_marker_rendered` — local visibility is measured from accepted local incident inventory / marker surface availability.
11. `local_alerts_updated` — local alert surface refresh was requested through the existing post-submit refresh path.
12. `local_community_pulse_know_before_you_go_updated` — local Community Pulse / Know Before You Go refresh was requested through the existing post-submit refresh path.

## Local-device verification protocol

Device A:

1. Open Gridly.
2. Set the intended awareness area/county.
3. Submit a test road hazard using the normal report flow.
4. Open the browser console and run:

   ```js
   window.gridlyHazardPropagationTimingAudit?.()
   ```

5. Confirm the returned object includes:
   - `available: true`
   - `auditOnly: true`
   - `lastReportId`
   - `lastReportFingerprint`
   - `lastSubmitStartedAt`
   - `lastSupabaseWriteCompletedAt`
   - `localVisible`
   - `localPropagationMs`
   - populated `stages`
6. Copy `lastReportId` when present. If it is not convenient for testers, copy `lastReportFingerprint`.

## Second-device verification protocol

Device B:

1. Open Gridly in another phone/browser.
2. Select the same awareness area/county as Device A.
3. Run:

   ```js
   window.gridlyVerifyHazardVisibleForDevice?.("<copied-id-or-fingerprint>")
   ```

4. If `visibleOnThisDevice` is `false`, run the optional safe refresh helper:

   ```js
   await window.gridlyRefreshAndVerifyHazardVisible?.("<copied-id-or-fingerprint>")
   ```

5. Record:
   - `visibleAfterRefresh`
   - `refreshDurationMs`
   - `verification.matchedIncident`
   - `verification.matchedMarker`
   - `verification.matchedAlert`
   - `verification.matchedBriefing`
   - `verification.notes`

The verification helper is non-mutating. The refresh-and-check helper only calls the existing normal shared-report refresh path and then performs the same read-only visibility check; it does not create, modify, clear, or delete hazard data.

## Copying the report id or fingerprint

After a successful report, run:

```js
window.gridlyHazardPropagationTimingAudit?.()
```

Copy `lastReportId` first. If that value is unavailable or difficult to identify, copy `lastReportFingerprint`. The fingerprint encodes the hazard type, rounded submitted coordinate, locality/road phrase when available, and a timestamp window so another device can search currently loaded records without knowing the Supabase row id.

## Expected timing interpretation

- `supabase_write_started` to `supabase_write_completed` measures network/write latency.
- `supabase_write_completed` to `local_incident_source_refreshed` measures local post-submit refresh and incident-source propagation.
- `submit_tapped` to `local_marker_rendered` is the primary reporting-device local propagation duration.
- Device B `visibleOnThisDevice: false` before refresh but `visibleAfterRefresh: true` after refresh indicates cross-device freshness/polling delay rather than a failed write.
- Device B `visibleAfterRefresh: false` suggests awareness-area mismatch, lifecycle filtering, an expired/cleared hazard, or a shared-report refresh/load issue.

## Delay source categories

The timing audit reports these possible delay sources:

- Validation / payload metadata preparation.
- Supabase insert latency.
- Post-submit refresh scheduling.
- Shared-report refresh/load latency.
- Incident normalization or lifecycle filtering.
- Marker render scheduling.
- Alerts and briefing surface refresh scheduling.
- Second-device polling interval or manual-refresh timing.
- Awareness-area/county mismatch between devices.

## Protected systems confirmation

V891 is audit-only. It does not alter:

- Reporting submission logic.
- Supabase write behavior or payload shape.
- Hazard lifecycle rules.
- Alert generation.
- Map rendering logic.
- Community Pulse.
- Know Before You Go.
- Alerts.
- Search.
- Route Watch.
- Weather.
- Settings.
- Other protected systems.

## Beta acceptance thresholds

Suggested beta thresholds:

- Reporting device confirmation: under 3 seconds on a normal network.
- Reporting device visible marker/alert: under 5 seconds.
- Second device visible after manual refresh: under 10 seconds.
- Second-device passive visibility depends on the active polling/realtime interval and should be documented separately from manual refresh timing.

## Readiness audit

Run:

```js
window.gridlyHazardPropagationReadinessAudit?.()
```

The helper should report timing instrumentation availability, cross-device verification availability, optional refresh-and-verify availability, fingerprint support, protected-system confirmation, and the recommended two-device protocol.
