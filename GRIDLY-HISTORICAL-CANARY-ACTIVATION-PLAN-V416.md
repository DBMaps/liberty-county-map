# Gridly Historical Canary Activation Plan V416

## Mission guardrail

Gridly remains **Awareness Platform First, Route Intelligence Second**.

This V416 milestone is a planning and governance document only. It defines the safest possible future canary activation process for passive historical evidence collection, but it does **not** activate capture, enable the writer, create writes, read historical data in the app, expose history UI, change awareness behavior, change alerts, change markers, change Route Watch, modify Supabase, run SQL, or change production behavior.

DriveTexas remains designed, validated, governed, and paused. This plan does not modify, restart, or depend on DriveTexas implementation work.

## Current state

Runtime validation after V415 reports the historical stack as available, loaded, wired, dormant, and safe for a future canary activation decision:

- `available: true`
- `sidecarsLoaded: true`
- `captureEnabled: false`
- `writerEnabled: false`
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `storageClientAvailable: true`
- `writerAvailable: true`
- `monitoringAvailable: true`
- `canWriteIfEnabled: true`
- `currentlyDormant: true`
- `writesBlockedByDefault: true`
- `protectedSystemsUnchanged: true`
- `blockers: []`
- `safeForCanaryActivation: true`

Current dormant guarantees:

- Capture is disabled by default.
- Writer is disabled separately from capture.
- Historical reads are disabled.
- History UI is disabled.
- Monitoring is runtime/in-memory only unless a future milestone separately approves persistence.
- The production hook path remains fail-open and must not block live reporting.
- Protected awareness and route-intelligence systems remain unchanged.

## Canary Activation vs Full Evidence Collection

### Canary Activation

Canary Activation is a small, explicitly approved, reversible production test whose only purpose is to prove that passive historical capture can append a tiny number of Phase 1A historical envelopes without affecting live awareness behavior.

A canary:

- Enables the minimum required capture and writer gates only for the approved canary window.
- Collects a deliberately small number of historical events.
- Uses no app historical reads and no history UI.
- Makes no schema changes and runs no SQL.
- Stops immediately after the event target, time limit, or any failure condition.
- Produces governance evidence for deciding whether full evidence collection may be considered later.

### Full Evidence Collection

Full Evidence Collection is a later, separate approval state. It would allow passive historical collection to run beyond the canary event/time limits after the canary has passed and governance has reviewed the resulting evidence.

This V416 plan does **not** approve Full Evidence Collection.

## Activation prerequisites

All prerequisites must be true before any future canary activation begins:

1. Written approval exists for a dedicated canary activation milestone after V416.
2. The approved milestone identifies the exact deployment, operator, start time, stop time, event target, and rollback owner.
3. The app build being activated is the same build that passed the dormant V415 wiring audit or a later build that has passed equivalent dormant validation.
4. No unrelated feature release is being deployed during the canary window.
5. The historical sidecars are loaded in production runtime and remain dormant before activation.
6. The existing Supabase storage client is available to the dormant historical path.
7. The writer implementation is available but gated off before activation.
8. The monitoring sidecar is available for runtime inspection.
9. Live reporting, clearing, awareness, marker, alert, and Route Watch behavior is healthy before activation.
10. The operator has confirmed that rollback can be performed by disabling writer first and capture second.
11. No schema migration, SQL execution, data backfill, historical read feature, or history UI feature is bundled with activation.
12. The canary is limited to Phase 1A event types only: `report_created` and `report_cleared`.

## Exact flags that must be enabled

The future canary requires two separate positive gates, and both must be scoped to the canary window only:

1. `captureEnabled: true`
   - Purpose: allows the Phase 1A sidecar to build historical envelopes from approved live event inputs.
   - Scope: canary only.
   - Must return to `false` at rollback or canary completion.

2. `writesEnabled: true` or the equivalent writer gate consumed as `writerEnabled: true`
   - Purpose: allows the writer to attempt append-only historical inserts.
   - Scope: canary only.
   - Must be treated as independent from capture.
   - Must return to `false` before or at the same time as `captureEnabled` returns to `false`.

Flags that must remain disabled throughout canary:

- `historicalReadsExposed: false`
- `historicalReadsEnabled: false` if present
- `uiExposed: false`
- `historyUiEnabled: false` if present
- Any persistent monitoring-write flag, unless separately approved in a later milestone
- Any broad production hook expansion beyond the existing Phase 1A report-created/report-cleared hooks

## Exact runtime conditions before activation

Before enabling any canary flag, the runtime must satisfy all of the following:

- `window.gridlyHistoricalCaptureWiringAudit?.()` is callable.
- `available === true`.
- `sidecarsLoaded === true`.
- `captureEnabled === false`.
- `writerEnabled === false`.
- `historicalReadsEnabled === false`.
- `historyUiEnabled === false`.
- `storageClientAvailable === true`.
- `writerAvailable === true`.
- `monitoringAvailable === true`.
- `canWriteIfEnabled === true`.
- `currentlyDormant === true`.
- `writesBlockedByDefault === true`.
- `protectedSystemsUnchanged === true`.
- `blockers` is an empty array.
- `safeForCanaryActivation === true`.
- Live report creation and live report clearing work normally before activation.
- Existing map markers, active hazards, alerts, and Route Watch displays match their pre-canary baseline.

If any condition is false, canary activation is not approved.

## Required audits

The following audits must pass before canary activation:

### 1. Dormant wiring audit

Run `window.gridlyHistoricalCaptureWiringAudit?.()` and verify the exact current-state values listed above. This audit must be captured before activation.

### 2. Sidecar audit

Run `window.gridlyPassiveHistoryCaptureSidecarAudit?.()` if available and verify:

- Sidecar API is available.
- Gates are default disabled before activation.
- Writes are disabled before activation.
- Installed hooks are limited to crossing and road-hazard report-created/report-cleared hooks.
- Supported event types are Phase 1A only.
- Historical reads are not exposed.
- UI is not exposed.
- Writer is implemented.
- Monitoring is implemented.

### 3. Protected-system baseline audit

Before activation, record baseline behavior for:

- `loadSharedReports()` result freshness and error state.
- `activeHazards` count and representative IDs.
- `getLiveHazardIncidents()` output count and representative IDs.
- `unifiedRoadIncidents()` output count and representative IDs.
- `activeUnifiedIncidents` count and representative IDs.
- Alerts shown in the UI.
- Awareness state and visible awareness affordances.
- Marker count, marker type mix, and map visibility.
- Route Watch enabled/disabled state and visible route state.

### 4. Source/change audit

Confirm the activation change contains no unrelated code changes and no changes to protected systems. The only acceptable future activation change is the minimal canary gating/configuration needed to turn on capture and writer for the canary scope.

### 5. Storage safety audit

Confirm no schema migration, SQL script, table alteration, policy alteration, backfill, purge, or manual Supabase mutation is part of the canary activation.

## Required runtime checks

During canary activation, operators must repeatedly verify:

- App remains usable.
- Live reporting still succeeds.
- Live clearing still succeeds.
- The hook path remains fail-open if historical capture encounters an error.
- No historical reads are used by the app.
- No history UI appears.
- No marker behavior changes.
- No alert behavior changes.
- No awareness behavior changes.
- No Route Watch behavior changes.
- No protected-system console errors appear.
- Historical writer attempts match the small expected event count.
- Duplicate/idempotency behavior does not create repeated records for the same event.

## Canary activation sequence

This sequence is for a future explicitly approved activation milestone only:

1. Announce the canary window, target event count, owner, and rollback owner.
2. Freeze unrelated deployments for the canary window.
3. Capture pre-canary screenshots or operational notes for live awareness, markers, alerts, and Route Watch state.
4. Run the dormant wiring audit and sidecar audit.
5. Run protected-system baseline checks.
6. Confirm no blockers and no unrelated production incidents.
7. Enable the writer gate only in the approved canary configuration path, but do not yet generate canary events.
8. Enable the capture gate only in the same approved canary configuration path.
9. Generate or wait for the approved small number of natural Phase 1A events.
10. Observe monitoring after each event.
11. Stop immediately when the event target is reached, the time limit is reached, or any failure condition appears.
12. Disable writer first.
13. Disable capture second.
14. Re-run dormant wiring audit and protected-system checks.
15. Conduct data review outside the app UI and document findings.

## Monitoring sequence

Monitor in this order:

1. Before activation:
   - Wiring audit result.
   - Sidecar audit result.
   - Browser console errors/warnings.
   - Live report creation and clearing health.
   - Protected-system baseline.

2. Immediately after gates are enabled:
   - Confirm capture and writer gates are enabled only for canary.
   - Confirm historical reads and history UI remain disabled.
   - Confirm no write occurs until an approved Phase 1A event happens.

3. After each canary event:
   - Writer success/noop/error status.
   - In-memory monitoring counters/events.
   - Event type.
   - Hook name.
   - Idempotency key presence.
   - Envelope shape validity.
   - Append-only insert count.
   - Live awareness/marker/alert behavior.

4. At canary stop:
   - Writer gate disabled.
   - Capture gate disabled.
   - Dormant audit returns to safe disabled state.
   - Protected systems still match expected live behavior.

## Success criteria

A canary is successful only if all of the following are true:

- Canary was explicitly approved and bounded by time and event count.
- Only `captureEnabled` and the writer gate were enabled.
- Historical reads and history UI remained disabled for the entire canary.
- No protected systems changed behavior.
- No live report creation or clearing failures were caused by historical capture.
- No awareness, alert, marker, or Route Watch regressions occurred.
- Historical capture remained fail-open.
- Exactly the approved number of append-only historical events, or fewer if the time limit was reached, were created.
- Event envelopes have expected Phase 1A shape.
- Event types are limited to `report_created` and `report_cleared`.
- Idempotency keys are present and duplicates are not created for the same source event.
- Monitoring shows no unexpected writer errors.
- Post-canary audit returns to dormant disabled state.
- Beta reset implications are recorded.

## Failure criteria

A canary fails immediately if any of the following occurs:

- Any unapproved flag is enabled.
- Historical reads are enabled or used by the app.
- History UI appears.
- More than the approved event count is written.
- Any historical write occurs before the approved canary window.
- Any historical write occurs after rollback or canary stop.
- Duplicate records are created for the same source event.
- Live report creation or clearing is slowed, blocked, or fails due to historical capture.
- `loadSharedReports()` behavior changes unexpectedly.
- `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents()`, or `activeUnifiedIncidents` changes unexpectedly for reasons unrelated to live data.
- Alerts, awareness, markers, or Route Watch change unexpectedly.
- Browser console errors indicate historical capture is affecting live runtime behavior.
- Storage client failures propagate to live workflows.
- Any schema, SQL, policy, or Supabase manual mutation is introduced.
- DriveTexas work is touched, restarted, or made part of activation.

## Event count target

The safest canary should collect **6 historical events maximum**:

- Up to 3 `report_created` events.
- Up to 3 `report_cleared` events.

The canary may be considered complete with fewer than 6 events if the time limit is reached and at least one successful `report_created` event plus one successful `report_cleared` event has been observed. If no clear event naturally occurs within the window, do not extend the canary without a new approval; stop at the time limit and classify the result as partial, not failed, provided no failure criteria occurred.

## Canary duration

The canary should run for **30 minutes maximum**, with an immediate stop once 6 historical events have been collected.

Recommended timing:

- 5 minutes: pre-activation audit and baseline capture.
- Up to 20 minutes: active canary window.
- 5 minutes: rollback/dormancy verification and protected-system recheck.

Do not extend the canary in place. A longer run is Full Evidence Collection or a second canary and requires separate approval.

## Protected-system validation sequence

### Before canary

Validate and record:

- `loadSharedReports()` continues to load live shared reports.
- `activeHazards` reflects expected live state.
- `getLiveHazardIncidents()` returns expected live hazards.
- `unifiedRoadIncidents()` returns expected live incidents.
- `activeUnifiedIncidents` reflects expected live incident state.
- Alerts render and clear normally.
- Awareness UI and map state are unchanged.
- Markers render with expected count and types.
- Route Watch remains in its pre-canary state.

### During canary

After each canary event, verify:

- Live report appears or clears in the current app state as expected.
- Historical capture did not block or delay the live flow.
- Marker updates match live behavior only.
- Alerts and awareness are unchanged except for normal live data changes.
- Route Watch behavior is unchanged.
- No protected-system exceptions appear in console logs.

### After canary

After disabling writer and capture, verify:

- Dormant audit returns to disabled gates.
- Live report loading still succeeds.
- Active hazards and unified incidents remain consistent with live state.
- Alerts, awareness, markers, and Route Watch remain normal.
- No lingering historical timers, UI affordances, reads, or writes remain active.

## Data-review checklist

Review canary data outside the production app UI. The production app must not gain historical reads or history UI for this review.

Inspect:

- Total canary row count is 1 to 6, never more than 6.
- Created timestamps fall only inside the approved canary window.
- Event types are only `report_created` and `report_cleared`.
- Hook names are only the approved Phase 1A hooks.
- Required envelope fields are present.
- Source report identifiers are present where expected.
- Idempotency keys are present.
- No duplicate idempotency keys exist.
- Payloads do not contain unexpected sensitive data beyond the already approved live report snapshot fields.
- Rows are append-only; no existing rows were updated or deleted.
- Error/noop monitoring records, if inspected in memory, match expectations.

## Rollback sequence

If any issue occurs, rollback immediately:

1. Stop generating canary events.
2. Disable writer gate first.
3. Confirm writer attempts stop.
4. Disable capture gate second.
5. Confirm `captureEnabled === false` and `writerEnabled === false` through the wiring audit.
6. Confirm historical reads and history UI remain disabled.
7. Re-run protected-system checks.
8. Record the failure condition, time, suspected cause, and any canary rows created before rollback.
9. Do not purge, alter, or manually mutate Supabase as part of emergency rollback unless a separately approved data-remediation milestone authorizes it.
10. Treat any created canary rows as beta data subject to the beta reset policy.

Rollback is successful only when the runtime is dormant again and live awareness behavior is normal.

## Transition criteria to evidence collection

Moving from canary to Full Evidence Collection requires a separate approval milestone and all of the following evidence:

- Canary completed within the approved time and event count.
- No failure criteria occurred.
- Post-canary dormant audit passed.
- Protected-system before/during/after checks passed.
- Data review found valid envelopes, valid event types, valid hooks, and no duplicates.
- Beta reset implications were accepted.
- Operators documented exact canary start/stop times and row count.
- A governance decision explicitly approves Full Evidence Collection scope, duration, event budget, monitoring expectations, and rollback owner.

Absent that separate approval, the system must remain dormant after the canary.

## Beta reset implications

If canary data is created, it becomes beta historical data and must be treated as purgeable/resettable. Implications:

- Canary rows are not production evidence collection rows unless governance later classifies them as acceptable seed evidence.
- Canary rows must be included in any beta reset or historical data purge plan.
- The canary plan should record enough metadata to identify canary rows by timestamp window, event type, hook, and deployment version.
- No purge should be executed during V416 or during emergency rollback unless separately approved.
- Any future beta reset plan must account for canary rows before broader evidence collection starts.

## Explicit non-approvals

V416 does not approve:

- Capture activation.
- Writer activation.
- Historical writes.
- Historical reads.
- History UI.
- Awareness changes.
- Alert changes.
- Marker changes.
- Route Watch changes.
- DriveTexas changes.
- Schema changes.
- SQL execution.
- Supabase manual mutations.
- Backfills.
- Persistent monitoring writes.
- Full Evidence Collection.
- Production activation.
- Any new framework.

## Final recommendation

Proceed to a future canary activation milestone only if the dormant V415 runtime audit remains clean and the future milestone implements a strictly bounded canary with separate capture and writer gates, a 6-event maximum, a 30-minute maximum duration, immediate writer-first rollback, no historical reads, no history UI, no protected-system changes, and explicit beta-reset accounting for any rows created.

Until that future milestone is approved, keep the historical system dormant.
