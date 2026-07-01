# GRIDLY County Activation Gate V626

## 1. Executive summary

V626 converts county activation from a one-off implementation exercise into a platform governance capability. The gate defined here is documentation, architecture, audit, and readiness only. It does not activate any county, does not change runtime behavior, does not change county ownership logic, does not change report ownership, does not change search containment, does not change crossings, and does not change road naming.

V625 concluded that Gridly is **PARTIALLY COUNTY-SCALABLE** because county activation still requires manual runtime edits and because Montgomery exposed repeated activation hazards: missing roads, missing crossings, road naming degradation, historical leakage, runtime ownership leakage, and destination search containment failures. V626 defines the readiness gate future counties must pass before they can become both `operational: true` and `selectable: true`.

## 2. County activation philosophy

County activation must distinguish visibility, package presence, runtime ownership, and operational safety. A county can be known to Gridly without being safe for users as a fully operational county.

### County states

| State | Definition | Selector visibility | Operational capability |
|---|---|---:|---:|
| Candidate County | A county under evaluation with some planning, metadata, or partial package work, but without enough validated runtime evidence for user selection. | No, unless explicitly approved as preview-only in a future policy. | No. |
| Asset-Only County | A county with acquired or staged assets, such as roads or crossings, but without complete registry, bounds, awareness, reporting, containment, and audit evidence. | No. | No. |
| Validated County | A county that passes the V626 activation gate in audit evidence but has not yet been promoted by governance to user-facing runtime flags. | May remain hidden until release approval. | Technically ready, pending promotion decision. |
| Selectable County | A county that is visible in the county selector because minimum selector safety requirements have passed. | Yes. | Not necessarily fully operational unless it also passes the operational gate. |
| Operational County | A county that passes every activation gate category required for full runtime use, including registry, bounds, awareness, reporting, roads, crossings, containment, and audits. | Yes. | Yes. |

### Visibility is not operational readiness

Being visible in the selector is not proof that a county is fully operational. A selectable county only proves that the selector can safely present the option without creating ownership, containment, or stale-copy leakage. Fully operational status requires complete runtime readiness and audit coverage.

Montgomery should therefore be evaluated against this gate rather than assumed operational merely because runtime work has occurred. Under V626, Montgomery remains a gated county until road naming observations, crossing blockers, and historical containment observations are resolved or formally accepted by governance.

## 3. Activation gate categories

### A. Registry Readiness

Required evidence:

- Registry entry exists for the county id.
- County metadata is complete: id, display name, state, default city or area label, status fields, and governance notes.
- Package metadata is complete: manifest, expected asset paths, source availability declarations, provenance notes, and known blockers.
- Operational and selectable flags are not used as substitutes for package evidence.

Readiness failure examples:

- Registry entry exists but required assets are marked missing.
- County status says operational while road or crossing packages are unavailable.
- Package paths are implicit, stale, or inherited from another county.

### B. Bounds Readiness

Required evidence:

- County bounds exist and are assigned to the county id.
- Coordinate ownership resolves coordinates inside the county to that county id.
- Coordinate ownership rejects out-of-county coordinates without silent fallback to Liberty or any other county.
- Map fit uses county bounds for startup and county selection.
- Search containment uses county/search-context bounds and does not leak into other counties.

### C. Awareness Area Readiness

Required evidence:

- County-wide awareness area exists.
- Town or local awareness areas exist where supported by the county package.
- Home area support exists and is county-scoped.
- Awareness labels and anchors are county-owned.
- Passive county options do not affect active awareness context.

### D. Reporting Readiness

Required evidence:

- Coordinate ownership works at report submission points.
- Report ownership metadata is written from coordinate ownership, not from passive selector state.
- Visibility pipeline filters reports to the active/visible county.
- County filtering works for live reports, alert inputs, and awareness counts.
- Unsupported or unknown coordinates fail closed rather than becoming Liberty-owned.

### E. Road Readiness

Required evidence:

- Road assets exist for the county.
- Road assets are normalized, parseable, and in county bounds.
- Road resolver works for report-coordinate county roads.
- Road naming quality passes without generic local-road degradation, stale Liberty text, or degraded fallback labels.
- Missing roads block operational activation.

### F. Crossing Readiness

Required evidence:

- Crossing assets exist for the county.
- Crossing loading uses county-owned sources.
- Crossing rendering works in the active county.
- Crossing interaction works, including click/report workflows where applicable.
- Missing crossings block operational activation.

### G. Awareness Product Readiness

Required evidence:

- Alerts use active-county-filtered inputs.
- Community Pulse uses active county and active town context.
- Awareness Brief uses active county and active town context.
- Counts reflect visible county data only.
- Containment prevents passive county options, stale reports, and other-county records from shaping active awareness output.

### H. Historical Containment

Required evidence:

- Historical reads remain disabled unless explicitly authorized by a later milestone.
- Historical UI remains disabled unless explicitly authorized by a later milestone.
- No stale county leakage appears from historical/demo surfaces.
- No demo leakage appears in active county output.
- Historical/demo records are suppressed, county-tagged, or otherwise contained.

### I. Runtime Containment

Required evidence:

- County ownership passes for all active runtime surfaces.
- No Liberty fallback is used to mask missing county dependencies.
- No stale county text appears in active county UI, labels, reports, alerts, search, or awareness output.
- Passive county options are not misclassified as active leakage.
- Runtime paths fail closed when county dependencies are missing.

### J. Audit Coverage

Required evidence:

- Required audits exist for registry, bounds, awareness, reporting, roads, crossings, containment, and county text leakage.
- Required audits pass for the candidate county.
- Regression audits pass for existing operational counties.
- Audit output names blockers, observations, and safe-for-activation status.

## 4. Activation scoring model

| Score | Criteria | Activation meaning |
|---|---|---|
| PASS | All required evidence exists; audits pass; no blocker; no unresolved containment, ownership, road, crossing, or registry failure. | Eligible for operational activation if governance approves. |
| PASS WITH OBSERVATIONS | Core safety evidence passes, but non-blocking quality or cleanup observations remain. Observations must not include missing roads, missing crossings, ownership failures, search containment failures, or unresolved report ownership failures. | Eligible only if governance explicitly accepts the observations; otherwise remains validated-but-held. |
| NOT READY | One or more required categories lack evidence or have non-critical failures that prevent confident activation, but the path to completion is known. | Not eligible for operational activation. May remain candidate or asset-only. |
| BLOCKED | A hard blocker exists: missing roads, missing crossings, containment failure, unresolved ownership failure, unsafe fallback, missing bounds, or missing registry/package metadata required for safe operation. | Not eligible for selectable or operational activation until blocker is resolved. |

Minimum selector safety requires registry readiness, bounds readiness, basic awareness readiness, runtime containment, and audit evidence that selector visibility does not imply unsupported operation. Minimum operational safety requires PASS or governance-accepted PASS WITH OBSERVATIONS across every category, with no blocker.

## 5. Montgomery V626 evaluation

Known current state under V626:

| Category | Score | Rationale |
|---|---|---|
| Ownership | PASS | Coordinate and runtime ownership work from the current known state. |
| Search | PASS | Destination search containment is currently treated as passing. |
| Reporting | PASS | Report ownership and visibility are currently treated as passing. |
| Road naming | PASS WITH OBSERVATIONS | Road naming has improved but still carries quality observations and must remain under gate review. |
| Crossings | BLOCKED | Crossing readiness is blocked because required Montgomery crossing runtime wiring/assets are not complete. |
| Historical containment | PASS WITH OBSERVATIONS | Historical reads/UI remain protected, but historical/demo containment remains an observation area. |

**Montgomery readiness classification: BLOCKED.** Montgomery has several passing core runtime categories, but crossing readiness is a hard blocker under V626. Road naming and historical containment remain observations. Montgomery must not be used as proof that a county is operational until it passes the crossing gate and either resolves or formally accepts observations.

## 6. County readiness matrix

| County | V626 classification | Rationale |
|---|---|---|
| Liberty | Operational | Baseline operational county with mature roads/crossings and existing runtime support, while still requiring regression audit coverage under the new gate. |
| Montgomery | Blocked | Ownership, search, and reporting pass; road naming and historical containment have observations; crossings are blocked. |
| Chambers | Candidate | Readiness documents exist, but no V626 evidence supports selector or operational activation. |
| Jefferson | Candidate | Readiness/fast-track planning exists, but no V626 evidence supports selector or operational activation. |
| Polk | Candidate | Readiness/fast-track planning exists, but no V626 evidence supports selector or operational activation. |
| San Jacinto | Candidate | Readiness/fast-track planning exists, but no V626 evidence supports selector or operational activation. |
| Harris | Asset-Only | Treated as asset-only because assets may exist in implementation folders but are not wired or validated by the V626 gate. |

## 7. Activation governance rules

- No county becomes operational unless the activation gate passes.
- No county becomes selectable unless minimum selector requirements pass.
- No missing roads are allowed for operational activation.
- No missing crossings are allowed for operational activation.
- No containment failures are allowed for selectable or operational activation.
- No unresolved ownership failures are allowed for selectable or operational activation.
- No Liberty fallback may be used to hide missing county dependencies.
- No stale county text may be accepted as harmless if it appears in active county user-facing output.
- No registry status may override audit evidence.
- No county activation may depend on Supabase, historical reads, DriveTexas, or Transportation Intelligence changes unless a future milestone explicitly authorizes those systems.

## 8. Required future audit helper

A future milestone should define and implement a helper named:

```js
window.gridlyCountyActivationReadinessAudit?.()
```

V626 documents the desired shape only and does not implement this helper.

Expected output shape:

```js
{
  countyId,
  registryReady,
  boundsReady,
  awarenessReady,
  reportingReady,
  roadsReady,
  crossingsReady,
  containmentReady,
  auditCoverageReady,
  readinessScore,
  readinessClassification,
  safeForActivation
}
```

The helper should eventually produce county-specific PASS, PASS WITH OBSERVATIONS, NOT READY, or BLOCKED findings and should distinguish selector safety from operational safety.

## 9. Recommended next milestone

Recommended next milestone: **C. Montgomery Crossing Runtime Wiring**.

Reasoning:

1. V626 makes missing crossings a hard blocker for operational activation.
2. Montgomery already has ownership, search, and reporting passing from the current known state.
3. Road naming and historical containment are observations, but crossings are the only listed BLOCKED category.
4. Resolving crossing runtime wiring would move Montgomery from blocked toward a validated county and would prove the new gate on a concrete county.

Secondary sequence after crossing work:

1. Montgomery Road Naming Root Cause Analysis.
2. Historical Panel Containment.
3. County Activation Audit Helper.

## 10. Merge recommendation

Merge V626 as documentation-only governance. It introduces no runtime behavior change, no registry modification, no Supabase change, no county activation, no historical flag change, no DriveTexas change, no Transportation Intelligence change, no framework introduction, and no UI redesign.
