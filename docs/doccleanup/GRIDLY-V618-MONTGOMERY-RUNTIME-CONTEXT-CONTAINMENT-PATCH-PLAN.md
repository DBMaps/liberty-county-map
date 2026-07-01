# GRIDLY V618 — Montgomery Runtime Context Containment Patch Plan

## 1. Executive Summary

This V618 document is a patch plan only. It defines the implementation sequence required to correct the Montgomery runtime containment failures identified in V617 without changing runtime behavior in this milestone.

V617 determined that the Montgomery runtime regressions are containment and ownership failures across four related systems:

- county context and map-fit ownership;
- destination search county/town containment;
- crossing runtime source wiring;
- road-hazard location-language ownership and sanitation.

The implementation strategy is to restore containment from the top of the runtime context stack downward. County context must become authoritative before search, crossings, or road-hazard language can safely depend on it. Search containment should follow because it is user-visible and relies directly on active county/town bounds. Crossing runtime wiring should occur only after runtime source ownership is explicit. Road-hazard language should be finalized after context ownership and road-source boundaries are defined, with sanitizer coverage hardened throughout.

## 2. Final Determination

**RUNTIME CONTAINMENT PATCH PLAN DEFINED**

The V617 findings are mapped to implementation areas, ownership boundaries, patch dependencies, and validation requirements. No runtime activation or behavior change is authorized by this plan.

## 3. Scope Controls

This plan does not authorize implementation in V618.

V618 must not:

- patch application code;
- activate Montgomery;
- register Montgomery into runtime;
- modify runtime behavior;
- change destination search behavior;
- change crossing rendering;
- change road resolver logic;
- resume DriveTexas;
- enable Transportation Intelligence;
- enable historical reads or historical UI.

The only V618 deliverable is this planning document.

## 4. V617 Finding Summary

V617 identified four runtime issues that must be addressed in separate but ordered patches:

1. **County Context / Map Bounds**
   - Fallback/default context paths still exist.
   - County-view behavior appears incorrect when Montgomery/Conroe is active.
   - Montgomery has boundary assets, but runtime fit behavior remains sensitive to fallback anchors and crossing availability.

2. **Destination Search Containment**
   - Liberty, Cleveland, Baytown, and broader Houston-area results can appear while Montgomery/Conroe is active.
   - Active county containment is not enforced through seed selection, provider bounding, or post-provider filtering.

3. **Crossing Runtime Rendering**
   - Montgomery crossing assets exist in the broader package workstream, but runtime crossing sources are not wired for active rendering.
   - Gridly Montgomery crossing markers and popups do not appear.
   - Users see basemap rail graphics rather than Gridly crossing markers.

4. **Road Hazard Location Language**
   - Liberty-contaminated wording can still appear in Montgomery hazard language.
   - Montgomery road geometry/runtime ownership gaps remain.
   - Sanitizer coverage is not guaranteed across every hazard title, card, popup, and detail surface.

## 5. County Context Containment Plan

### Affected systems

- Active county selection and normalization.
- County ownership registry.
- County boundary source resolution.
- County/town map fit and startup zoom.
- Awareness-area selection and active geo-filter state.
- Fallback anchor/default county behavior.

### Ownership boundaries

County context must be owned by the active county runtime configuration, not by Liberty defaults, crossing availability, map center drift, or generic startup anchors.

The implementation must distinguish:

- **county ownership source:** the canonical active county id and county package registry entry;
- **county bounds source:** the approved county boundary geometry or approved county bounds metadata;
- **county fit/zoom ownership:** county/town viewport logic that is independent of crossing availability;
- **fallback behavior:** explicit, audited fallback paths that never borrow Liberty-specific names, bounds, anchors, or labels while Montgomery is active.

### Recommended patch sequence

1. Audit every caller that derives county context from defaults, selected town, awareness area, map center, county bounds, or crossing data.
2. Define one active county context object that exposes county id, display label, boundary path/status, fallback anchor, default zoom, selected town, and selected-town bounds/anchor.
3. Ensure Montgomery county-view fit uses Montgomery county bounds when available.
4. Ensure Conroe/town-view fit uses approved town bounds or approved town anchor/zoom, not crossing-derived bounds.
5. Restrict fallback paths so they are county-neutral or active-county-specific.
6. Add diagnostics that identify which context source performed the fit: county boundary, town bounds, town anchor, or audited fallback.

### Validation requirements

- Audit confirms no Montgomery county/town fit path depends on Liberty constants or Liberty-named fallback state.
- Runtime validation confirms Montgomery county view fits to Montgomery-owned bounds.
- Runtime validation confirms Conroe/town view uses approved Conroe/town context without requiring crossings.
- Manual validation confirms the Montgomery/Conroe view no longer opens in a broad Liberty/Houston-regional context.
- Negative validation confirms Liberty behavior remains unchanged when Liberty is active.

## 6. Destination Search Containment Plan

### Affected systems

- Destination Search context builder.
- Active county and selected town influence on search.
- Local POI seed registry.
- Search ranking and locality scoring.
- Provider viewbox/bounded query construction.
- Post-provider containment filtering.
- Search fallback behavior.

### Ownership boundaries

Search containment must be owned by active county/town context. Search results must not be considered local merely because they are in legacy Liberty seed lists, broad Texas distance thresholds, or generic local place lookups.

The implementation must distinguish:

- **active county influence:** county id determines eligible seed sets, county bounds, locality allowlists, and fallback language;
- **active town influence:** town selection narrows ranking and bounding where available;
- **search ranking:** contained results are ranked before any broader fallback candidates;
- **search bounding:** remote provider requests use active county/town viewboxes and bounded queries where appropriate;
- **fallback behavior:** fallback broadening must be explicit, visible, and must not present out-of-county results as active-county-local.

### Recommended patch sequence

1. Create county-scoped and town-scoped search context inputs from the county context patch.
2. Split local POI seeds by county ownership, and prevent Liberty/Cleveland/Baytown seeds from entering Montgomery-local searches unless explicitly requested by a broader mode.
3. Pass active county/town viewboxes to provider queries and set bounded search for local destination intent.
4. Add a post-provider containment filter using active county/town bounds or approved polygon containment where available.
5. Update ranking so active-county-contained results outrank broad Texas or legacy local results.
6. Add explicit fallback states for no contained results, with user-facing clarity if a broader search is used.

### Validation requirements

- Audit confirms no Liberty-oriented seed list is used as Montgomery-local input.
- Runtime validation confirms searches such as `walmart` while Montgomery/Conroe is active prefer Montgomery/Conroe-contained results.
- Runtime validation confirms Cleveland, Liberty, Baytown, and Harris-area results are not shown as local Montgomery results.
- Manual validation confirms provider results stay within the active containment area for local searches.
- Negative validation confirms broad search fallback, if invoked, is explicit and not mislabeled as contained.

## 7. Crossing Runtime Source Plan

### Affected systems

- Montgomery crossing source ownership and manifest entries.
- Crossing runtime producer/loader.
- Crossing runtime consumer/render path.
- Marker creation.
- Popup binding.
- Crossing filter gating.

### Ownership boundaries

Crossing rendering must only consume approved active-county crossing sources. The implementation must not fake Montgomery markers from basemap rail graphics, inferred rail lines, or unapproved data.

The implementation must distinguish:

- **crossing runtime producer:** the approved Montgomery crossing data source and normalization output;
- **crossing runtime consumer:** the runtime loader that fetches and normalizes active-county crossings;
- **marker creation:** Gridly marker creation that consumes normalized crossing records;
- **popup binding:** interaction binding attached to Gridly-owned markers only;
- **filter gating:** active county/town, viewport, infrastructure, and delay-state filters.

### Recommended patch sequence

1. Verify Montgomery crossing source approval status and expected asset path before runtime registration.
2. Add source manifest entries only after approval, preserving missing-source behavior until then.
3. Ensure the crossing loader resolves active-county crossing sources through the county package registry.
4. Confirm normalized Montgomery crossing records reach the existing Gridly marker creation path.
5. Confirm popup binding attaches only to Gridly-created Montgomery markers.
6. Confirm filter gating respects active county/town context and does not hide valid Montgomery crossings unexpectedly.

### Validation requirements

- Audit confirms Montgomery crossing runtime sources are registered only from approved assets.
- Runtime validation confirms missing-source state remains safe before activation.
- Runtime validation after the future crossing patch confirms Gridly Montgomery markers render from runtime crossing records.
- Manual validation confirms clicking a Montgomery crossing opens a Gridly popup.
- Manual validation confirms basemap rail graphics are not treated as Gridly crossings.

## 8. Road Hazard Context Ownership Plan

### Affected systems

- Road resolver source ownership.
- Active county ownership for hazard reports.
- Road-label fallback paths.
- Hazard title/card/popup/detail render paths.
- County-aware sanitizer and invalid-label detection.

### Ownership boundaries

Road-hazard language must be owned by the active county and approved road resolver sources. When road geometry is unavailable, fallback language must remain county-neutral or active-county-specific and must always pass through the sanitizer before display.

The implementation must distinguish:

- **road resolver ownership:** resolver inputs must come from active-county road sources only;
- **county ownership:** hazard metadata must remain tied to the active county/report county;
- **Liberty contamination path:** any legacy fallback phrase, default county string, or resolver miss path that can emit Liberty wording;
- **sanitizer path:** every hazard-facing surface must use normalized county-aware display text.

### Recommended patch sequence

1. Audit every road-label producer, resolver fallback, and hazard display surface for raw label usage.
2. Define active-county road resolver availability states: available, unavailable, missing, and fallback-only.
3. Prevent unavailable Montgomery road geometry from invoking Liberty-specific resolver labels.
4. Route all hazard titles, cards, popups, detail panels, notifications, and debug-visible strings through the county-aware sanitizer.
5. Add Montgomery-specific tests for known bad phrases, including `Local road impact into Liberty` and casing variants.
6. Register Montgomery road geometry only after data approval; until then, use safe county-aware fallback language.

### Validation requirements

- Audit confirms no hazard surface displays raw resolver fallback text.
- Runtime validation confirms Montgomery hazards cannot display Liberty wording.
- Runtime validation confirms resolver-unavailable state produces safe active-county fallback language.
- Manual validation confirms Conroe/Montgomery hazard cards and popups use Montgomery-safe wording.
- Negative validation confirms Liberty hazard wording remains valid when Liberty is active.

## 9. Recommended Patch Order

The recommended order is:

### A. County Context Containment

County context must be fixed first because search, crossings, and road-hazard ownership all depend on authoritative active-county/town context.

### B. Search Containment

Search should be patched second because it directly consumes county/town bounds and has highly visible user impact. It must not be patched before county bounds and town context are authoritative.

### C. Crossing Runtime Wiring

Crossing runtime wiring should be patched third because it requires approved source ownership and should reuse the corrected active county context and filter gating.

### D. Road Hazard Context Ownership

Road-hazard language should be patched fourth because it depends on county ownership and road-source availability states. Sanitizer coverage can be hardened before road data is available, but final resolver ownership should follow the context containment work.

No alternative order is recommended for V619+. Reordering would increase the risk of patching symptoms before the active-county ownership layer is reliable.

## 10. Validation Strategy

### Patch A — County Context Containment

- **Audit:** Trace active county id, selected town, county bounds, town bounds, fit source, startup zoom, and fallback paths.
- **Runtime validation:** Start Montgomery/Conroe context and verify county/town fit source diagnostics report Montgomery-owned context.
- **Manual validation:** Confirm map view feels Montgomery/Conroe-local and does not fall back to Liberty/default regional behavior.

### Patch B — Search Containment

- **Audit:** Trace seed ownership, provider viewbox/bounded flags, ranking, containment filters, and fallback broadening.
- **Runtime validation:** Search common destinations such as `walmart`, `heb`, `hospital`, and `gas` in Montgomery/Conroe context and verify contained ranking.
- **Manual validation:** Confirm out-of-county results are absent from local mode or clearly marked as broader fallback results.

### Patch C — Crossing Runtime Wiring

- **Audit:** Confirm approved Montgomery crossing source path, manifest status, loader path, normalized record shape, marker creation, popup binding, and filters.
- **Runtime validation:** Confirm Gridly markers render only from Montgomery crossing records and survive active filters.
- **Manual validation:** Click Montgomery crossing markers and verify Gridly popups appear; confirm basemap rail graphics remain non-interactive basemap features.

### Patch D — Road Hazard Context Ownership

- **Audit:** Trace every road-label producer and every hazard render consumer for sanitizer use.
- **Runtime validation:** Create or simulate Montgomery/Conroe hazard states and verify no Liberty contamination appears.
- **Manual validation:** Inspect hazard title, card, popup, detail, and notification language for county-safe wording.

### Shared validation gates

Each future implementation patch should run:

- targeted unit tests for the patched system;
- Montgomery active-county regression tests;
- Liberty active-county negative regression tests;
- `git diff --check`;
- `git status --short`.

## 11. Protected Systems Verification

V618 is planning-only. The protected systems must remain untouched in V618 and in each future patch unless a separate authorization explicitly changes scope.

Confirmed required state for this plan:

- historical reads remain disabled;
- history UI remains disabled;
- DriveTexas remains paused;
- Transportation Intelligence remains disabled;
- no Montgomery activation was performed;
- no runtime registration was performed;
- no search behavior was changed;
- no crossing rendering behavior was changed;
- no road resolver behavior was changed.

Future validation for each patch must include a protected-systems audit confirming these boundaries remain intact unless that specific milestone authorizes otherwise.

## 12. Recommended Next Milestone

**V619 — County Context Containment Implementation**

V619 should implement Patch A only: authoritative county context containment, county bounds ownership, town fit ownership, and audited fallback behavior. V619 should not implement search containment, crossing runtime wiring, road resolver changes, DriveTexas resumption, Transportation Intelligence enablement, or historical reads/UI.

## Testing

- `git diff --check` — passed.
- `git status --short` — showed this plan document plus pre-existing untracked dependency/build directories.
