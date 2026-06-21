# GRIDLY County Boundary Onboarding Requirements Update V637F

## Scope and protected boundaries

V637F is a documentation-only milestone. It updates county onboarding requirements only and makes no runtime behavior changes, UI changes, county activation changes, overlay behavior changes, awareness filtering changes, county switching changes, asset changes, geometry-source changes, map-rendering changes, registry changes, Supabase changes, DriveTexas changes, Transportation Intelligence changes, or historical-system changes.

Mission posture remains:

```text
Know Before You Go

Awareness Platform First
Route Intelligence Second
```

---

## 1. Quick Summary

V637F permanently incorporates the boundary lessons from V637B through V637E.3 into the V636 county onboarding methodology.

The validated production county-boundary standard is:

- normal runtime displays exactly one active county boundary;
- inactive county boundaries are suppressed in the normal user-facing map;
- active display prefers county-owned boundary geometry;
- statewide geometry may support lookup, matching, fallback, or administration, but must not automatically become production active-boundary display geometry without visual-quality validation;
- boundaries are geographic context, not primary content;
- every awareness area must carry explicit `countyId` ownership;
- county switching must synchronize awareness context, active county context, boundary overlays, and county identity rendering;
- county overlays must remain pointer-event safe, marker safe, popup safe, route safe, and control safe.

---

## 2. Exact Files Updated

- `GRIDLY-COUNTY-ONBOARDING-IMPLEMENTATION-BLUEPRINT-V636.md` — updated the official county onboarding blueprint with County Boundary Validation requirements, active-only rendering expectations, county-owned active geometry preference, explicit county ownership requirements, county-switch synchronization requirements, overlay safety requirements, and County #3 activation constraints.
- `GRIDLY-COUNTY-BOUNDARY-ONBOARDING-REQUIREMENTS-UPDATE-V637F.md` — added this documentation-only milestone summary and decision record.

---

## 3. Updated Onboarding Requirements

Future county onboarding now includes a mandatory **County Boundary Validation** gate.

### County Boundary Validation checklist

```text
□ County boundary source identified
□ County-owned geometry available
□ Active county renders correctly
□ Inactive counties suppressed
□ Boundary visually subordinate
□ County switching updates boundary
□ Audit passes
□ Overlay safety verified
```

### Active county only

Normal runtime should display exactly one county boundary:

- Dayton context shows Liberty and hides Montgomery;
- Willis context shows Montgomery and hides Liberty;
- Future County #3 context shows County #3 and hides all other counties.

Inactive county boundaries should not appear in the normal user-facing map because they create active-county ambiguity and can imply that additional counties are active when they are not.

### County-specific active geometry

Active county display should prefer county-owned boundary geometry. Statewide Texas boundary assets may remain useful for lookup, matching, fallback, or future administration, but they are not automatically approved as production active-boundary display sources unless visual quality and active-only behavior are validated.

### Visual hierarchy

County boundaries are geographic context. They are not primary content.

The required visual priority order is:

```text
Awareness
↓
Alerts
↓
Crossings
↓
Hazards
↓
County context
```

Boundary styling should remain visually subordinate. Future onboarding must avoid heavy strokes, dominant outlines, and attention-grabbing county rendering.

### Explicit county ownership

Every awareness area should carry explicit county ownership through `countyId`. Future counties must avoid implicit assumptions based on town naming, historical defaults, fallback behavior, or legacy county assumptions.

### County switch synchronization

County changes must synchronize all of the following:

- awareness context;
- active county context;
- active county boundary overlay;
- county identity rendering.

Boundary overlays should rebuild whenever county ownership changes.

### Overlay safety

County overlays must remain safe for:

- pointer events;
- markers;
- popups;
- routes;
- controls;
- reporting;
- map interaction;
- hazard selection;
- crossing selection;
- route workflows.

Boundaries must never interfere with awareness workflows or reporting workflows.

---

## 4. County #3 Impact Assessment

County #3 must not be activated until all boundary onboarding requirements are complete.

Blocking prerequisites are:

- county boundary source identified;
- county-owned active geometry plan documented;
- active geometry validated;
- active-only rendering confirmed;
- inactive county suppression confirmed;
- county switching updates the boundary overlay;
- subordinate visual hierarchy verified;
- overlay safety verified;
- County Boundary Validation checklist completed;
- audit evidence recorded.

County #3 may still proceed through preflight planning only when package assets, expected source paths, activation stage, audit coverage, containment risks, boundary source, county-owned active geometry plan, active-only rendering expectation, and known limitations are documented. Preflight planning does not authorize activation.

---

## 5. Merge Recommendation

**Recommendation: MERGE V637F.**

V637F is documentation-only and updates the permanent county onboarding methodology. It does not change runtime behavior, UI behavior, county activation, overlays, awareness filtering, county switching, assets, geometry sources, or map rendering.

Expected outcome: future counties inherit the V637B–V637E.3 production county-boundary standard and do not repeat the Montgomery onboarding and boundary-refinement mistakes.
