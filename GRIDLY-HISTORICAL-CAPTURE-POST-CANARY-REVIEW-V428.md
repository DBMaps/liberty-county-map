# V428 — Historical Capture Post-Canary Review

## 1. Quick Summary

V428 is an audit-only post-canary documentation pass. It does not enable historical reads, history UI, monitoring access, retention access, analytics consumption, historical intelligence, broader capture categories, additional canaries, or DriveTexas work.

The first verified production historical capture write succeeded after the approved production changes were applied by an authorized production operator:

```text
eventsObserved: 1
eventsWritten: 1
writerErrors: 0
protectedSystemsUnchanged: true
```

Writer diagnostics for the verified canary were clean:

```text
errorCode: null
errorMessage: null
lastFailureAt: null
safeForFixAnalysis: true
```

Production changes reported as successfully applied before the canary:

- `history_capture` exposed through the Data API.
- V425 migration executed successfully.
- INSERT permissions verified.
- RLS preserved.
- Monitoring isolation preserved.
- Retention isolation preserved.

Assessment: Historical Capture has proven one bounded production write path. Protected systems remained unchanged. The system should return to a dormant, write-blocked state until a separate future milestone approves broader evidence collection.

DriveTexas remains designed, validated, governed, and paused. No DriveTexas restart is recommended.

## 2. Production Canary Evidence Summary

### Exact canary sequence

1. Authorized production operator exposed the approved `history_capture` schema through the Supabase Data API alongside the existing approved schemas.
2. Authorized production operator applied the V425 production migration.
3. Operator verified the writer's least-privilege production path:
   - `anon` can use the `history_capture` schema for the approved write path.
   - `anon` can INSERT into `history_capture.historical_events`.
   - RLS remained enabled.
   - The approved Phase 1A insert policy was present.
   - Monitoring and retention tables remained isolated from the public writer path.
4. Operator activated the bounded historical canary controls for the approved canary window only.
5. One Phase 1A production event was observed.
6. The writer inserted one historical event.
7. Canary diagnostics were collected.
8. Writer and capture gates were shut down after the canary.
9. Protected systems were checked for unchanged behavior.

### Canary activation

The canary activation was bounded to the existing manual canary path. It did not authorize a standing capture program. The only intended enabled gates during the canary were the capture gate and the writer gate needed for the one controlled Phase 1A write.

### Event observed and written

| Evidence item | Verified value | Review conclusion |
| --- | ---: | --- |
| Events observed | `1` | The canary saw exactly one eligible production event. |
| Events written | `1` | The writer successfully persisted exactly one historical event. |
| Writer errors | `0` | No writer failure occurred during the verified canary. |
| Protected systems unchanged | `true` | The canary did not alter protected production systems. |

### Diagnostic outputs

| Diagnostic field | Verified value | Review conclusion |
| --- | --- | --- |
| `errorCode` | `null` | No Supabase/PostgREST or writer error code was reported. |
| `errorMessage` | `null` | No writer error message was reported. |
| `lastFailureAt` | `null` | No writer failure timestamp was reported. |
| `safeForFixAnalysis` | `true` | Diagnostics were safe to use for follow-up analysis. |

### Protected-system status

The production canary evidence reports `protectedSystemsUnchanged: true`. This is consistent with the repository architecture: historical capture is implemented as a fail-open sidecar and is not an authority source for Shared Reports, Route Watch, awareness, hazard lifecycle, alerts, Supabase live sync, or DriveTexas.

## 3. Dormant-State Analysis

Observed final shutdown state:

```text
captureEnabled: false
writerEnabled: false
active: true
```

### Classification

This state is classified as an **audit-state mismatch / shutdown bookkeeping artifact**, not evidence of active capture or active writes.

### Rationale

- `captureEnabled: false` means the historical capture gate is closed.
- `writerEnabled: false` means the writer gate is closed.
- With both gates false, the system is write-blocked even if a status surface still reports `active: true`.
- The repository's intended full-stop path disables the writer first, then disables all canary flags, and then sets the canary runtime `active` field to false.
- Therefore, a final status that combines disabled gates with `active: true` most likely represents either:
  - a status snapshot collected after flags were disabled but before the runtime active field was refreshed;
  - a stale browser/runtime status object;
  - an operator/viewer reading mismatch between flag state and canary runtime state;
  - or a shutdown bookkeeping defect in the audit status surface.

### Expected behavior

The recommended dormant status is:

```text
captureEnabled: false
writerEnabled: false
active: false
```

### Risk assessment

The observed state is not itself a write-risk while both gates are false. However, it is an audit clarity risk because `active: true` can be misread as an active canary after shutdown.

### Required action in V428

No production behavior changes are approved in this milestone. Treat this as documentation-only classification and require the next authorized review to reconcile the runtime status display if the mismatch is reproducible.

## 4. Protected-System Review

| Protected system | Post-canary review | Conclusion |
| --- | --- | --- |
| Shared Reports | Historical capture observed the approved event after the production action; it did not become report authority or alter report submission/clear semantics. | Unaffected. |
| Route Watch | Historical capture did not add Route Watch reads, writes, UI, routing logic, or alert dependencies. | Unaffected. |
| Awareness Filtering | Historical capture did not feed awareness filtering or change awareness text/state. | Unaffected. |
| Hazard Lifecycle | Historical capture did not become lifecycle authority and did not alter active incident transition logic. | Unaffected. |
| Alert Generation | Historical capture did not create user-facing alerts or change alert trigger logic. | Unaffected. |
| Supabase Sync | V425 added the isolated `history_capture` write path; live Supabase sync behavior and live tables were not made dependent on historical storage. | Unaffected. |

DriveTexas remains designed, validated, governed, and paused. The post-canary review does not restart or depend on DriveTexas.

## 5. Historical Program Status Matrix

| Area | Current state | Readiness level | Notes |
| --- | --- | --- | --- |
| Storage | Dedicated `history_capture` schema exposed and V425 migration reported applied. | Canary-proven write storage. | One production row path succeeded; broader collection is not approved. |
| Writer | Schema-scoped writer produced `eventsWritten: 1` with `writerErrors: 0`. | Canary-proven for Phase 1A one-event write. | Remains gated and should stay dormant outside approved windows. |
| Permissions | INSERT path reported verified. | Canary-proven for approved writer role/path. | Continue preserving no-read/no-update/no-delete boundaries unless separately reviewed. |
| RLS | RLS reported preserved. | Ready for dormant post-canary state. | Future milestones should re-check policy text before broader evidence collection. |
| Canary controls | Manual bounded canary controls successfully supported a one-event canary. | Operationally proven with audit caveat. | Final `active: true` mismatch should be tracked as audit-state cleanup. |
| Rollback controls | Rollback migration exists and writer-first shutdown pattern is documented. | Ready. | No rollback recommended because the canary succeeded and protected systems stayed unchanged. |
| Evidence collection | First production write evidence captured. | Limited readiness. | Ready for dormant archive preservation; not ready for ongoing collection without separate approval. |

Overall readiness level: **Post-canary dormant ready / limited Phase 1A write path proven**.

This is not approval for historical reads, historical UI, monitoring surfaces, retention surfaces, analytics consumption, historical intelligence, expanded categories, or continuous capture.

## 6. Recommended Dormant Configuration

Recommended dormant state after V428:

```text
captureEnabled: false
writerEnabled: false
active: false
historicalReadsEnabled: false
historyUiEnabled: false
monitoringAccessEnabled: false
retentionAccessEnabled: false
analyticsConsumptionEnabled: false
```

Operational recommendations:

1. Keep capture and writer gates disabled by default.
2. Do not perform additional production canaries under V428.
3. Preserve the one canary row as beta historical evidence unless a future beta reset policy directs otherwise.
4. Preserve V425 rollback artifacts, but do not execute rollback based on the successful canary evidence.
5. Treat `active: true` with disabled gates as a status/audit mismatch to reconcile in a future documentation or status-surface cleanup milestone, not as a reason to mutate production behavior now.
6. Require any future move from one-event canary to broader evidence collection to receive a separate explicit approval.

## 7. Open Risks

| Risk | Severity | Status | Recommended handling |
| --- | --- | --- | --- |
| Dormant status mismatch: `captureEnabled: false`, `writerEnabled: false`, `active: true` | Low operational, medium audit clarity | Open | Documented as audit-state mismatch/bookkeeping artifact. Re-check in a future non-production status review before broader collection. |
| Single-event evidence only | Low | Expected | One successful write proves the path but does not prove long-running reliability. Future evidence collection requires separate approval. |
| Historical data lifecycle policy for the canary row | Low | Open | Treat as beta historical evidence and include it in any future reset/retention plan. |
| Operator evidence is external to this repository | Medium audit provenance | Accepted for V428 | Preserve exact reported metrics and require future milestones to attach raw runtime exports where possible. |

No protected-system risk requiring rollback was identified from the verified canary evidence.

## 8. Merge Recommendation

Merge V428 as an audit-only post-canary assessment.

Rationale:

- The first production historical write succeeded: `eventsObserved: 1`, `eventsWritten: 1`, `writerErrors: 0`.
- Protected systems remained unchanged.
- The historical capture stack can safely return to a dormant state with capture and writer gates disabled.
- The only post-canary caveat is an audit/status mismatch around `active: true` after shutdown, which should be tracked but does not justify production mutation during this audit-only milestone.
- No new functionality, production writes, historical reads, history UI, monitoring access, retention access, analytics consumption, capture category expansion, or DriveTexas work is included.
