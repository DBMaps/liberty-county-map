# GRIDLY Liberty County #1 Normalization Plan V460

## 1. Executive Summary

V460 is a documentation-only planning milestone. It defines how Liberty County transitions from an implicit platform assumption to an explicit **County #1 configuration** while preserving all current behavior.

No production code, migrations, UI flows, onboarding behavior, Route Watch behavior, reporting behavior, awareness behavior, historical-read behavior, Supabase behavior, DriveTexas activation, transportation-intelligence activation, or county activation is changed by this plan.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

V458 established that Liberty County is ready to be treated as County #1, while County #2 is not ready for visible evaluation. V459 established the future county activation architecture: lifecycle, package contract, registry governance, storage ownership, read/write containment, rollback, and transportation-intelligence compatibility. V460 narrows that architecture back onto Liberty and answers: **What Liberty-specific assumptions are intentional County #1 behavior, and what assumptions should eventually become configuration?**

Protected boundaries remain unchanged and must continue to be treated as non-negotiable for this milestone:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**.

### V460 conclusion

Liberty can be formally considered **County #1** as a planning and architecture designation. The designation should not be interpreted as a runtime behavior change. Liberty remains the only visible county, the current Liberty fallback remains intentional, and County #2 remains blocked by registry governance, county package validation, storage namespace planning, read/write containment proof, source governance, and rollback planning.

The recommended next milestone is **V461 County Registry Contract and Validation Plan**.

## 2. County #1 Definition

### What County #1 means

Liberty County is County #1 when it is treated as the canonical seed county for the county-aware platform architecture. County #1 is the first county whose current production assumptions are inventoried, preserved, and prepared for eventual migration into governed county configuration.

County #1 means:

1. Liberty is the default supported county context for the current product.
2. Existing Liberty behavior remains authoritative for current users.
3. Missing legacy county metadata continues to be interpreted through the Liberty compatibility policy.
4. Liberty configuration becomes the reference package for future county package structure.
5. Liberty remains the baseline for county registry, storage, containment, fallback, QA, and source-contract normalization planning.
6. County #1 status does not create County #2 activation rights.
7. County #1 status does not activate DriveTexas, historical reads, historical UI, transportation intelligence, or regional aggregation.

### What County #1 does not mean

County #1 does not mean:

- A new county is activated.
- County selection is implemented.
- County detection is implemented.
- Liberty behavior changes.
- Legacy storage keys are migrated.
- Reports, alerts, awareness, crossings, hazards, Route Watch, or historical systems change behavior.
- Liberty fallback is removed.
- Historical data becomes consumer-visible.
- DriveTexas or transportation intelligence becomes live.

### Platform Logic vs County Configuration

| Area | Platform Logic | County Configuration |
| --- | --- | --- |
| County identity | Canonical county id rules, registry validation, lifecycle states, visibility gates | `liberty-tx`, Liberty County display name, Texas state metadata |
| Fallback behavior | Missing/invalid county handling policy, legacy/null policy, unsupported county behavior | Liberty legacy fallback eligibility and copy |
| Geography | Boundary validation, point-in-polygon checks, county containment rules | Liberty boundary artifact, centroid, default map view |
| Awareness | Awareness rendering, summary generation, active area resolution, unavailable-state handling | Liberty awareness areas, default city, area labels, localized copy |
| Reports | Write metadata contract, read filters, null-county compatibility, quarantine rules | Liberty default county metadata and legacy-row interpretation |
| Storage | Global vs county-scoped key policy, migration/rollback rules | Liberty storage namespace values and compatibility aliases |
| Crossings | Crossing loader contract, fallback strategy, override governance | Liberty FRA source URL, local crossing file, override file |
| Road segments | Road-segment geometry contract and normalization rules | Liberty road-segment file and corridor names |
| Route Watch | Route state model, relevance validation, county/route containment policy | Liberty route fixtures, Liberty corridor QA expectations |
| Historical capture | Internal-only capture policy, protected read/UI/API boundaries, county metadata envelope | Liberty historical context values, if later captured with county metadata |
| Transportation intelligence | Source governance, activation gates, pause/rollback policy | Liberty source identifiers and corridor allowlists, remaining paused |

## 3. Liberty Assumption Inventory

| Liberty assumption | Classification | Rationale | Future action |
| --- | --- | --- | --- |
| `liberty-tx` is the default county id. | A. Permanent County #1 Configuration | A stable default is required to preserve current behavior and legacy compatibility. | Keep explicit in County #1 configuration and registry. |
| Liberty is the only visible county. | A. Permanent County #1 Configuration | Current product is Liberty-only; this is intentional and safe. | Preserve until activation governance approves another county. |
| Missing county metadata is treated as Liberty only in the default Liberty context. | C. Legacy Compatibility Requirement | Existing records may lack county metadata and must not disappear or leak into a future county. | Document as Liberty legacy/null policy; never extend to County #2. |
| Invalid active county falls back safely to Liberty in current Liberty-only mode. | C. Legacy Compatibility Requirement | Prevents broken current behavior, but future multi-county mode should prefer unsupported/choose-county behavior. | Preserve for current mode; revisit during county selection design. |
| Liberty display name, state, and default city are embedded in current registry/config helpers. | B. Future County Package Configuration | These are true county metadata and should be package-owned. | Move into governed county package/registry contract when implemented. |
| Liberty boundary file is a static data artifact. | B. Future County Package Configuration | Boundary is county-owned geography and should be versioned with package metadata. | Define source, version, validation date, and QA fixtures. |
| Liberty crossings use a Liberty/Texas FRA source and local fallback. | B. Future County Package Configuration | Source URL and local fallback are county-specific and valid for County #1. | Convert into source contract plus crossing package component. |
| Liberty crossing overrides are stored as a shared static override artifact. | B. Future County Package Configuration | Overrides are local corrections and need owner/review metadata. | Package as Liberty crossing overrides with governance fields. |
| Liberty road segments are stored as Liberty-specific GeoJSON. | B. Future County Package Configuration | Road network inputs are county-owned and needed for hazards/Route Watch compatibility. | Package with road normalization rules and corridor fixtures. |
| Awareness copy falls back to “Liberty County.” | B. Future County Package Configuration | Safe while only Liberty is visible; unsafe as generic platform logic. | Move user-facing county labels into active county config. |
| Awareness areas/towns are Liberty-shaped. | B. Future County Package Configuration | Area names and locality defaults cannot be reused across counties. | Define awareness-area component in Liberty package. |
| Many localStorage keys are global. | D. Technical Debt | Safe for a one-county product, but not safe for multi-county preferences and saved places. | Plan namespace and migration in storage milestone; do not migrate in V460. |
| A county-scoped storage helper exists but is not universal. | D. Technical Debt | It is a foundation, not complete containment. | Identify adoption targets in V462. |
| Supabase report writes can include county metadata with legacy fallback. | A/B. County #1 behavior and future package compatibility | Current behavior is safe for Liberty and points toward county-scoped writes. | Preserve; later validate read filters and legacy/null policy. |
| TxDOT/DriveTexas prototype has Liberty county number/corridor assumptions. | D. Technical Debt while paused | Acceptable only because DriveTexas remains paused. Unsafe if activated without governance. | Keep paused; defer to transportation governance milestone. |
| Route Watch fixtures are Liberty County-style. | A/B. County #1 QA baseline and future fixture package | Useful as County #1 validation evidence, not County #2 proof. | Package as Liberty QA fixtures in a future fixture standard. |
| Historical intelligence remains internal-only and protected. | A. Permanent County #1 protected behavior | Protected boundaries are intentionally closed. | Preserve until separate future authorization. |
| Audit helpers validate Liberty fallback. | A/B. County #1 validation baseline and future validation contract | Strong evidence for County #1, but insufficient for County #2. | Convert expectations into registry/package validation rules. |

## 4. County #1 Configuration Model

The Liberty County #1 configuration model should eventually separate package-owned county facts from platform-owned runtime behavior.

### Recommended Liberty configuration components

| Component | Liberty content | Recommended owner | Notes |
| --- | --- | --- | --- |
| County metadata | County id, display name, state code/name, default city, lifecycle state, visibility state | County registry owner + platform owner | Registry should expose minimal runtime metadata and point to package artifacts. |
| Boundary | Liberty County polygon, source, version, validation date, inside/outside fixtures | County package owner + QA owner | Boundary drives containment and selection/detection compatibility. |
| Default city/locality | Current default Liberty locality/city label | County package owner | Should not be hardcoded in generic copy. |
| Awareness areas | Liberty towns/areas, labels, default area, area rules | County package owner + product owner | Required before any other county can be evaluated. |
| Crossings | FRA source, local fallback file, crossing identifiers, display labels | County package owner + source governance owner | Include source authority and fallback rules. |
| Crossing overrides | Review decisions, reasons, owners, review dates | Data/package owner + QA owner | Overrides need auditability. |
| Road segments | Liberty road segment file, corridor list, road-name normalization | Data/package owner | Supports hazards and future route/transportation compatibility. |
| Source contracts | FRA, local static data, future transportation candidates | Source governance owner | DriveTexas remains paused; source contracts do not imply activation. |
| Localized copy | County display labels, unsupported-state copy, fallback awareness copy | Product/content owner | Move Liberty wording out of generic platform logic over time. |
| QA fixtures | Boundary cases, crossing samples, road-name samples, report samples, route samples | QA owner | Fixture standard should be reusable for future counties. |
| Support metadata | Support region, incident owner, data review cadence, escalation contacts | Operations/support owner | Required before activation of any future county. |
| Storage policy | Liberty legacy keys, county-scoped target keys, migration eligibility | Engineering owner + platform owner | V460 assesses only; no migration. |
| Read/write containment policy | Reports, alerts, awareness, pulse, Route Watch, historical capture, hazards | Engineering owner + QA owner | Should become validation evidence, not runtime change in V460. |

### Configuration principles

1. Liberty package data should be explicit even when it matches current defaults.
2. Platform logic should not contain Liberty-specific labels unless the label is intentionally a compatibility fallback.
3. Registry metadata should not become a dumping ground for all package details.
4. Source contracts must remain separate from activation flags.
5. QA fixtures should validate package behavior without enabling new behavior.
6. Historical and transportation-intelligence boundaries must remain closed unless separately authorized.

## 5. Liberty Fallback Preservation Plan

Liberty fallback is a current product safety feature and must be preserved until a future milestone explicitly replaces it.

### Legacy reports

- Reports without county metadata should remain eligible for Liberty only under the approved Liberty legacy/null policy.
- Missing county metadata must not become a generic “current county” match in future multi-county mode.
- Future County #2 reads must exclude null county rows unless a separate migration assigns them safely.

### Legacy storage

- Existing Liberty localStorage keys should continue to work.
- Future county-scoped keys must not strand current users or erase Liberty preferences.
- Namespace migration should be additive, reversible, and separately authorized.
- Global identity keys may remain global; area, route, saved-place, feedback, crossing, and local-awareness keys should be assessed for county scope.

### Legacy awareness behavior

- Liberty awareness fallbacks should remain accurate for current users.
- Liberty copy should be treated as County #1 package copy, not generic platform copy.
- Missing awareness-area behavior should default safely within Liberty only while Liberty is the sole active county.

### Legacy county metadata

- Liberty county metadata should remain the canonical default for current mode.
- Future county registry validation should explicitly recognize Liberty as County #1.
- County metadata fallback should be observable in validation, not hidden in scattered UI strings.

### Missing county behavior

- Current mode: preserve Liberty fallback.
- Future multi-county mode: prefer validated user selection, GPS suggestion only when authorized, or unsupported/choose-county behavior.
- Missing county must never activate transportation intelligence or historical reads.

### Invalid county behavior

- Current mode: invalid ids may normalize to Liberty to preserve current behavior.
- Future mode: invalid ids should be rejected, should not create namespaces, should not read/write data, and should not display stale county data.

### Preservation principles

1. Preserve current Liberty user experience first.
2. Make Liberty assumptions explicit before replacing them.
3. Treat null county metadata as a Liberty compatibility rule, not a platform rule.
4. Prefer additive namespace and metadata strategies.
5. Do not use fallback behavior to simulate County #2 readiness.

## 6. County Package Mapping

| V459 package component | Liberty status | Assessment |
| --- | --- | --- |
| Metadata | Partially Exists | County id, display name, state, default city, and paths exist in current county-aware helpers, but lifecycle, owner, package ref, and validation metadata are not formalized. |
| Geography | Partially Exists | Liberty boundary exists, but source/version/validation evidence and package manifest ownership need formalization. |
| Awareness | Partially Exists | Liberty awareness behavior and fallback copy exist, but area definitions and localized copy are not yet governed as a package component. |
| Crossings | Partially Exists | Remote FRA source, local fallback, and overrides exist; source contract and override governance remain informal. |
| Road-network | Partially Exists | Liberty road segments exist; normalization rules, versioning, and county package ownership remain future work. |
| Source-contracts | Missing | Source authority, licensing, freshness, failure mode, pause criteria, and review cadence need formal package artifacts. |
| Route-watch | Partially Exists | Liberty-style fixtures and route intelligence work exist, but county-scoped saved route/storage policy and package fixture standard are not complete. |
| Reporting | Partially Exists | County metadata write behavior exists with legacy fallback; read containment and null policy need validation evidence. |
| Historical-context | Future | Historical capture is protected and internal-only; county metadata envelope planning is future work, with reads/UI/API remaining disabled. |
| QA-fixtures | Partially Exists | Route, crossing, and county audits provide seeds; a formal county package fixture standard is missing. |
| Operations | Missing | Support region, owner, escalation, launch/pause messaging, and data review cadence are not formalized. |
| Governance | Missing | Lifecycle state, approval, validation, rollback, and package ownership are not yet codified for Liberty as County #1. |

## 7. Storage Normalization Assessment

### Acceptable Liberty storage assumptions

- Device identity may remain global.
- Authentication/session state may remain global.
- General app settings such as theme or map style may remain global unless they alter local awareness behavior.
- Liberty legacy keys may remain readable to preserve current behavior.
- A Liberty-only default can remain in current mode while no other county is active.

### Assumptions that should eventually become county-scoped

- Awareness area/home town.
- Home/work place records when interpreted as local places.
- Saved places and route endpoints when used by Route Watch or awareness.
- Route Watch active route and route-derived alert state.
- Feedback drafts and local feedback metadata.
- Crossing review state.
- Local awareness filters and alert preferences that depend on county geography.
- Historical capture context, if written in future internal-only capture envelopes.
- Source health/cache state by county/source.

### Assumptions requiring migration planning

- Existing global Liberty keys that contain local area or saved-place state.
- Any report, feedback, or cached alert data lacking county metadata.
- Any crossing review state that assumes Liberty crossing ids without namespace.
- Any Route Watch state that assumes Liberty corridors.
- Any stored profile field that uses town names without county context.

### Assessment-only recommendation

No storage migration should occur in V460. The correct next storage milestone should create:

1. A key inventory.
2. A global vs county-scoped classification.
3. A Liberty legacy-read compatibility plan.
4. A write-forward namespace plan.
5. A rollback plan.
6. Validation fixtures proving no preference bleed across counties.

## 8. Read/Write Containment Compatibility Review

| System | Current Liberty compatibility | Future normalization target |
| --- | --- | --- |
| Reports | Compatible for County #1 because writes can include county metadata and legacy rows can remain Liberty-compatible. | Prove active-county read filters, null-row policy, county/location validation, and County #2 exclusion. |
| Alerts | Compatible as long as Liberty is the only active county and derived inputs remain Liberty-contained. | Ensure alert generation, deduplication, lifecycle, cache, and display carry county metadata. |
| Awareness | Compatible for County #1 because Liberty copy and areas match current product. | Move area definitions, localized labels, fallback copy, and unsupported states into county package config. |
| Community Pulse | Compatible for Liberty-only summaries. | Restrict inputs to active-county eligible records and prevent cross-county aggregation without regional architecture. |
| Route Watch | Compatible as Liberty-only/shadow-oriented behavior. | County-scope saved places, active routes, relevance fixtures, and route-exits-county behavior. |
| Historical Capture | Compatible only because historical reads/UI/API remain closed and internal-only. | Add county metadata to future capture envelopes while preserving internal-only boundaries. |
| Crossings | Compatible for Liberty because remote/local fallback and overrides are Liberty-aligned. | Package crossing source contracts, fallback files, override ownership, and validation fixtures. |
| Hazards | Compatible while road segments and report context are Liberty-only. | County-scope road segments, hazard location rules, road-name normalization, and alert derivation. |

### Containment principles for Liberty normalization

1. Every local write should eventually carry county metadata.
2. Every consumer-visible local read should eventually filter by active county.
3. Null county rows are Liberty legacy rows only under an explicit compatibility rule.
4. County filters should exist below the UI layer wherever data access or cache state can leak.
5. Cross-county or regional aggregation requires a separate future architecture.

## 9. County #1 Promotion Readiness

### Can Liberty now be formally considered County #1?

**Yes.** Liberty can be formally considered County #1 for architecture, documentation, beta framing, package normalization, registry planning, and validation baseline purposes.

### Caveats

- County #1 is a planning designation, not a runtime change.
- Liberty remains the only visible county.
- Liberty fallback remains protected.
- County #2 is not ready for visible evaluation.
- Storage namespacing remains incomplete.
- Read/write containment needs stronger validation before expansion.
- County package governance is not yet formalized.
- Source contracts are not yet complete.
- DriveTexas remains paused.
- Historical reads/UI/API remain disabled.

### Future work

1. Formal county registry contract and validation rules.
2. Liberty package manifest and package ownership metadata.
3. Storage namespace and Liberty legacy compatibility plan.
4. Read/write containment validation plan.
5. County package fixture standard.
6. Source-contract governance plan.
7. Transportation-intelligence data governance plan, without activation.

## 10. County #2 Impact Review

Liberty normalization reduces ambiguity but does not remove the blockers to County #2.

### Remaining blockers after Liberty normalization

1. No formal registry contract with lifecycle, visibility, package refs, and validation evidence.
2. No approved county selection/detection policy.
3. No second county package with boundary, awareness areas, crossings, roads, sources, QA fixtures, operations, and governance.
4. No storage namespace implementation or migration plan.
5. No read/write containment validation across reports, alerts, awareness, pulse, Route Watch, historical capture, crossings, and hazards.
6. No County #2 source contracts.
7. No rollback/deactivation validation for an additional county.
8. No support/operations readiness model for a non-Liberty county.
9. No formal fixture standard proving another county can be evaluated without Liberty leakage.
10. No transportation source governance for county-specific construction, road work, lane closure, road closure, travel advisory, or disruption feeds.

### County #2 dependency summary

County #2 remains dependent on V461-V464 at minimum. A regional candidate review should not become a visible County #2 evaluation until registry, storage, containment, fixtures, and rollback architecture have validation evidence.

## 11. Transportation Intelligence Compatibility Review

Transportation intelligence remains inactive. DriveTexas remains **Designed / Validated / Governed / Paused**.

### Compatibility benefits of Liberty normalization

Liberty normalization supports future transportation intelligence by identifying where county-specific transportation assumptions belong:

- County source identifiers.
- Corridor allowlists.
- Road segment geometry.
- Boundary validation.
- Source contracts.
- Feed freshness and failure rules.
- County-scoped cache/source-health state.
- Route Watch compatibility fixtures.
- Pause and rollback criteria.

### Future transportation domains

| Domain | Liberty normalization compatibility | Activation status |
| --- | --- | --- |
| Construction | County package can define source contracts and affected road segments later. | Not active. |
| Road Work | Road-network component can prepare normalized corridor references. | Not active. |
| Lane Closures | Future source contracts must include freshness, geometry, and county containment. | Not active. |
| Road Closures | Future closure data must not override community awareness without governance. | Not active. |
| Travel Advisories | Advisories need county eligibility, source authority, and copy rules. | Not active. |
| Transportation Disruptions | Disruption feeds need county/source status, suppression, and rollback rules. | Not active. |

### Compatibility principles

1. County activation does not activate transportation intelligence.
2. Source availability does not imply user visibility.
3. DriveTexas assumptions must remain paused until source governance, storage, containment, and rollback are separately approved.
4. Transportation records must be county-scoped by source, county, freshness, and geometry.
5. Transportation intelligence should complement awareness; it should not replace community reports without explicit product governance.

## 12. Recommended Milestone Sequence

Recommended sequence after V460:

1. **V461 County Registry Contract and Validation Plan**
   - Define registry schema, lifecycle fields, visibility rules, package refs, protected-boundary validation, and Liberty County #1 registry expectations.
2. **V462 Storage Namespace and Legacy Compatibility Plan**
   - Inventory storage keys, classify global vs county-scoped state, define Liberty legacy reads, write-forward namespaces, and rollback strategy.
3. **V463 Read/Write County Containment Validation Plan**
   - Define feature-by-feature validation for reports, alerts, awareness, Community Pulse, Route Watch, historical capture, crossings, and hazards.
4. **V464 County Package Fixture Standard**
   - Define required fixtures for boundaries, awareness areas, crossings, road segments, reports, Route Watch, storage, containment, and rollback.
5. **V465 Regional Expansion Candidate Review**
   - Review potential County #2 candidates only after registry/storage/containment/fixture plans exist; no visible evaluation by default.
6. **V466 Transportation Intelligence Data Governance Plan**
   - Define source governance for construction, road work, lane closures, road closures, travel advisories, disruptions, and DriveTexas-style feeds without activation.

This sequence preserves the architecture-first approach from V459 and prevents County #2 or transportation intelligence from becoming visible by accident.

## 13. Recommended Next Milestone

**Recommended next milestone: V461 County Registry Contract and Validation Plan.**

Rationale:

- The registry is the control point that prevents package presence from becoming accidental activation.
- Liberty County #1 needs an explicit registry entry contract before storage and containment validation can be consistently referenced.
- County #2 remains unsafe without lifecycle, visibility, validation, package refs, rollback refs, and protected-boundary checks.
- A registry contract can remain documentation-only and validation-focused while preserving all current Liberty behavior.

V461 should remain planning-only unless separately authorized. It should not add County #2, activate a county, create migrations, change UI behavior, alter reporting, alter Route Watch, expose historical systems, activate DriveTexas, or activate transportation intelligence.
