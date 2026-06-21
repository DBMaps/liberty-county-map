# GRIDLY County Onboarding Implementation Blueprint V636

## Scope and protected boundaries

V636 is a documentation-only milestone. It makes no runtime changes, UI changes, asset changes, county activation changes, registry changes, historical-system changes, DriveTexas changes, Transportation Intelligence changes, or Supabase schema changes.

This document converts the Montgomery County onboarding experience into the official implementation blueprint for future county expansion.

---

## 1. Executive Summary

V636 exists because Montgomery proved that a county can pass extensive package, readiness, and validation review while still failing once it enters the live runtime pipeline. The Montgomery program produced enough implementation evidence to show that county onboarding is not a single gate; it is a sequence of asset, registry, runtime, rendering, reporting, awareness, persistence, and containment gates that must be validated in order.

Montgomery taught four core lessons:

1. **Validation-only county reviews are not implementation proof.** A county package may contain acceptable boundaries, assets, manifests, awareness definitions, and registry artifacts while runtime loaders still cannot reach or use those assets.
2. **Registry presence is not runtime ownership.** A county can be selectable or marked operational while runtime source fields remain missing, stale, or assigned to another county.
3. **Rendering is not reporting readiness.** Markers may render while reports fail to submit, fail to remain visible after save, fail to persist through refresh, or fail to promote into awareness surfaces.
4. **Containment must be proven after every lifecycle step.** County switching, after-save preservation, refresh-time rehydration, historical panels, duplicate suppression, and naming formatters can each reintroduce cross-county leakage or stale records.

The final goal of V636 is to establish a repeatable county onboarding framework that future counties can follow without repeating Montgomery's investigations, regressions, runtime surprises, or ambiguous activation decisions.

### Why runtime onboarding requires additional gates

Runtime onboarding requires gates beyond package validation because implementation behavior depends on live code paths that static package review cannot fully prove:

- source selection and fallback behavior;
- active county context ownership;
- inventory loading and normalization;
- marker creation, filtering, rendering, and click binding;
- report submission, local preservation, refresh rehydration, and awareness promotion;
- bottom-panel count reconciliation;
- county switch reload behavior;
- historical and protected-surface containment.

A future county is not implemented until the runtime proves that the county's assets are loaded, displayed, interactive, reportable, persistent, counted correctly, and isolated from every other county.

---

## 2. Montgomery Lessons Learned

Each lesson below records the symptom, root cause, resolution, and prevention strategy that future county onboarding must apply.

### V597 Runtime ownership gaps

- **Symptom:** Montgomery appeared ready at the artifact level, but runtime behavior still depended on legacy Liberty assumptions and unclear county ownership boundaries.
- **Root cause:** Early onboarding work emphasized county package completeness before proving every runtime resolver, label, source selector, and reporting path was county-owned.
- **Resolution:** Runtime ownership became an explicit review dimension, including active county context, package ownership, source ownership, and user-facing county language.
- **Prevention strategy:** Require a runtime ownership audit before activation. Every county-specific source, label, resolver, fallback, and report path must identify the owning county and must not silently borrow Liberty defaults.

### V627 Crossing registration failure

- **Symptom:** Montgomery crossings did not render. No crossing markers or click handlers were created.
- **Root cause:** The Montgomery crossing asset existed in the county package, but the runtime registry did not point to it. The active crossing source was missing, so the loader returned an empty feature collection before normalization or rendering.
- **Resolution:** The failure was classified as a runtime source registration failure, not a marker, zoom, popup, or visual asset failure.
- **Prevention strategy:** Do not treat package asset existence as runtime activation. Crossing assets must be registered in the active runtime source registry, loadable by the runtime, and proven by source-selection audit before render validation begins.

### V628 Runtime inventory assignment

- **Symptom:** Montgomery crossing inventory could be loaded after wiring, but county switching exposed stale inventory behavior and potential Liberty regression risk.
- **Root cause:** Runtime source selection became county-aware, but the crossing inventory lifecycle was not fully tied to active county changes. Loaded inventory could remain in memory after switching counties.
- **Resolution:** Runtime inventory assignment became an explicit gate: the active county, loaded source county, source path, normalized inventory, rejected inventory, and render candidates must agree.
- **Prevention strategy:** Every county switch must prove inventory ownership. Runtime validation must report loaded source county, active county, expected path, inventory counts, and reload requirement.

### V628.1 / V628.2 / V628.3 runtime activation findings

- **Symptom:** Runtime activation required several follow-up checks after initial wiring because success at one stage did not guarantee readiness at later stages.
- **Root cause:** The onboarding process initially lacked separate gates for activation state, runtime source availability, inventory assignment, rendering, interaction, reporting, and persistence.
- **Resolution:** Montgomery runtime activation was decomposed into stage-specific findings rather than a single activation claim.
- **Prevention strategy:** Future counties must use staged activation evidence. A county cannot move forward because a prior gate passed; each later runtime gate must produce its own PASS, PASS WITH OBSERVATIONS, or FAIL result.

### V633 Crossing awareness promotion

- **Symptom:** Crossing reports risked being excluded from top awareness because they were not road hazards.
- **Root cause:** Awareness classification logic was originally road-hazard centric and did not consistently treat rail/crossing reports as first-class awareness conditions.
- **Resolution:** Crossing reports were promoted as explicit rail/crossing awareness candidates rather than being rejected for not being road hazards.
- **Prevention strategy:** Future county validation must submit crossing reports and prove they promote into awareness with rail/crossing classification, not road-hazard fallback.

### V633.2 After-save visibility

- **Symptom:** A successful crossing report save did not by itself guarantee that the saved report stayed visible immediately after submission.
- **Root cause:** The save path and the post-save visibility path were not the same gate. Locally accepted crossing reports needed preservation until refresh-time ingestion could rehydrate them.
- **Resolution:** After-save preservation became a dedicated validation target.
- **Prevention strategy:** Require an after-save validation step for every county. A report must be visible immediately after save, before refresh, and must remain county-tagged.

### V633.4 Bottom awareness reconciliation

- **Symptom:** Bottom awareness counts could drift when crossing reports were promoted alongside road hazards.
- **Root cause:** Road-hazard counts and active issue counts were not always separated cleanly. Crossing reports needed to contribute to active issue awareness without inflating road-hazard counts.
- **Resolution:** Bottom count reconciliation became a separate validation gate that compares road-hazard classification counts, crossing counts, and total active issue counts.
- **Prevention strategy:** Future counties must validate bottom-panel counts after road and crossing submissions. Counts must reconcile by classification, not by raw report volume.

### V633.5 / V633.6 naming-quality suppression

- **Symptom:** Awareness and report language could display low-quality or non-compliant location names, including county/town labels or paired road strings where road-specific display text was required.
- **Root cause:** Resolver outputs were sometimes treated as display-ready strings. Fallbacks that are useful for lookup were not always appropriate for user-facing copy.
- **Resolution:** Naming-quality suppression and display-format alignment became activation concerns.
- **Prevention strategy:** Future counties must validate formatter output, not only resolver output. County names, town-only labels, ambiguous paired strings, and low-quality fallback labels must be suppressed or reformatted before user display.

### V633.7 refresh persistence

- **Symptom:** Crossing reports could appear after save but disappear after refresh if refresh ingestion did not restore them into active report state.
- **Root cause:** Post-save local preservation and refresh-time report ingestion were separate lifecycles. A save success did not guarantee refresh persistence.
- **Resolution:** Refresh persistence became a mandatory validation gate.
- **Prevention strategy:** Every county must prove saved crossing reports and road reports survive a refresh, rehydrate into active inventory, and remain scoped to the active county.

### V633.8 formatter alignment

- **Symptom:** Awareness strings could be technically derived from valid data but still fail approved language standards.
- **Root cause:** Formatting expectations were not enforced at the same level as data availability. Resolver and formatter responsibilities needed clearer separation.
- **Resolution:** Formatter alignment became part of activation readiness.
- **Prevention strategy:** Future counties must run display-language checks for road hazards, crossing reports, awareness headers, bottom-panel labels, report popups, and any county-specific location text.

### V634 duplicate flooding contamination

- **Symptom:** Cleared or duplicate flooding records could contaminate active awareness and road-hazard counts.
- **Root cause:** Duplicate suppression needed to account for active reports, active hazards, and recently cleared lifecycle rows before final awareness classification.
- **Resolution:** Duplicate suppression was applied across combined lifecycle sources before awareness classification and bottom-count reconciliation.
- **Prevention strategy:** Future county validation must include duplicate and cleared-report scenarios. Cleared duplicates must not rehydrate into active awareness after refresh or county switching.

---

## 3. County Onboarding Checklist

The official onboarding checklist is implementation-oriented. Each item must be marked PASS, PASS WITH OBSERVATIONS, FAIL, or NOT APPLICABLE with evidence.

### Package and source readiness

- County package exists.
- County package manifest exists.
- County registry artifact exists.
- County boundary/bounds asset exists.
- County boundary source is identified, with county-owned active geometry preferred over unvalidated statewide production display geometry.
- County awareness areas exist.
- County town/community definitions exist.
- County rollback artifact exists.
- County activation evidence artifact exists.
- County-specific risks are documented.

### Asset readiness

- Crossing assets exist.
- Road assets exist.
- Boundary assets are parseable.
- Awareness assets are parseable.
- Crossing assets are parseable.
- Road assets are parseable.
- Asset counts are recorded before runtime wiring.
- Null-coordinate or rejected-feature counts are recorded.

### Runtime registration readiness

- County runtime registration exists.
- County activation flags match intended stage.
- County source registry resolves the county, not Liberty fallback.
- Crossing source path is registered.
- Road source path is registered or formally observed with mitigation.
- Boundary source path is registered.
- Active county boundary display source is county-owned or explicitly validated as production-quality fallback geometry.
- Boundary overlay policy is active-county-only; inactive county boundaries are suppressed during normal runtime.
- Awareness source path is registered.
- Runtime source availability reports expected status.

### Runtime inventory readiness

- Active county resolves correctly.
- Loaded source county matches active county.
- Crossing inventory assignment is county-owned.
- Road inventory assignment is county-owned.
- Normalization succeeds.
- Rejected inventory counts are explained.
- Runtime inventory reloads or invalidates on county switch.

### Rendering and interaction readiness

- County map viewport/bounds are correct.
- Exactly one active county boundary renders in normal runtime.
- Inactive county boundaries are hidden in normal runtime.
- County boundary styling remains visually subordinate to awareness, alerts, crossings, and hazards.
- Crossing markers render.
- Road features render or are intentionally observed.
- Marker counts reconcile to normalized inventory and visibility filters.
- Click binding is verified.
- Popups display county-appropriate language.
- No off-county markers appear in active county context.

### Reporting and persistence readiness

- Crossing report submission is verified.
- Road/hazard report submission is verified.
- Reports are county-tagged.
- After-save visibility is verified.
- Refresh persistence is verified.
- Local preservation and refresh ingestion agree.
- Cleared reports are removed or suppressed correctly.
- Duplicate flooding or duplicate hazard contamination is suppressed.

### Awareness readiness

- Crossing awareness promotion is verified.
- Road-hazard awareness promotion is verified.
- Awareness classification separates road hazards from crossings.
- Bottom count reconciliation is verified.
- Top awareness language is formatter-compliant.
- Naming-quality suppression is verified.
- Awareness promotion survives refresh.


### County Boundary Validation

County boundaries provide geographic context only. They are not primary content and must never compete with awareness, alerts, crossings, hazards, route workflows, markers, popups, or map controls. Future counties inherit the V637B–V637E.3 production boundary standard: normal runtime displays exactly one active county boundary, prefers county-owned active geometry, suppresses inactive county boundaries, preserves subordinate styling, and keeps overlay layers pointer-event safe.

- County boundary source identified.
- County-owned geometry available for active display.
- Statewide geometry is limited to lookup, matching, fallback, or administration unless its active-boundary visual quality is explicitly validated.
- Active county renders correctly.
- Inactive counties are suppressed in normal user-facing runtime.
- Boundary styling is visually subordinate to awareness, alerts, crossings, and hazards.
- Every awareness area carries explicit `countyId` ownership rather than relying on town names, historical defaults, or fallback behavior.
- County switching updates awareness context, active county context, boundary overlay, and county identity rendering together.
- Boundary overlays rebuild when county ownership changes.
- Overlay safety is verified for pointer events, markers, popups, routes, controls, reporting, hazard selection, crossing selection, and route workflows.
- Audit passes.

### Containment readiness

- County containment is verified.
- County switching is verified in both directions.
- County switching synchronizes awareness context, active county context, active county boundary overlay, and county identity rendering.
- Boundary overlays rebuild when county ownership changes.
- Historical containment is verified or protected-surface neutralization is confirmed.
- Liberty fallback contamination is absent.
- Untagged legacy row behavior is documented.
- Cross-county report leakage is absent.
- Cross-county inventory leakage is absent.

---

## 4. Mandatory Validation Sequence

The validation order is mandatory because each stage depends on the prior stage. Running later checks first can produce false confidence or hide the true failure stage.

1. **Asset validation** — prove the county package inputs exist, parse, and have known counts before runtime wiring is judged.
2. **Runtime registration validation** — prove the runtime points to county-owned sources and does not silently use missing sources or Liberty fallbacks.
3. **Runtime inventory validation** — prove registered sources actually load, normalize, reject invalid records predictably, and assign inventory to the active county.
4. **Rendering validation** — prove normalized inventory reaches map layers and visible marker/feature counts reconcile.
5. **Click validation** — prove rendered features are interactive and bound to the correct report or popup behavior.
6. **Report submission validation** — prove user actions create county-tagged reports through the intended runtime path.
7. **After-save validation** — prove accepted reports remain visible immediately after save.
8. **Refresh validation** — prove reports rehydrate after refresh and do not depend only on local post-save preservation.
9. **Awareness promotion validation** — prove reports promote into the correct awareness category and display language.
10. **Bottom-count validation** — prove active issue counts, road-hazard counts, and crossing counts reconcile.
11. **County-switch validation** — prove switching away and back reloads or preserves the correct county-owned state.
12. **County boundary validation** — prove the active county boundary renders from validated county-owned geometry where available, inactive boundaries are suppressed, visual hierarchy is subordinate, county switching rebuilds overlays, and overlay safety is preserved.
13. **Containment validation** — prove no reports, awareness rows, historical rows, markers, boundaries, or inventory leak across counties.

### Why order matters

Order matters because a later success can be misleading. A report can save while failing after-save visibility. A marker can render from stale inventory while runtime registration is wrong. Awareness can show an alert while bottom counts are wrong. Containment can appear correct before refresh and fail after rehydration. The sequence isolates the first failing stage and prevents incorrect root-cause conclusions.

---

## 5. County Activation Readiness Gates

A county is considered implemented only when required gates pass or receive formally accepted observations.

### Required audits

- **CountyContextContainmentAudit** — active county, selected awareness area, county labels, report ownership, and county switch behavior are contained.
- **CrossingActivationReadinessAudit** — crossing source selection, source availability, load count, normalized count, rejected count, marker count, rendered count, click binding, and readiness classification are proven.
- **AwarenessClassificationAudit** — road hazards, crossings, active issue counts, duplicate suppression, and selected awareness details classify correctly.
- **CrossingAwarenessPromotionAudit** — crossing reports become first-class rail/crossing awareness conditions and are not rejected as non-road hazards.
- **HistoricalPanelContainmentAudit** — historical reads and history UI remain disabled or produce county-contained/neutralized output under protected flags.
- **RuntimeInventoryAssignmentAudit** — active county, loaded source county, expected source path, normalized inventory, and reload requirement agree.
- **CountyBoundaryValidationAudit** — boundary source, county-owned geometry, active-only rendering, inactive suppression, visual hierarchy, county-switch synchronization, and overlay safety are proven.
- **AfterSaveVisibilityAudit** — accepted reports are locally preserved and visible immediately after save.
- **RefreshPersistenceAudit** — saved reports rehydrate after refresh without cross-county leakage.
- **BottomAwarenessCountAudit** — bottom counts reconcile by classification.
- **NamingQualityAndFormatterAudit** — location names and awareness/report strings meet approved display templates.
- **DuplicateLifecycleSuppressionAudit** — duplicate and cleared lifecycle records do not contaminate active awareness.

### PASS criteria

A gate is **PASS** when all required evidence is present, runtime behavior matches the expected county-owned path, counts reconcile, no protected boundary is changed, and no cross-county leakage is detected.

### PASS WITH OBSERVATIONS criteria

A gate is **PASS WITH OBSERVATIONS** when the county is safe to continue but a non-blocking limitation remains documented. Observations must be explicit, bounded, non-protective-boundary-breaking, and must not hide missing roads, missing crossings, failed report persistence, failed awareness promotion, or containment leakage.

Examples of acceptable observations include documented road naming maturity limitations or intentionally disabled protected systems, provided they do not produce incorrect user-facing runtime behavior.

### FAIL criteria

A gate is **FAIL** when any of the following occurs:

- county-owned runtime source is missing;
- assets exist but are not registered;
- inventory loads from the wrong county;
- markers fail to render from valid inventory;
- click binding fails;
- report submission fails;
- saved reports disappear after save or refresh;
- crossing reports do not promote into awareness;
- bottom counts do not reconcile;
- county switching leaves stale inventory;
- historical or report data leaks across counties;
- protected systems are activated without authorization;
- Liberty fallback masks a missing county dependency;
- inactive county boundaries render in normal user-facing runtime;
- active county boundary geometry is unvalidated or visually misleading;
- boundary styling dominates awareness, alerts, crossings, hazards, or route context;
- boundary overlays interfere with pointer events, markers, popups, controls, reporting, hazard selection, crossing selection, or route workflows.

---

## 6. Anti-Pattern Catalog

### Registry-only activation

- **Why dangerous:** Registry flags can say a county is operational even when runtime source fields are missing or stale.
- **Montgomery evidence:** Montgomery was operational/selectable while crossing source availability was missing.
- **Correct approach:** Treat registry status as one input. Require runtime source, inventory, render, interaction, reporting, persistence, awareness, and containment evidence.

### Asset-only activation

- **Why dangerous:** Assets in a package do not prove the runtime can load them.
- **Montgomery evidence:** Montgomery crossing GeoJSON existed but was not referenced by the active runtime crossing source.
- **Correct approach:** Verify asset existence and runtime registration separately, then prove load and normalization.

### Rendering-only validation

- **Why dangerous:** A rendered marker does not prove click binding, reporting, after-save visibility, refresh persistence, or awareness promotion.
- **Montgomery evidence:** Later onboarding work showed reporting and awareness gates required independent validation after crossing activation.
- **Correct approach:** Continue validation through click, submission, after-save, refresh, awareness, bottom count, and containment gates.

### Audit-only validation

- **Why dangerous:** An audit may report part of the pipeline while missing source registration, lifecycle persistence, or UI visibility failures.
- **Montgomery evidence:** Existing crossing render and pipeline audits could show render state and report counts but did not fully prove source asset registration readiness.
- **Correct approach:** Use audits as evidence inside a mandatory sequence, not as substitutes for end-to-end implementation validation.

### Assuming persistence because save succeeds

- **Why dangerous:** Save success and post-refresh visibility are separate lifecycle states.
- **Montgomery evidence:** V633.2 and V633.7 separated after-save visibility from refresh persistence.
- **Correct approach:** Validate immediate after-save visibility and refresh-time rehydration independently.

### Assuming containment because assets render

- **Why dangerous:** Assets can render while reports, historical panels, or stale inventories leak across county contexts.
- **Montgomery evidence:** County switching and historical containment investigations showed rendered state is not full containment proof.
- **Correct approach:** Run containment after submission, refresh, awareness promotion, county switching, and historical-surface checks.

### Assuming awareness promotion because alerts exist

- **Why dangerous:** Alerts can exist without correct classification, bottom counts, formatter language, or duplicate suppression.
- **Montgomery evidence:** Crossing awareness promotion, bottom awareness reconciliation, naming-quality suppression, formatter alignment, and duplicate flooding suppression all required separate fixes or validation.
- **Correct approach:** Validate classification, selected awareness detail, display language, top awareness, bottom counts, and lifecycle suppression.

### Allowing Liberty fallback to hide missing dependencies

- **Why dangerous:** Liberty defaults can make a county appear functional while using another county's inventory or language.
- **Montgomery evidence:** Runtime ownership and crossing source selection had to prove Montgomery-owned paths rather than fallback behavior.
- **Correct approach:** Require county-owned source paths and explicit fallback classification for every runtime source.


### Displaying inactive county boundaries

- **Why dangerous:** Inactive county outlines create visual confusion about the active operating area and can imply that multiple counties are live when only one county context should be user-facing.
- **Montgomery evidence:** V637B–V637E.3 showed that normal runtime should display exactly one active county boundary: Liberty for Dayton, Montgomery for Willis, and the future county boundary for County #3 when it becomes active.
- **Correct approach:** Suppress inactive county boundaries in normal runtime and rebuild the boundary overlay whenever county ownership changes.

### Using statewide geometry as automatic active display geometry

- **Why dangerous:** Statewide Texas boundary assets may be useful for lookup, matching, fallback, and administration, but may not provide sufficient visual quality for active county production display.
- **Montgomery evidence:** Boundary refinement showed that active county display requires county-owned geometry support or explicit validation of any fallback geometry before production use.
- **Correct approach:** Prefer county-owned geometry for active display; use statewide geometry as production display only after visual quality and active-boundary behavior are validated.

### Letting county boundaries dominate the map

- **Why dangerous:** County outlines are context, not primary content. Heavy strokes or attention-grabbing county rendering can distract from the Awareness Platform First mission.
- **Montgomery evidence:** V637B–V637E.3 confirmed the visual priority order: awareness, alerts, crossings, hazards, then county context.
- **Correct approach:** Keep boundary styling visually subordinate and verify it does not interfere with markers, popups, routes, controls, reporting, or selection workflows.

### Treating county switch as a display-only event

- **Why dangerous:** County switching changes source ownership, inventory validity, awareness scope, and report containment.
- **Montgomery evidence:** Stale crossing inventory after switching could leave the wrong county inventory in memory.
- **Correct approach:** Validate reload or invalidation behavior on every county switch.

---

## 7. County #3 Preflight Requirements

Before implementation starts for County #3, the following must be reviewed and documented.

### County identity and geography

- Confirm county name, state, GEOID, canonical county ID, and display name.
- Confirm county bounds and boundary source.
- Identify county-owned active boundary geometry and document whether statewide geometry is lookup-only, fallback-only, administrative, or validated for display.
- Confirm town/community definitions and awareness-area assignments.
- Identify edge communities and border-adjacent assets that may create containment risk.

### County assets

- Inventory crossing assets and expected counts.
- Inventory road assets and expected counts.
- Inventory awareness assets and expected counts.
- Validate GeoJSON parseability.
- Record invalid, null-coordinate, duplicate, or out-of-bounds records before runtime work.

### Runtime expectations

- Define expected runtime source paths.
- Define whether each source is local, remote, fallback, or package-scoped.
- Define activation flags and staged/operational expectations.
- Define reload expectations for county switching.
- Define active-only boundary overlay expectations and inactive-boundary suppression behavior.
- Define report county-tagging expectations.

### Audit coverage

- Confirm availability or planned coverage for activation readiness, crossing readiness, awareness classification, crossing awareness promotion, historical panel containment, inventory assignment, county boundary validation, after-save visibility, refresh persistence, bottom count reconciliation, naming quality, and duplicate lifecycle suppression.

### Known county-specific risks

- Border crossing ambiguity.
- Shared road names with neighboring counties.
- Unnamed, private, or low-quality road segments.
- Rail crossings with missing coordinates.
- Communities near county boundaries.
- Legacy untagged rows or fallback rows.
- County-specific language or awareness-area naming risks.
- Any protected-system dependency request.

### Preflight exit criteria

County #3 may begin runtime implementation only when package assets, expected source paths, activation stage, audit coverage, containment risks, boundary source, county-owned active geometry plan, active-only boundary rendering expectation, and known limitations are documented. County #3 must not be activated until its county boundary source is identified, active geometry is validated, active-only rendering is confirmed, and the County Boundary Validation checklist is complete. Preflight does not activate the county; it only authorizes controlled implementation work.

---

## 8. Future County Onboarding Model

The recommended future flow is:

```text
Fast-track validation
↓
Candidate approval
↓
Preflight review
↓
Implementation blueprint review
↓
Runtime onboarding
↓
Runtime validation
↓
Cross-county validation
↓
Activation readiness review
↓
Production approval
```

### Flow definitions

1. **Fast-track validation** — determine whether the county has enough package evidence to be considered.
2. **Candidate approval** — approve the county for preflight only, not implementation or activation.
3. **Preflight review** — identify assets, bounds, inventory, awareness definitions, runtime expectations, audits, and county-specific risks.
4. **Implementation blueprint review** — apply this V636 blueprint and define the exact county-specific validation plan.
5. **Runtime onboarding** — wire only approved runtime paths under controlled stage flags.
6. **Runtime validation** — execute the mandatory sequence from asset validation through containment validation.
7. **Cross-county validation** — switch between Liberty, Montgomery, and the new county to prove no leakage or stale inventory.
8. **Activation readiness review** — classify each gate as PASS, PASS WITH OBSERVATIONS, or FAIL.
9. **Production approval** — approve activation only when all blocking gates pass and observations are formally accepted.

---

## 9. Final Determination

Montgomery produced sufficient implementation knowledge to establish a repeatable county onboarding methodology.

The key determination is that future counties must not be onboarded through validation-only or registry-only approval. Montgomery showed that implementation readiness requires a staged runtime framework that proves source registration, inventory assignment, active county boundary validation, rendering, click binding, submission, after-save visibility, refresh persistence, awareness promotion, bottom-count reconciliation, county switching, and containment.

### Recommendation for County #3 onboarding

County #3 should use this V636 blueprint as the authoritative implementation methodology. County #3 should not proceed directly from fast-track readiness into activation. It should first complete preflight, then execute the mandatory validation sequence, including County Boundary Validation, then receive a formal activation readiness classification. County #3 must not activate until boundary source identification, county-owned active geometry validation, active-only rendering confirmation, overlay safety verification, and checklist completion are documented.

County #3 should be expected to move faster than Montgomery because the failure modes are now known, but speed must come from better gates rather than skipped gates.

---

## 10. Merge Recommendation

**Recommendation: MERGE V636.**

This package is documentation-only and establishes the permanent County Onboarding Implementation Blueprint. It does not change runtime behavior, UI behavior, assets, county activation, registries, historical systems, DriveTexas, Transportation Intelligence, or Supabase schema.

Required validation:

```text
✅ git diff --check
```

Expected outcome: future county expansion uses this blueprint as the standard process for implementation, validation, cross-county containment, and activation readiness decisions.
