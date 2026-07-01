# GRIDLY County Activation Checklist V626

## Purpose

This checklist is the operational companion to the V626 activation gate. It must be completed before a future county is promoted to `operational: true` and `selectable: true`. It is documentation-only and does not activate any county.

## Required checklist

### 1. Registry

- [ ] County registry entry exists.
- [ ] County id is stable and unique.
- [ ] County display name, state, default city or default area, and status fields are complete.
- [ ] Package manifest exists.
- [ ] Package paths for bounds, awareness, roads, crossings, and supporting metadata are declared.
- [ ] Source availability accurately describes present and missing assets.
- [ ] Known blockers are documented.
- [ ] Operational/selectable flags are not set until gate evidence passes.

### 2. Bounds

- [ ] County bounds exist.
- [ ] Bounds are parseable and geographically plausible.
- [ ] Coordinate ownership resolves in-county coordinates to the county id.
- [ ] Coordinate ownership rejects out-of-county coordinates without unsafe fallback.
- [ ] Map fit works for startup and county selection.
- [ ] Destination/search containment uses county bounds.
- [ ] Bounds audit passes.

### 3. Awareness

- [ ] County-wide awareness area exists.
- [ ] Town/local awareness areas exist where applicable.
- [ ] Home area options are county-scoped.
- [ ] Awareness anchors and labels are county-owned.
- [ ] Alerts use active-county-filtered inputs.
- [ ] Community Pulse uses active county and active town context.
- [ ] Awareness Brief uses active county and active town context.
- [ ] Counts are contained to active visible county data.
- [ ] Passive county options are not treated as active runtime leakage.

### 4. Reporting

- [ ] Report submission resolves coordinate ownership.
- [ ] Report metadata writes the coordinate-owned county id.
- [ ] Report ownership does not depend on passive selector state.
- [ ] Visibility pipeline filters reports to the active/visible county.
- [ ] County filtering works for report list, markers, alerts, awareness counts, and downstream consumers.
- [ ] Unsupported coordinates fail closed.
- [ ] Reporting audit passes.

### 5. Roads

- [ ] County road assets exist.
- [ ] Road assets are normalized.
- [ ] Road assets are parseable.
- [ ] Road geometries are inside or plausibly associated with county bounds.
- [ ] Road resolver uses report-coordinate county context.
- [ ] Road names are specific and user-safe.
- [ ] Road labels do not degrade to generic local-road phrasing.
- [ ] Road labels do not leak Liberty, stale county, or demo text.
- [ ] Road naming audit passes.

### 6. Crossings

- [ ] County crossing assets exist.
- [ ] Crossing assets are normalized.
- [ ] Crossing loading uses county-owned sources.
- [ ] Crossing rendering works for the active county.
- [ ] Crossing interactions work, including click/report flows where applicable.
- [ ] Crossing labels are county-owned.
- [ ] Crossings do not borrow Liberty or another county's inventory.
- [ ] Crossing audit passes.

### 7. Containment

- [ ] Search containment passes.
- [ ] Runtime ownership containment passes.
- [ ] No Liberty fallback masks missing county dependencies.
- [ ] No stale county text appears in active output.
- [ ] No passive-option misclassification appears in audits.
- [ ] Historical reads remain disabled unless separately authorized.
- [ ] Historical UI remains disabled unless separately authorized.
- [ ] Demo and historical records do not leak into active county output.
- [ ] Containment audit passes.

### 8. Audits

- [ ] Registry audit exists and passes.
- [ ] Bounds audit exists and passes.
- [ ] Awareness audit exists and passes.
- [ ] Reporting audit exists and passes.
- [ ] Road audit exists and passes.
- [ ] Crossing audit exists and passes.
- [ ] Search containment audit exists and passes.
- [ ] Historical/demo containment audit exists and passes or records only accepted observations.
- [ ] Regression audit passes for existing operational counties.
- [ ] Final activation readiness record is written.

## Promotion decision

A county may be promoted only when every checklist area passes or when governance explicitly accepts non-blocking observations. The following can never be waived for operational activation:

- Missing roads.
- Missing crossings.
- Missing bounds.
- Containment failures.
- Unresolved ownership failures.
- Unsafe Liberty or other-county fallback.
- Missing audit coverage for required categories.

## Selector decision

A county may become selectable only when selector safety is proven. At minimum, registry, bounds, awareness, runtime containment, and audit coverage must prove that selector visibility will not create unsupported operation, stale county text, ownership leakage, or search leakage.
