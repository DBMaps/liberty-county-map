# GRIDLY Storage Namespace and Legacy Liberty Compatibility Plan V462

## 1. Executive Summary

V462 is a documentation-only planning milestone. It defines how Gridly storage should evolve from Liberty-era storage assumptions into a county-aware storage architecture while preserving County #1 behavior, existing users, existing preferences, report compatibility, fallback behavior, and protected historical and transportation boundaries.

No production code, migrations, storage keys, localStorage behavior, Supabase behavior, reporting behavior, Route Watch behavior, awareness behavior, onboarding behavior, UI behavior, county activation, DriveTexas activation, transportation-intelligence activation, historical-read behavior, historical UI, historical API exposure, or consumer-facing history dashboard is changed by this plan.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

V462 answers: **How does Gridly become county-aware without breaking County #1?**

### Protected boundaries

The following boundaries remain closed and must be preserved by future storage plans, migration designs, audits, and containment validation:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**. Storage namespace readiness does not activate DriveTexas, transportation intelligence, historical reads, historical UI, historical API exposure, or a consumer-facing history dashboard.

### V462 conclusion

County-aware storage should be introduced as an additive governance architecture, not as a breaking key rewrite. Liberty County should remain the compatibility anchor for null, missing, legacy, and Liberty-era storage assumptions. Future counties should use explicit county namespaces, explicit registry-backed `countyId` values, isolation validation, rollback validation, and protected-boundary checks before any user-facing evaluation or activation.

The recommended next milestone is **V463 Read/Write County Containment Validation Plan**.

## 2. Storage Philosophy

### Ownership principles

Gridly storage should be governed by ownership, scope, lifecycle, and compatibility risk. A stored value should not be county-scoped merely because it is used while a county is active; it should be county-scoped only when the value is semantically different per county or could cause cross-county leakage if shared.

Core principles:

1. **Default to explicit ownership.** Every storage concept should have a named owner: global platform, device, user, county package, reporting, awareness, route, historical, QA, or source governance.
2. **Do not use Liberty as a silent universal fallback.** Liberty compatibility may protect legacy data, but future counties must not inherit Liberty data because a county value is missing.
3. **Separate identity from preference.** Device and user identifiers may remain global, while county-specific preferences should be scoped or mapped through explicit county context.
4. **Keep activation separate from persistence.** Creating a storage contract or namespace does not activate a county or expose a feature.
5. **Preserve additive migration paths.** Future migrations should copy, mirror, or alias data before any destructive change is considered.
6. **Protect read/write containment.** Reads and writes should prove county intent, unsupported-county handling, and rollback behavior before County #2.
7. **Maintain historical and transportation pause guards.** Historical and DriveTexas-related storage planning must not become a back door to historical UI, historical API exposure, DriveTexas activation, or transportation intelligence activation.

### Ownership categories

| Category | Definition | Examples | Default county behavior |
| --- | --- | --- | --- |
| Global platform | Shared app state that is not county-specific and should apply everywhere. | Feature-flag envelope, app build metadata, registry metadata cache. | Not county-scoped, but must not contain county-specific payloads unless explicitly keyed. |
| Device-scoped | State tied to a browser/device installation, independent of account identity. | Device ID, install/session diagnostics, local dismissals. | Usually global; may include county-subkeys if the value varies by county. |
| User-scoped | Account/profile state that follows the user. | Profile, notification channel consent, accessibility preferences. | Global by default; county-specific preference overlays should be scoped. |
| County-scoped | Data whose meaning is valid only within one county package or county boundary. | Awareness areas, county route watches, county source health, crossing review state. | Must include canonical `countyId`. |
| Hybrid | State with global identity plus county-specific children. | Saved places, notification preferences, map preferences, Route Watch settings. | Store global shell separately from county overlays. |
| Legacy Liberty | Existing Liberty-era keys or rows without explicit county metadata. | Legacy preferences, legacy reports, legacy route state. | Treat as Liberty-compatible only under strict compatibility rules. |
| Future governed | Storage reserved for non-active future systems. | Transportation intelligence, historical awareness reads, DriveTexas-style feed caches. | Define namespace and guardrails only; no activation. |
| QA/test-only | Fixtures and validation data not used for production user behavior. | County package fixtures, containment probes, audit snapshots. | Must be isolated from production namespaces. |

### What should remain global?

Global storage should be limited to platform-wide identity, shell settings, safe registry metadata, feature-flag declarations, and non-county-specific user/device preferences. Global storage must not contain county-local awareness areas, route results, report-source assumptions, or transportation feed state unless those items are stored under explicit county children.

### What should become county-scoped?

Storage should become county-scoped when the value depends on county boundaries, county source contracts, county package configuration, county road/crossing inventories, localized awareness copy, or county-specific report interpretation. Awareness, Route Watch, crossings, hazards, source health, report metadata overlays, and future transportation intelligence should be county-scoped.

### What should remain device-scoped?

Device ID, ephemeral session state, local opt-in/opt-out prompts, and non-account local defaults may remain device-scoped. If device state has county-specific meaning, the device record should contain explicit county children rather than relying on whichever county was most recently active.

### What should remain user-scoped?

User profile identity, communication channel permission, accessibility defaults, and account-level preferences should remain user-scoped. County-specific notification topics, saved-place interpretations, home/work routing context, and awareness subscriptions should use county overlays.

## 3. Current Storage Inventory

The following inventory classifies known storage concepts for future architecture. It does not assert that each concept currently has a single implementation or storage location; it defines the intended classification for planning.

| Storage concept | Classification | Future ownership | Rationale and compatibility note |
| --- | --- | --- | --- |
| Device ID | Global / device-scoped | Device platform | Stable install identity should not change by county. County-specific diagnostics should use child scopes. |
| User Profile | Global / user-scoped | Account/profile | Identity and account metadata remain global; county preferences should not be embedded unscoped. |
| App Settings | Hybrid | Platform preferences | Theme, accessibility, and units can be global; map and awareness defaults may need county overlays. |
| Notification Preferences | Hybrid | Notification preferences | Channel consent is user/global; county topics, alert radius, and localized categories should be county-scoped. |
| Map Preferences | Hybrid | Map experience | Base style and zoom habits can be global; layer visibility, default extent, and county-aware overlays should be county-scoped. |
| Awareness Areas | County Scoped | Awareness package | Areas depend on county boundaries, local geography, and package configuration. |
| Home Town | Hybrid / Legacy | User preferences | Existing Liberty-era value must remain compatible; future values should include county and locality context. |
| Saved Places | Hybrid | User places | Place identity may be user-scoped, but county resolution, nearby hazards, and awareness context should be county-scoped. |
| Home | Hybrid | User places / Route Watch | Address label is user-scoped; geocoded county membership and route context should be county-scoped. |
| Work | Hybrid | User places / Route Watch | Same as Home; avoid cross-county route assumptions. |
| Route Watch | County Scoped / Hybrid | Route intelligence | User intent may be global, but routes, corridors, crossings, and disruption relevance are county-specific. |
| Feedback | Hybrid | Feedback/support | General feedback can be global; county-specific bug reports, location context, and source concerns should include county metadata. |
| Historical Context | Future / Protected | Historical governance | Historical reads and UI remain disabled; storage planning only may define guarded future scopes. |
| Report Metadata | County Scoped / Legacy | Reporting | New report metadata should include `countyId`; legacy missing-county rows remain Liberty-compatible under policy. |
| Crossing Review State | County Scoped | Crossings/package QA | Crossings are package-owned and county-local. |
| Source Health | County Scoped / Future | Source governance | Source status varies by county/source contract; DriveTexas remains paused. |
| QA Fixtures | Future / QA-only | QA validation | Must be isolated from production keys and may include county package fixtures. |
| Feature Flags | Global / Hybrid | Release governance | Flag definitions are global; county allowlists, lifecycle gates, and visibility constraints should be county-keyed. |
| County Registry Cache | Global with county children | Registry governance | Registry shell is global; entries are keyed by canonical `countyId`. |
| County Package References | County Scoped | Package governance | Package references must be immutable/versioned per county. |
| Onboarding Progress | Hybrid / Legacy | Onboarding | General completion is global; county selection or detection should be explicit and non-activating until authorized. |
| Alert Card Dismissals | Hybrid | Alert experience | Generic dismissals can be device-scoped; county-local incident dismissals should include county/report identifiers. |
| Community Pulse State | County Scoped / Legacy | Awareness/reporting | Pulse calculations are county-local; legacy Liberty state should remain readable without becoming generic fallback. |

## 4. Storage Namespace Contract

### Namespace goals

Future namespaces should be readable, deterministic, collision-resistant, versioned, and compatible with registry validation. A namespace should make it obvious whether stored data is global, county-scoped, device-scoped, user-scoped, QA-only, or legacy-compatible.

### Recommended namespace patterns

| Pattern | Readiness | Intended use | Notes |
| --- | --- | --- | --- |
| `gridly:<domain>:<version>` | Required | Global platform or domain-level storage. | Use only for data that is truly global or a registry shell. |
| `gridly:<domain>:<version>:<countyId>` | Required before County #2 | County-scoped data. | `countyId` must match registry canonical ID. |
| `gridly:<domain>:<version>:<countyId>:<subscope>` | Required where needed | County child scopes such as route, crossing, source, or awareness subsets. | `subscope` should be from an allowed list per domain. |
| `gridly:user:<version>:<userIdHash>` | Optional | User-scoped global preferences where needed. | Avoid storing raw identifiers when not necessary. |
| `gridly:user:<version>:<userIdHash>:<countyId>` | Future | User preference overlays per county. | Useful for notifications, saved places, and county-local settings. |
| `gridly:device:<version>:<deviceIdHash>` | Optional | Device-scoped global state. | Should not encode county-specific payloads without child county scope. |
| `gridly:device:<version>:<deviceIdHash>:<countyId>` | Future | Device-local county overlays. | Useful for local dismissals and county-local cache state. |
| `gridly:qa:<domain>:<version>:<countyId>` | Future / QA-only | Test fixtures, audit probes, and validation snapshots. | Must be excluded from production user behavior. |
| `legacy:<existingKey>` | Legacy | Existing Liberty-era keys. | Conceptual label only; do not rename keys in V462. |

### Required conventions

1. **Canonical county ID.** Future county-scoped namespaces should use the registry `countyId`, recommended in prior planning as a lowercase slug such as `liberty-tx`.
2. **Version segment.** Every new namespace should include a version segment so schema evolution can be additive.
3. **Domain segment.** Domains should be functional ownership areas such as `preferences`, `awareness`, `reports`, `routes`, `crossings`, `source-health`, `registry`, `packages`, `transportation`, `history`, or `qa`.
4. **No implicit county.** County-scoped namespaces should not infer county from UI state, map viewport, most recent report, or default fallback.
5. **Legacy isolation.** Legacy keys may be read through compatibility adapters in future work, but should not be treated as canonical namespaces for new counties.
6. **Protected namespace guards.** `history`, `transportation`, and `drivetexas` domains must preserve disabled/paused boundaries unless separately authorized.

### Optional conventions

- Hash user/device identifiers when the raw value is not needed.
- Store global shells separately from county children for hybrid concepts.
- Include `schemaVersion`, `createdAt`, `updatedAt`, `countyId`, and `source` metadata where appropriate.
- Include `compatibilityMode: "legacy-liberty"` only for records that intentionally preserve legacy Liberty assumptions.

### Future conventions

- Namespace manifest files can define allowed domains, versions, county scopes, and subscope values.
- County packages can declare storage policy references consumed by future audits.
- Migration manifests can declare source keys, target namespaces, copy strategy, rollback strategy, and validation evidence.

## 5. Legacy Liberty Compatibility Policy

### Compatibility purpose

Liberty County is County #1 and the compatibility anchor for existing users. Legacy compatibility must preserve behavior without making Liberty the hidden default for all future counties.

### Policy principles

1. **Preserve existing Liberty behavior.** Existing preferences, reports, fallback behavior, awareness behavior, and route state should continue to work for County #1.
2. **Treat missing county metadata as legacy-compatible, not future-compatible.** Missing `countyId` may map to Liberty only when the record is known to be Liberty-era or otherwise passes explicit compatibility criteria.
3. **Do not overwrite legacy keys during planning.** V462 creates no migrations and changes no storage keys.
4. **Prefer read adapters before write rewrites.** Future compatibility should first define safe reads of legacy data, then additive writes to county-aware namespaces.
5. **No generic fallback for unsupported counties.** If a future county is invalid, missing, paused, or unsupported, the system should fail closed or quarantine rather than fall back to Liberty behavior.
6. **Keep legacy historical state protected.** Legacy historical capture or context must not enable historical reads, UI, API exposure, or dashboards.

### Compatibility review areas

| Area | Compatibility policy |
| --- | --- |
| Missing county metadata | May be interpreted as Liberty-era only under explicit compatibility gates; should not authorize future county reads. |
| Legacy report rows | Preserve report compatibility; future writes should include `countyId` once authorized. |
| Legacy storage keys | Continue to read where currently required; future namespaces should be additive and non-destructive. |
| Legacy preferences | Preserve existing user/device settings; future county overlays should not erase or reinterpret them unexpectedly. |
| Legacy awareness behavior | Liberty awareness behavior remains stable; future county awareness requires explicit package and namespace validation. |
| Legacy route state | Existing Route Watch state remains Liberty-compatible; future county route state must not consume Liberty route assumptions. |
| Legacy historical state | Historical protected boundaries remain closed; no historical UI or read exposure. |
| Legacy fallback behavior | Liberty fallback may protect existing County #1 flows; it must be documented, bounded, and audited before County #2. |

## 6. Migration Architecture

V462 does not create migrations. This section defines a future architecture for migration planning only.

### Forward migration concepts

Future forward migrations should be additive, staged, auditable, and reversible. A safe migration sequence would be:

1. Inventory existing keys/rows and classify legacy versus county-aware state.
2. Define target namespaces and schemas without changing runtime behavior.
3. Add read-only audit validation in a future milestone.
4. Introduce dual-read compatibility where legacy Liberty reads remain primary or equivalent.
5. Introduce dual-write only after containment validation and rollback planning.
6. Promote county-aware reads only after evidence proves parity for Liberty and isolation for future counties.
7. Retire legacy reads only through a separately authorized deprecation milestone.

### Backward compatibility concepts

Backward compatibility should support existing Liberty users if a future county-aware release is rolled back. This requires:

- Non-destructive copies instead of destructive renames.
- Legacy key preservation until deprecation is separately approved.
- Idempotent migration manifests.
- Versioned target namespaces.
- Compatibility read adapters for Liberty/null records.
- Clear precedence rules when both legacy and county-aware records exist.

### Rollback concepts

Rollback design should assume a county-aware deployment can be paused or reverted without data loss. Rollback should preserve:

- Legacy Liberty reads.
- Existing preferences and saved places.
- Report compatibility.
- Route Watch continuity for Liberty.
- Protected historical and DriveTexas boundaries.
- Quarantine of invalid future-county records.

### Null, missing, and invalid county handling

| Case | Future handling principle |
| --- | --- |
| Null county | Treat as legacy-compatible only when source and context prove Liberty-era behavior; otherwise quarantine or request explicit context. |
| Missing county | Same as null; never use missing county as generic Liberty fallback for future county flows. |
| Invalid county | Fail closed, ignore for public behavior, log/audit, and avoid writing into Liberty namespaces. |
| Unsupported county | Do not activate UI, Route Watch, awareness, reporting, or transportation behavior; preserve global preferences only. |
| Paused county | Preserve stored data but block active reads/writes except governed rollback or support operations. |

## 7. County Storage Separation Strategy

### Separation model

Future storage should use a three-layer model:

1. **Global layer:** platform identity, account/device shell, registry shell, feature-flag definitions, and non-county preferences.
2. **County layer:** county package references, awareness configuration, county-local report metadata, crossings, hazards, source health, Route Watch projections, and future transportation data.
3. **Hybrid overlay layer:** user/device preferences with county-specific children, such as saved places, notification topics, map overlays, and local dismissals.

### County A / County B isolation

County A data and County B data should never share a county namespace, cache bucket, report query filter, route projection, awareness area, transportation feed state, or source-health record unless a separately governed regional feature explicitly defines cross-county behavior. Cross-county features should have their own domain and should not be simulated by reading two county-local stores without policy.

### Shared/global data

Shared data should be restricted to truly global concepts. Global state may point to county-specific children but should not embed county-specific operational data without explicit county keys.

### Domain separation principles

| Domain | Separation principle |
| --- | --- |
| Route data | Route watches, corridors, crossings, and disruption relevance should be scoped by county and route identity. |
| Awareness data | Awareness areas and localized copy should be package-owned and county-scoped. |
| Historical data | Future historical storage must remain protected and non-exposed; county metadata should be explicit before any future read enablement. |
| Feedback data | County-specific feedback should include county context; general support feedback can remain global. |
| Saved places | Place labels can be user-scoped; county membership and route implications should be county-scoped overlays. |
| User preferences | Account-level preferences remain global; county-specific alert topics and map layers should be overlays. |
| Source health | County/source-specific; no DriveTexas activation. |
| Feature flags | Global definitions with county lifecycle/visibility constraints. |

## 8. Storage Risk Assessment

| Risk | Severity | Why it matters | Mitigation direction |
| --- | --- | --- | --- |
| Cross-county leakage | Critical | County A reports, routes, or alerts could appear in County B. | Require explicit `countyId`, query filters, namespace audits, and containment validation. |
| Namespace collisions | High | Different domains or counties could overwrite each other. | Use versioned domain/county namespaces and allowed domain registry. |
| Legacy overwrite | Critical | Existing Liberty preferences or route state could be lost. | Use additive migrations, no destructive renames, and rollback tests. |
| Invalid county references | High | Bad IDs could create orphaned or misrouted data. | Validate against registry; fail closed and quarantine. |
| County switching issues | High | User context may retain stale route, awareness, or map state. | Reset or rehydrate county-scoped overlays on county context change. |
| Route contamination | Critical | Route Watch could use wrong crossings or disruptions. | County-scope route projections and validate package references. |
| Awareness contamination | Critical | Localized alerts could show for the wrong county. | County-scope awareness areas, copy, and report queries. |
| Historical contamination | Critical | Historical data could become visible or mixed across counties. | Preserve disabled historical reads/UI/API/dashboard boundaries. |
| Preference contamination | Medium | Map or notification settings could feel wrong after county switch. | Split global preferences from county overlays. |
| Liberty fallback overreach | Critical | Future counties could silently receive Liberty behavior. | Restrict missing/null county compatibility to legacy Liberty criteria. |
| Rollback data ambiguity | High | Rollback might not know which store is authoritative. | Define precedence, dual-read windows, and rollback manifests. |
| QA fixture bleed | High | Test data could affect production behavior. | Use QA-only namespaces and environment guards. |
| Transportation premature activation | Critical | Feed storage could be mistaken for DriveTexas activation. | Keep transportation namespaces future/paused with explicit activation blockers. |

## 9. Read/Write Compatibility Review

| System | Current compatibility posture | Future storage implication |
| --- | --- | --- |
| Reporting | Liberty-era reports may lack county metadata. | Future writes should include `countyId`; legacy reads should remain Liberty-compatible under bounded policy. |
| Awareness | Liberty awareness behavior must remain unchanged. | Future awareness areas, copy, and alert relevance must be county-scoped by package. |
| Community Pulse | Pulse should remain County #1 compatible. | Future pulse calculations require county filters and no cross-county aggregation by default. |
| Alert Cards | Existing alert card behavior remains protected. | County-local dismissals and relevance state should include county/report IDs. |
| Route Watch | Existing Liberty route state must remain stable. | Future route watches need county-specific corridors, crossings, and source relevance. |
| Historical Capture | Capture boundaries remain governed and non-exposing. | Future storage should include county metadata where applicable but must not enable reads/UI. |
| Historical Awareness | Protected and not consumer-facing. | Any future namespace is dormant until historical reads/UI/API/dashboard boundaries change by authorization. |
| Crossings | Liberty crossings remain County #1 package assumptions. | Future crossing review and state must be package-owned and county-scoped. |
| Hazards | Hazard interpretation is county-local. | Future hazard metadata should include county and source context. |
| County Registry | Registry is governance, not activation. | Registry can validate `countyId`, lifecycle, visibility, package refs, and storage policy refs. |
| County Packages | Package references remain planning/governance artifacts until activated. | Package manifests should declare storage ownership and namespace expectations before County #2. |

## 10. County #1 Storage Mapping

Liberty County should be mapped into the future storage model as County #1 without changing behavior.

Recommended canonical identity for planning: `liberty-tx`.

| Concept | County #1 mapping | Classification |
| --- | --- | --- |
| Device ID | Remains global/device-scoped. | Already Compatible |
| User Profile | Remains global/user-scoped. | Already Compatible |
| App Settings | Global shell remains; future county overlays may be added. | Partially Compatible |
| Notification Preferences | Existing preferences remain; county topics need future overlay planning. | Partially Compatible |
| Map Preferences | Existing settings remain; county layer state needs future overlay planning. | Partially Compatible |
| Awareness Areas | Liberty areas become package-owned under `liberty-tx` in future design. | Requires Future Migration Planning |
| Home Town | Existing value remains Liberty-compatible; future county metadata should be additive. | Partially Compatible |
| Saved Places | Existing saved places remain; county membership overlays should be additive. | Requires Future Migration Planning |
| Home | Existing behavior remains; future geocoded county context should be additive. | Requires Future Migration Planning |
| Work | Existing behavior remains; future geocoded county context should be additive. | Requires Future Migration Planning |
| Route Watch | Existing Liberty route state remains; future route namespace should be `liberty-tx` scoped. | Requires Future Migration Planning |
| Feedback | Existing feedback remains; county metadata can be additive for future records. | Partially Compatible |
| Historical Context | Protected boundaries remain disabled. | Not Applicable |
| Report Metadata | Legacy missing-county rows remain Liberty-compatible; future rows should include `liberty-tx`. | Requires Future Migration Planning |
| Crossing Review State | Liberty crossing state should become package/county-scoped in future. | Requires Future Migration Planning |
| Source Health | Liberty source health planning should be county-scoped; DriveTexas remains paused. | Future |
| QA Fixtures | Future Liberty fixtures should validate namespace parity and legacy compatibility. | Future |
| Feature Flags | Global definitions remain; county gates should use `liberty-tx` where applicable. | Partially Compatible |

## 11. County #2 Storage Readiness

County #2 is not ready for visible evaluation in V462. Storage readiness must be proven before any County #2 representation, pilot, activation, onboarding exposure, reporting writes, awareness rendering, Route Watch behavior, transportation feed use, or historical exposure.

### Required readiness criteria

1. **Namespace validation:** All county-scoped domains have approved namespace patterns and canonical `countyId` validation.
2. **Isolation validation:** County #2 test data cannot read, write, overwrite, or display Liberty data.
3. **Compatibility validation:** Liberty legacy/null/missing-county behavior remains unchanged.
4. **Rollback validation:** County #2 storage can be disabled or ignored without damaging Liberty or global state.
5. **Containment validation:** Unsupported, invalid, paused, and missing county contexts fail closed or quarantine.
6. **Fixture validation:** County #2 package fixtures prove inside/outside boundaries, awareness areas, crossings, route cases, report cases, and storage scopes.
7. **Registry validation:** County #2 has lifecycle, visibility, package references, storage policy, containment policy, and rollback policy before any exposure.
8. **Protected-boundary validation:** Historical reads/UI/API/dashboard remain disabled and DriveTexas remains paused.
9. **No Liberty fallback leakage:** County #2 cannot inherit Liberty awareness, routes, reports, source health, or preferences except global user/device settings explicitly classified as global.
10. **Operational evidence:** Audit outputs and test evidence are attached to the county package and registry validation bundle.

## 12. Transportation Intelligence Compatibility

Transportation intelligence remains future-facing and inactive in V462. This section reviews storage implications only.

### Future compatible domains

| Future capability | Storage implication | V462 constraint |
| --- | --- | --- |
| Construction | County/source-scoped event storage with lifecycle and expiration metadata. | Planning only; no activation. |
| Road Work | County-scoped disruptions linked to road segments and source contracts. | Planning only; no activation. |
| Lane Closures | County-scoped, time-bounded, source-attributed records. | Planning only; no activation. |
| Road Closures | County-scoped closure records with severity, geometry, and validity windows. | Planning only; no activation. |
| Travel Advisories | County or regional advisory namespaces with explicit source governance. | Planning only; no activation. |
| Transportation Disruptions | County-scoped normalized disruption model; may later support regional aggregation. | Planning only; no activation. |
| DriveTexas-style feeds | Feed-specific county/source identifiers, pause status, ingestion audit, and rollback state. | DriveTexas remains paused. |

### Transportation storage principles

1. Transportation feed storage must be county-scoped or explicitly regional; it must not be global by accident.
2. Source identifiers should be governed by county package and registry metadata.
3. Feed pause status should be explicit per feed and per county where applicable.
4. Cached feed data should not imply user-facing activation.
5. Transportation namespaces should be excluded from public reads until a future authorized milestone changes activation status.
6. DriveTexas storage planning must preserve `DriveTexasPaused: true`.

## 13. Future Storage Audit Design

V462 does not implement an audit helper. A future helper such as `window.gridlyStorageNamespaceAudit?.()` should be read-only, side-effect-free, safe for internal validation, and explicit that passing the audit does not activate any county or feature.

### Proposed helper shape

```text
window.gridlyStorageNamespaceAudit?.({
  countyId?: string,
  includeLegacy?: boolean,
  includeProtectedBoundaries?: boolean,
  includeQaNamespaces?: boolean,
  domains?: string[]
})
```

### Inputs

| Input | Purpose |
| --- | --- |
| `countyId` | Optional county focus; if omitted, audit global and all known county namespaces. |
| `includeLegacy` | Include legacy Liberty keys and compatibility classification. |
| `includeProtectedBoundaries` | Verify historical and DriveTexas guards. |
| `includeQaNamespaces` | Include QA-only namespace checks when running in validation contexts. |
| `domains` | Restrict audit to domains such as preferences, awareness, routes, reports, history, or transportation. |

### Outputs

| Output field | Purpose |
| --- | --- |
| `status` | `pass`, `warn`, or `fail`. |
| `countyId` | County audited or `all`. |
| `globalNamespaces` | Global keys/domains discovered and classified. |
| `countyNamespaces` | County-scoped keys/domains discovered and validated. |
| `legacyLibertyNamespaces` | Legacy keys detected and compatibility assessment. |
| `collisions` | Namespace or domain collisions. |
| `leakageFindings` | Potential cross-county reads/writes or mixed data. |
| `protectedBoundaryFindings` | Historical and DriveTexas guard status. |
| `unsupportedCountyFindings` | Invalid, missing, paused, or unknown county behavior. |
| `recommendations` | Non-mutating remediation guidance. |

### Validation checks

- Namespace pattern validity.
- Domain allowlist validity.
- Version segment presence.
- County ID registry match.
- Global-versus-county classification.
- Legacy Liberty compatibility classification.
- Hybrid overlay separation.
- Duplicate/collision detection.
- QA namespace isolation.

### County isolation checks

- No County A data in County B namespace.
- No County B read fallback to Liberty namespace.
- No global storage embedding county-local route, awareness, or source-health payloads.
- No stale county context after county switch.
- No invalid county writes into Liberty namespaces.

### Legacy compatibility checks

- Existing Liberty legacy keys remain present and readable where expected.
- Missing/null county records are classified as Liberty-compatible only under explicit rules.
- Legacy route, awareness, preference, and report behavior is not overwritten.
- Dual-read or migration candidates are reported but not modified.

### Protected-boundary checks

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- No active transportation-intelligence namespace reads for consumer behavior.

## 14. Recommended Milestone Sequence

Recommended sequence after V462:

1. **V463 Read/Write County Containment Validation Plan**
   - Define concrete validation for county-scoped reads, writes, null/missing/invalid county handling, Liberty compatibility, unsupported-county quarantine, and rollback behavior.
2. **V464 County Package Fixture Standard**
   - Standardize boundary, inside/outside, awareness, crossing, road segment, report, route, storage, and protected-boundary fixtures for Liberty and future counties.
3. **V466 Transportation Intelligence Data Governance Plan**
   - Define transportation source contracts, feed pause policy, DriveTexas governance, source identifiers, county/source storage ownership, and non-activation constraints.
4. **V465 Regional Expansion Candidate Review**
   - Review regional candidates only after registry, storage namespace, containment, fixtures, and transportation governance standards are defined. This remains a review milestone, not County #2 activation.
5. **Future Storage Namespace Audit Design / Prototype Authorization**
   - If needed after containment and fixtures, authorize a read-only audit helper design or prototype with no production behavior changes.

This sequence keeps County #2 candidate review behind the safety contracts that prevent Liberty fallback leakage, namespace collisions, cross-county contamination, and premature transportation or historical exposure.

## 15. Recommended Next Milestone

The recommended next milestone is **V463 Read/Write County Containment Validation Plan**.

V463 should answer:

1. How will future reads prove county intent before returning county-scoped data?
2. How will future writes attach valid `countyId` metadata and reject invalid county contexts?
3. How will null, missing, invalid, paused, and unsupported county states behave without generic Liberty fallback?
4. How will Liberty legacy compatibility be validated before County #2?
5. What evidence proves that reports, awareness, Route Watch, crossings, hazards, registry, packages, history, and transportation domains remain contained?
6. What rollback tests prove county-aware storage can be disabled without breaking County #1?

V463 should remain planning-only unless separately authorized. It should preserve all protected boundaries and should not activate County #2, DriveTexas, transportation intelligence, historical reads, historical UI, historical API exposure, or consumer history dashboards.
