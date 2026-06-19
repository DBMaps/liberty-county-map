# GRIDLY Montgomery Activation Gap Analysis V589

## Objective

Identify exact remaining implementation and activation work between the current staged Montgomery implementation and an operational Montgomery County. This is a gap analysis only; it is not a readiness review, launch review, activation review, governance review, decision package, framework, assessment, or planning package.

## Current Runtime State

| Runtime control | Current state | Operational requirement |
| --- | --- | --- |
| `operational` | `false` | `true` |
| `productionEnabled` | `false` | `true` |
| `selectable` | `false` | `true` |
| `GRIDLY_MONTGOMERY_RUNTIME_GATE` | `false` | `true` for activation deployment |

## Protected Boundaries That Must Remain Unchanged

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## 1. What exact code changes remain before Montgomery can be operational?

### code-runtime-flags
- **Description:** Update `js/app.js` Montgomery runtime constants/entry so `GRIDLY_MONTGOMERY_RUNTIME_GATE` is true, Montgomery `stage` is operational, `operational`, `productionEnabled`, and `selectable` are true, and `productionActivationBlocked` is false.
- **Why required:** These values are the active runtime blockers that force Montgomery requests back to Liberty and prevent self-contained Montgomery rows from being allowed.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### code-activation-tests
- **Description:** Add or update activation-mode runtime tests so Montgomery can normalize to `montgomery-tx`, be selected through the active-county override, pass Montgomery self-containment, and remain isolated from Liberty and unknown counties.
- **Why required:** Existing V584-V587 tests intentionally assert the disabled staged state; activation needs positive coverage for the operational state without weakening Liberty containment.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## 2. What exact configuration changes remain before Montgomery can be operational?

### config-active-county
- **Description:** Set the deployment/runtime active-county configuration to allow Montgomery selection, including any `window.GRIDLY_ACTIVE_COUNTY_ID` or deployment equivalent used for the target environment.
- **Why required:** The runtime helper only activates non-default counties when the requested county normalizes as operational; deployment configuration must request/permit Montgomery where the operational experience is expected.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### config-protected-boundaries
- **Description:** Keep protected boundary configuration unchanged: historical reads/UI/API/dashboard false, DriveTexas paused, and Transportation Intelligence disabled/display-disabled/activation-disabled.
- **Why required:** The user-provided protected boundaries remain out of scope for Montgomery activation and must not be toggled as part of county activation.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## 3. What exact registry changes remain before Montgomery can be operational?

### registry-runtime-entry
- **Description:** Promote the runtime registry entry for `montgomery-tx` from disabled staged to operational while preserving its canonical identity, package references, and containment metadata.
- **Why required:** The registry is the runtime control plane; Montgomery cannot be operational while the runtime registry advertises disabled staged, non-production, non-selectable status.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### registry-artifact-refresh
- **Description:** Refresh `assets/county-implementation/montgomery/registry/montgomery-county-registry-artifact.json` so activation, production, containment, rollback, and activation-readiness fields reflect completed V578-V588 evidence and the intended operational registry state.
- **Why required:** The existing artifact still says activation is not enabled, no production registry record exists, containment/rollback validation are not performed, and runtime references were not created; those statements are stale relative to V578-V588 and incompatible with activation evidence.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### manifest-refresh
- **Description:** Refresh `assets/county-implementation/montgomery/manifests/montgomery-package-manifest.json` to remove obsolete “no runtime references/no activation references” implementation-scope statements and point to the V578-V588 validation/evidence chain.
- **Why required:** The manifest remains V577-era and does not reflect the completed containment, rollback, activation readiness, staged runtime, observation, and launch decision artifacts that activation relies on.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## 4. What exact runtime changes remain before Montgomery can be operational?

### runtime-gate-flip
- **Description:** Flip the Montgomery runtime gate for the activation deployment from false to true.
- **Why required:** `runtimeGateEnabled` is bound to `GRIDLY_MONTGOMERY_RUNTIME_GATE`; while false, activation-relevant behavior remains intentionally closed.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### runtime-selection-path
- **Description:** Enable Montgomery active-county selection in the target runtime while confirming Liberty remains the default when no Montgomery selection is requested.
- **Why required:** Operational Montgomery must be reachable without making unknown or unset county contexts accidentally resolve to Montgomery.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### runtime-assets
- **Description:** Decide and implement the production asset consumption path: either continue reading Montgomery assets from `assets/county-implementation/montgomery/` as the runtime registry currently points, or promote/copy approved Montgomery runtime assets into an explicitly documented production-consumable path.
- **Why required:** Montgomery has a valid package-scoped boundary path today, but activation needs an intentional production asset path decision so runtime behavior is supportable and rollbackable.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small-to-medium

## 5. What exact activation steps remain before Montgomery can be operational?

### activation-execute
- **Description:** Execute the activation change set as one controlled deployment: code flag changes, registry promotion, configuration update, validation run, release, and post-release smoke check.
- **Why required:** The current repository state is staged; Montgomery becomes operational only after the coordinated runtime/config/registry changes are deployed together.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### activation-owners
- **Description:** Confirm named operational owner, rollback owner, support owner, and escalation owner before deployment.
- **Why required:** V588 identified owner confirmation as an observation; activation requires accountable responders if the county must be disabled or support messaging is needed.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## 6. What exact rollback preparations remain before Montgomery can be operational?

### rollback-baseline
- **Description:** Capture the current disabled staged baseline values and prepare a revert patch/runbook that restores gate=false, stage disabled, operational=false, productionEnabled=false, selectable=false, productionActivationBlocked=true, and the prior active-county configuration.
- **Why required:** Rollback must be executable quickly if containment, selection, asset, or support behavior fails after activation.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### rollback-validation
- **Description:** Validate rollback commands or patch application in a non-production branch/environment and confirm Liberty still passes after rollback.
- **Why required:** Rollback planning exists, but the activation-specific rollback package must be executable against the actual activation diff.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## 7. What exact testing remains before Montgomery can be operational?

### testing-preflight
- **Description:** Run current disabled-state regression tests before changing the activation flags to prove the starting point is intact.
- **Why required:** Confirms no drift from V584-V587 before making the activation diff.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### testing-activation
- **Description:** Run new activation-mode tests after the activation diff to prove Montgomery normalizes, selects, reports metadata, and contains rows correctly while Liberty and unknown-county behavior remain safe.
- **Why required:** The existing tests assert Montgomery is disabled; activation requires positive operational assertions.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### testing-audits
- **Description:** Run artifact JSON parse validation, protected-boundary audit, registry/manifest consistency checks, and Liberty non-regression checks.
- **Why required:** Activation must not break artifact integrity, protected-system boundaries, or the Liberty production baseline.
- **Risk level:** high
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

### testing-smoke
- **Description:** Perform post-deployment smoke checks for Montgomery selection, boundary loading, report metadata county_id, Liberty default behavior, and rollback readiness.
- **Why required:** Runtime tests alone do not prove the deployed environment is serving the intended county state.
- **Risk level:** medium
- **Blocking/non-blocking:** blocking
- **Estimated effort:** small

## REMAINING ACTIVATION TASKS

**TECHNICALLY NOT YET ACTIVATION READY**

1. **code-runtime-flags** — Update `js/app.js` Montgomery runtime constants/entry so `GRIDLY_MONTGOMERY_RUNTIME_GATE` is true, Montgomery `stage` is operational, `operational`, `productionEnabled`, and `selectable` are true, and `productionActivationBlocked` is false.
2. **code-activation-tests** — Add or update activation-mode runtime tests so Montgomery can normalize to `montgomery-tx`, be selected through the active-county override, pass Montgomery self-containment, and remain isolated from Liberty and unknown counties.
3. **config-active-county** — Set the deployment/runtime active-county configuration to allow Montgomery selection, including any `window.GRIDLY_ACTIVE_COUNTY_ID` or deployment equivalent used for the target environment.
4. **config-protected-boundaries** — Keep protected boundary configuration unchanged: historical reads/UI/API/dashboard false, DriveTexas paused, and Transportation Intelligence disabled/display-disabled/activation-disabled.
5. **registry-runtime-entry** — Promote the runtime registry entry for `montgomery-tx` from disabled staged to operational while preserving its canonical identity, package references, and containment metadata.
6. **registry-artifact-refresh** — Refresh `assets/county-implementation/montgomery/registry/montgomery-county-registry-artifact.json` so activation, production, containment, rollback, and activation-readiness fields reflect completed V578-V588 evidence and the intended operational registry state.
7. **manifest-refresh** — Refresh `assets/county-implementation/montgomery/manifests/montgomery-package-manifest.json` to remove obsolete “no runtime references/no activation references” implementation-scope statements and point to the V578-V588 validation/evidence chain.
8. **runtime-gate-flip** — Flip the Montgomery runtime gate for the activation deployment from false to true.
9. **runtime-selection-path** — Enable Montgomery active-county selection in the target runtime while confirming Liberty remains the default when no Montgomery selection is requested.
10. **runtime-assets** — Decide and implement the production asset consumption path: either continue reading Montgomery assets from `assets/county-implementation/montgomery/` as the runtime registry currently points, or promote/copy approved Montgomery runtime assets into an explicitly documented production-consumable path.
11. **activation-execute** — Execute the activation change set as one controlled deployment: code flag changes, registry promotion, configuration update, validation run, release, and post-release smoke check.
12. **activation-owners** — Confirm named operational owner, rollback owner, support owner, and escalation owner before deployment.
13. **rollback-baseline** — Capture the current disabled staged baseline values and prepare a revert patch/runbook that restores gate=false, stage disabled, operational=false, productionEnabled=false, selectable=false, productionActivationBlocked=true, and the prior active-county configuration.
14. **rollback-validation** — Validate rollback commands or patch application in a non-production branch/environment and confirm Liberty still passes after rollback.
15. **testing-preflight** — Run current disabled-state regression tests before changing the activation flags to prove the starting point is intact.
16. **testing-activation** — Run new activation-mode tests after the activation diff to prove Montgomery normalizes, selects, reports metadata, and contains rows correctly while Liberty and unknown-county behavior remain safe.
17. **testing-audits** — Run artifact JSON parse validation, protected-boundary audit, registry/manifest consistency checks, and Liberty non-regression checks.
18. **testing-smoke** — Perform post-deployment smoke checks for Montgomery selection, boundary loading, report metadata county_id, Liberty default behavior, and rollback readiness.
