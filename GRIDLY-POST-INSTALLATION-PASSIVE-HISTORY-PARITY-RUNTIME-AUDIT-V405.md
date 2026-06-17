# GRIDLY V405 — Post-Installation Passive History Parity & Runtime Audit

## Audit scope

V405 is documentation-only validation for the V404 Phase 1A passive history hooks. It does not approve or implement historical writes, historical reads, history UI, schema work, lifecycle adapters, incident transition capture, `report_updated` capture, production activation, or DriveTexas restart.

Core rule for this audit: **Capture Everything. Show Nothing. Depend On Nothing.**

## Current installation status

| Area | V405 finding |
| --- | --- |
| Hooks installed | Yes, passive Phase 1A hook calls are present for the four approved event/hook pairs. |
| Historical writes | No, the writer remains disabled/no-op. |
| Historical reads | No, no historical read/select consumer is exposed by the sidecar. |
| History UI | No, the sidecar exposes no UI surface. |
| Production activation | No, capture defaults disabled and hook calls fail open. |

## 1. Hook installation validation

The Phase 1A sidecar declares the approved installed hook inventory as:

- `crossing.report_created`
- `crossing.report_cleared`
- `road_hazard.report_created`
- `road_hazard.report_cleared`

Runtime hook call placement review:

| Hook | Installation evidence | Parity finding |
| --- | --- | --- |
| `crossing.report_created` | Crossing submission calls `gridlyTryPassiveHistoryCapturePhase1A` after the existing Supabase insert succeeds and after local crossing normalization/history capture. The hook value resolves to `crossing.report_created` when the submitted report type is not `cleared`. | Installed as passive post-success sidecar call; does not gate the existing report success lifecycle. |
| `crossing.report_cleared` | The same crossing submission path resolves the hook value to `crossing.report_cleared` when the submitted report type is `cleared`. | Installed as passive post-success sidecar call; does not gate the existing clear success lifecycle. |
| `road_hazard.report_created` | Road-hazard creation calls `gridlyTryPassiveHistoryCapturePhase1A` after the existing insert succeeds and after local hazard normalization/history capture. | Installed as passive post-success sidecar call; does not gate active hazard insertion, marker refresh, unified incident rendering, or auto-render scheduling. |
| `road_hazard.report_cleared` | Road-hazard clear calls `gridlyTryPassiveHistoryCapturePhase1A` after the existing insert succeeds and after local clear normalization/history capture. | Installed as passive post-success sidecar call; does not gate clear acknowledgement, sync text, or post-submit refresh. |

## 2. Sidecar audit status

Expected browser-console command:

```js
window.gridlyPassiveHistoryCaptureSidecarAudit?.()
```

Expected V405 result shape:

```json
{
  "sidecarAvailable": true,
  "gatesDefaultDisabled": true,
  "writesDisabled": true,
  "hooksInstalled": true,
  "installedHooks": [
    "crossing.report_created",
    "crossing.report_cleared",
    "road_hazard.report_created",
    "road_hazard.report_cleared"
  ],
  "noHistoricalReadsExposed": true,
  "noUiExposed": true,
  "supportedEventTypesPhase1AOnly": true,
  "supportedEventTypes": ["report_created", "report_cleared"],
  "runtimeIntegrated": true
}
```

Code review finding: the sidecar audit helper returns the required object shape and has a fail-open fallback that preserves the same passive, disabled, no-read, no-UI audit posture if audit collection itself throws.

## 3. Production parity validation

V405 reviewed the Phase 1A placement against existing production flows and finds no intended behavior change to:

- Report submission success/failure handling.
- Crossing `report_created` flow.
- Crossing `report_cleared` flow.
- Road-hazard `report_created` flow.
- Road-hazard `report_cleared` flow.
- Alerts.
- Awareness.
- Markers.
- Active hazards.
- Unified incidents.
- Route Watch.
- DriveTexas.

Parity rationale:

1. Phase 1A hook calls occur after existing successful report insert/local normalization points.
2. The wrapper `gridlyTryPassiveHistoryCapturePhase1A` returns immediately when the sidecar is missing.
3. The wrapper catches and suppresses sidecar errors so reporting flow continues.
4. Capture remains disabled by default, so installed hooks resolve to disabled/no-op behavior.
5. The writer remains a disabled/no-op function and does not write to Supabase.
6. No historical reads, UI, SQL, or migrations are part of V405.

## 4. Disabled-default behavior

| Requirement | V405 validation |
| --- | --- |
| Capture remains disabled by default | The default flags expose `captureEnabled: false`. |
| Writer remains disabled/no-op | The writer reports `writesEnabled: false`, `lastWriteAttempted: false`, `lastWriteResult: "noop"`, and write calls return a no-op disabled result. |
| No Supabase writes occur | The history-capture sidecar does not call Supabase write APIs; the writer is disabled and no-op. |
| Malformed payloads safe-fail | Sidecar capture normalizes non-object inputs to `{}`, rejects unsupported/missing event types as no-op, and catches envelope/writer failures. |
| Missing sidecar safe-fails | Production wrapper returns if `window.gridlyPassiveHistoryCapturePhase1A` or `capturePhase1AEvent` is unavailable. |
| Hook errors do not block report flow | Production wrapper catches sidecar errors and intentionally ignores them because passive history capture must be fail-open. |

## 5. Runtime audit plan

Run these checks in the browser console on the V405 build. Helper unavailability should be documented as **unavailable**, not failure, unless the helper is required for V405.

| Console command | Required for V405? | Expected result |
| --- | --- | --- |
| `window.gridlyPassiveHistoryCaptureSidecarAudit?.()` | Yes | Available and returns the expected V405 sidecar audit object with disabled gates, disabled writes, all four installed hooks, no reads, no UI, Phase 1A event types only, and `runtimeIntegrated: true`. |
| `window.gridlyUiSmokeTest?.()` | No | If available, should show unchanged UI smoke status. If unavailable, document as unavailable. |
| `window.gridlyActiveHazardCountReconciliationAudit?.()` | No | If available, active hazard counts should match the current production baseline. If unavailable, document as unavailable. |
| `window.gridlyCrossingPipelineAudit?.()` | No | If available, crossing pipeline should show unchanged report lifecycle behavior. If unavailable, document as unavailable. |
| `window.gridlyAlertCardConsumerAudit?.()` | No | If available, alert card consumers should remain unchanged. If unavailable, document as unavailable. |
| `window.gridlyAwarenessExperienceAudit?.()` | No | If available, awareness experience should remain unchanged. If unavailable, document as unavailable. |
| `window.gridlyRouteWatchDisplayAudit?.()` | No | If available, Route Watch display should remain unchanged. If unavailable, document as unavailable. |

## 6. Required comparison checks

Perform before/after or current-state validation on the deployed/runtime build and record observations:

| Check | Expected V405 result |
| --- | --- |
| Active hazard counts | Count remains unchanged by passive history hook installation. |
| Visible markers | Marker set and marker placement remain unchanged. |
| Alert rows | Alert rows remain unchanged. |
| Awareness text | Awareness copy remains unchanged. |
| Report success confirmation | Success confirmation still appears after successful report submission. |
| Clear success confirmation | Clear confirmation still appears after successful clear flow. |
| Route Watch display | Route Watch display remains unchanged. |
| DriveTexas | DriveTexas integration remains untouched and is not restarted by V405. |

## 7. Explicit non-approvals

V405 does **not** authorize:

- Historical writes.
- Historical reads.
- History UI.
- Supabase schema deployment.
- SQL/migrations.
- Lifecycle adapter.
- Incident transition capture.
- `report_updated` capture.
- Production activation.
- DriveTexas restart.

## V405 test and proof commands

Required local checks for this documentation-only audit:

```sh
node --check js/app.js
for f in js/history-capture/*.js; do node --check "$f"; done
for f in tests/history-capture/*.test.js; do node "$f"; done
git diff --check
rg -n "supabase|insert\(|upsert\(|update\(|delete\(|from\(" js/history-capture
rg -n "select\(|historical.*read|history.*read|from\(" js/history-capture
rg -n "GRIDLY-POST-INSTALLATION-PASSIVE-HISTORY-PARITY-RUNTIME-AUDIT-V405|history-capture|passive history" --glob "*.sql" --glob "*migration*" .
git diff --name-only -- 'index.html' 'css/**' 'assets/**' 'js/**' ':!js/history-capture/**' ':!js/app.js'
```

Expected proof interpretation:

- Syntax checks pass.
- Existing history-capture tests pass.
- `git diff --check` passes.
- Supabase write proof finds no added Supabase write path in `js/history-capture`.
- Historical read proof finds no historical reads/selects in `js/history-capture`.
- SQL/migration proof finds no changed SQL or migration files.
- UI/DOM proof finds no V405 changes to UI/DOM files.

## Runtime audit findings

Runtime execution is not performed by this documentation artifact. The required browser-console plan above should be executed on the target runtime. Based on static review, the required V405 sidecar audit helper is present and expected to report passive, disabled-default, no-write, no-read, no-UI runtime integration.

## Parity findings

V405 finds the V404 Phase 1A hook installation to be passive and production-parity preserving:

- Hooks are installed for the four approved Phase 1A hook names.
- Capture is disabled by default.
- Writer is disabled/no-op.
- Sidecar errors fail open.
- Missing sidecar fails open.
- No historical reads are exposed.
- No history UI is exposed.
- No SQL/migration/schema deployment is part of this audit.
- DriveTexas is untouched.

## Recommended next milestone

Recommended next milestone: a separate authorization milestone for controlled runtime evidence collection of the V405 browser-console audit plan. That milestone should still keep historical writes, historical reads, and history UI disabled unless separately approved.
