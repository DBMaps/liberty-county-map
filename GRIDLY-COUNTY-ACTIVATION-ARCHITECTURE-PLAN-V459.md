# GRIDLY County Activation Architecture Plan V459

## 1. Executive Summary

V459 is a documentation-only architecture milestone for answering the question: **What must exist before County #2 can be activated safely?** It does not add a county, modify Liberty County behavior, implement county selection, create onboarding flows, change Route Watch, change reporting, change historical systems, change awareness systems, create migrations, change Supabase, activate DriveTexas, or activate transportation intelligence.

The platform mission remains:

- **Know Before You Go**
- **Awareness Platform First**
- **Route Intelligence Second**

The corrected platform framing from V457 remains the operating model:

```text
Gridly Platform
  -> County Context
  -> Localized Awareness Experience
  -> Transportation Intelligence
```

V458 established that Liberty County is ready to be treated as **County #1**, but County #2 is not ready for visible evaluation. V459 defines the missing activation architecture: lifecycle, package contract, registry governance, county selection policy, storage ownership, read/write containment, rollback/deactivation, County #2 readiness criteria, transportation-intelligence compatibility, and milestone sequencing.

Protected boundaries remain preserved:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**.

### V459 conclusion

County #2 must not be evaluated visibly until Gridly has all of the following architecture in place:

1. A governed county activation lifecycle with explicit promotion, pause, rollback, and retirement states.
2. A complete county package contract that separates required, optional, and future components.
3. A county registry governance model with ownership, review, validation, and launch authority.
4. A county selection policy that defines GPS detection, user choice, manual override, invalid county behavior, missing county behavior, travel behavior, and future multi-county behavior.
5. A storage namespace policy that separates global platform state from county-scoped state.
6. Read/write containment rules for reports, alerts, historical capture, Route Watch, awareness, Community Pulse, and transportation intelligence.
7. A rollback/deactivation model that can safely pause or remove a county without corrupting Liberty County behavior.
8. County Activation, County Validation, and County Launch checklists.
9. Compatibility hooks for future transportation-intelligence sources without activating DriveTexas or any transportation feed.

## 2. County Activation Lifecycle

### Recommended lifecycle states

| State | Meaning | User visibility | Write behavior | Read behavior | Allowed next states |
| --- | --- | --- | --- | --- | --- |
| `planned` | Candidate county has been identified for future research. No complete package exists. | None | None | None | `prepared`, `retired` |
| `prepared` | Initial county package exists, including minimum metadata, boundary, and source inventory. | None | Internal validation only | Internal validation only | `validated`, `paused`, `retired` |
| `validated` | Package has passed static validation, source validation, containment review, and package completeness review. | None | Internal validation only | Internal validation only | `pilot_ready`, `paused`, `retired` |
| `pilot_ready` | County is safe for controlled internal or limited pilot evaluation under explicit activation controls. | Controlled only | County-scoped pilot writes only if authorized by a future implementation milestone | County-scoped pilot reads only if authorized by a future implementation milestone | `activated`, `paused`, `retired` |
| `activated` | County is live and visible under approved selection/detection behavior. | Visible | County-scoped production writes | County-scoped production reads | `paused`, `retired` |
| `paused` | County is temporarily disabled because of feed, data, containment, legal, operational, or quality concerns. | Hidden or fallback-only | No new county-scoped production writes except audit/diagnostic records if authorized | Existing county-scoped reads hidden from consumer surfaces unless explicitly approved for recovery | `prepared`, `validated`, `pilot_ready`, `activated`, `retired` |
| `retired` | County is permanently removed from active support. | Hidden | No new writes | Historical/admin-only access only if separately authorized | None |

### State definitions

#### `planned`

A county may be marked `planned` when it is a strategic expansion candidate, but it has no activation rights. A planned county may have a name, state, candidate rationale, owner, and discovery notes. It must not be selectable, detectable, or visible to users.

#### `prepared`

A county may be promoted to `prepared` only after a draft county package exists. The package does not need to be launch-complete, but it must include enough information to validate boundaries, source authority, awareness-area strategy, and operational ownership. Prepared counties remain non-visible.

#### `validated`

A county may be promoted to `validated` only after the package passes static validation, source-contract review, storage-scoping review, read/write containment design review, and rollback review. Validated means the county is architecturally coherent; it does not mean the county is live.

#### `pilot_ready`

A county may be promoted to `pilot_ready` only after a future implementation milestone has proven county selection, storage namespacing, read/write filters, report metadata, awareness containment, and rollback behavior. Pilot readiness allows controlled evaluation only. It does not authorize broad consumer launch by itself.

#### `activated`

A county may be promoted to `activated` only after launch approval confirms production operational support, feed health, QA fixtures, source monitoring, support messaging, fallback behavior, and containment audits. Activated counties are visible only through the approved county selection policy.

#### `paused`

A county may be paused from any non-retired state when data quality, source reliability, containment, governance, support, legal, or operational safety is uncertain. Pausing must be reversible when possible and must not require changing Liberty County behavior.

#### `retired`

A county may be retired when Gridly decides it will no longer support that county. Retirement must preserve auditability of county-scoped records if retention requirements exist, but retired counties must not appear in consumer selection, detection, alerts, awareness, Route Watch, or transportation-intelligence surfaces.

### Transition rules

1. **No direct planned-to-activated transition.** A county must pass through package preparation, validation, pilot readiness, and launch approval.
2. **No activation without a county package.** Registry metadata alone is insufficient.
3. **No activation without read/write containment proof.** Writes and reads must be county-scoped by design and by validation.
4. **No activation without rollback.** Every activated county must have a tested pause/deactivation path.
5. **No activation by data presence alone.** Adding files, registry entries, source contracts, or fixtures must not imply activation.
6. **No visible County #2 evaluation before governance approval.** Internal files may exist only when clearly marked non-visible.
7. **No DriveTexas or transportation-intelligence activation through county activation.** County activation may make future compatibility possible, but transportation sources require separate authorization.
8. **Liberty fallback remains protected.** Any transition must preserve existing Liberty County #1 behavior until a future milestone explicitly changes it.

### Lifecycle ownership

- Product/platform owner: approves lifecycle state changes.
- Data/package owner: certifies county package completeness.
- Engineering owner: certifies implementation containment before future activation work.
- QA owner: certifies fixture coverage, validation results, and rollback drills.
- Operations/support owner: certifies launch readiness, user messaging, and incident process.

## 3. County Package Contract

A county package is the complete governed bundle of metadata, geospatial inputs, awareness configuration, source contracts, QA fixtures, and operational rules required to safely evaluate or activate a county.

### Package structure

Recommended future logical structure:

```text
county-package
  metadata
  geography
  awareness
  crossings
  road-network
  source-contracts
  route-watch
  reporting
  historical-context
  qa-fixtures
  operations
  governance
```

This structure is architectural only in V459. No files, folders, migrations, or code paths are implemented by this plan.

### Required components before `prepared`

| Component | Required fields | Purpose |
| --- | --- | --- |
| County ID | Stable slug such as `county-name-state`, uniqueness, naming owner | Provides canonical county identity. |
| County name | Human-readable county name | Supports display, audit, and support operations. |
| State | State code and state name | Prevents ambiguous county names. |
| Default city / locality | Default city or primary locality label | Supports fallback copy and first-run awareness context. |
| Boundary | County polygon, source, version, validation date | Defines containment for GPS, reports, alerts, and awareness. |
| Package owner | Data owner, engineering owner, product owner | Establishes accountability. |
| Lifecycle state | One of the governed states | Prevents accidental activation. |
| Source inventory | List of candidate data sources and source authority | Starts governance review. |
| Risk notes | Known gaps, licensing concerns, operational concerns | Prevents silent promotion. |

### Required components before `validated`

| Component | Required fields | Purpose |
| --- | --- | --- |
| Awareness areas | Area ids, names, boundaries or rules, default area, display labels | Prevents Liberty awareness copy or towns from bleeding into another county. |
| Crossings | Rail crossing source, fallback file strategy, override policy, label-review owner | Supports crossing awareness while preserving county boundaries. |
| Road segments | Road segment source, normalization rules, corridor list, geometry version | Supports hazard localization and future Route Watch compatibility. |
| Crossing overrides | Review decisions, override reason, source, owner, expiration/review date if applicable | Makes local corrections auditable. |
| Source contracts | Authority, licensing/terms, freshness, update cadence, failure mode, pause criteria | Prevents ungoverned source activation. |
| QA fixtures | Boundary cases, inside/outside points, crossing samples, road-name samples, report samples | Proves county package can be validated. |
| Operational metadata | Support region, launch contact, incident escalation, data review cadence | Makes launch supportable. |
| Storage classification | County-scoped keys and global keys affecting this county | Prevents preference and report leakage. |
| Read/write containment plan | Feature-by-feature containment assertions | Required before pilot readiness. |
| Rollback/deactivation plan | Pause mechanism, fallback state, user messaging, data retention | Required before pilot readiness. |

### Required components before `pilot_ready`

| Component | Required fields | Purpose |
| --- | --- | --- |
| Selection/detection policy fit | GPS behavior, user selection behavior, invalid county behavior, missing county behavior | Ensures users enter the county context safely. |
| County-scoped write proof | Report, feedback, Route Watch, awareness, and capture metadata proof if implemented later | Prevents cross-county writes. |
| County-scoped read proof | Query/filter proof for consumer-visible surfaces | Prevents cross-county reads. |
| Legacy/null policy | How rows with missing county metadata are interpreted | Preserves Liberty compatibility and avoids County #2 leakage. |
| Pilot monitoring | Metrics, logs, source health, containment alarms | Supports controlled pilot. |
| Pilot rollback drill | Tested pause and fallback behavior | Ensures pilot can be stopped safely. |

### Optional components

Optional components may enrich a county package but must not become implicit activation signals:

- Additional localized place names and neighborhoods.
- School zones, civic zones, or public-safety districts.
- Special-event venues.
- Emergency-management contacts.
- Alternate map centers or seasonal map settings.
- Optional source adapters that remain disabled until separately approved.
- Internal analyst notes.
- County-specific support FAQ content.

### Future components

Future components should be anticipated but remain inactive unless separately authorized:

- Construction feeds.
- Road work feeds.
- Lane-closure feeds.
- Road-closure feeds.
- Travel-advisory feeds.
- Transportation-disruption feeds.
- DriveTexas-style source adapters.
- Historical trend summaries.
- Public historical dashboards.
- Cross-county travel corridors.
- Regional aggregation packages.

## 4. County Registry Governance

### Registry purpose

The county registry should be the operational index of county availability, lifecycle state, package location, display metadata, source status, and activation authority. It should not contain every package detail, but it should point to governed package artifacts and expose only the metadata needed by runtime systems.

### Registry ownership

Recommended ownership model:

| Role | Responsibility |
| --- | --- |
| Platform owner | Owns registry policy, lifecycle model, and activation authority. |
| County package owner | Owns package completeness and source updates. |
| Engineering owner | Owns runtime interpretation, validation tooling, and containment checks. |
| QA owner | Owns fixtures and validation evidence. |
| Operations owner | Owns support readiness, pause decisions, and incident handling. |
| Governance reviewer | Confirms protected boundaries and non-goals remain intact. |

### Registry structure

Each registry entry should include:

| Field | Required? | Notes |
| --- | --- | --- |
| `countyId` | Required | Stable canonical id. |
| `displayName` | Required | User-facing county name only when visible. |
| `stateCode` | Required | Two-letter state code. |
| `stateName` | Required | Human-readable state name. |
| `lifecycleState` | Required | `planned`, `prepared`, `validated`, `pilot_ready`, `activated`, `paused`, or `retired`. |
| `visibility` | Required | `hidden`, `internal`, `pilot`, or `public`. |
| `defaultCity` | Required before prepared | Fallback locality label. |
| `boundaryRef` | Required before prepared | Pointer to governed boundary artifact. |
| `packageRef` | Required before prepared | Pointer to package manifest or package folder. |
| `sourceStatus` | Required before validated | Summary of source readiness and pause state. |
| `storagePolicyRef` | Required before validated | Pointer to county storage classification. |
| `containmentPolicyRef` | Required before validated | Pointer to read/write containment review. |
| `rollbackPolicyRef` | Required before validated | Pointer to deactivation plan. |
| `validationEvidenceRef` | Required before pilot ready | Pointer to QA output. |
| `activationApprovalRef` | Required before activated | Pointer to launch approval. |
| `deactivationReason` | Required when paused/retired | Explains operational state. |

### County metadata requirements

Operational county metadata must distinguish:

1. **Identity metadata** — county id, state, display name.
2. **Geographic metadata** — boundary, centroid, default map view, area definitions.
3. **Awareness metadata** — area names, fallback copy, localization labels.
4. **Source metadata** — source authority, cadence, licensing, failure behavior.
5. **Storage metadata** — namespace rules and legacy handling.
6. **Runtime metadata** — activation state, visibility state, feature eligibility.
7. **Governance metadata** — owner, approval, validation, rollback, review dates.

### Activation prerequisites

A registry entry may become `activated` only when:

- Lifecycle state is at least `pilot_ready`.
- County package is complete and validated.
- Selection/detection behavior is approved.
- County-scoped read and write containment is proven.
- Storage namespace policy is implemented and validated by a future implementation milestone.
- Legacy/null county handling is defined.
- Rollback/deactivation path is tested.
- Source contracts are approved.
- Support and operations are ready.
- Protected boundaries remain unchanged unless a separate future milestone explicitly changes them.

### Validation requirements

Validation should include:

- Registry schema validation.
- Unique county id validation.
- Lifecycle transition validation.
- Boundary geometry validation.
- Awareness-area coverage validation.
- Inside/outside county point validation.
- Report metadata validation.
- Read filter validation.
- Storage namespace validation.
- Source contract validation.
- Fixture parity validation.
- Pause/rollback validation.

## 5. County Selection Policy

V459 does not implement county selection. This section defines the architecture that should exist before any future implementation.

### Selection principles

1. **County context must be explicit.** Every user-visible awareness surface should know which county it represents.
2. **Detection must not override trusted user intent without explanation.** GPS can suggest, but the product should avoid silently moving users across county contexts.
3. **Unsupported counties must fail safely.** Users outside activated counties should see clear unsupported-area behavior, not Liberty data misrepresented as local data.
4. **Travel is normal.** The platform should handle users who live in one county, travel through another, and have saved places elsewhere.
5. **Future multi-county support should not be blocked.** Initial implementation may be single-active-county, but state and package design should not prevent regional expansion.

### GPS detection

Recommended architecture:

- GPS detection may identify the user's current county by point-in-polygon against activated county boundaries.
- GPS detection should distinguish:
  - Inside active/activated county.
  - Inside known but non-visible county.
  - Outside all known counties.
  - Location unavailable.
  - Ambiguous boundary result.
- GPS detection should never activate a county whose lifecycle state is not visible for the current audience.
- GPS detection should not activate DriveTexas, transportation intelligence, historical reads, or historical UI.

### User selection

User selection should allow a user to choose from activated/visible counties only. Selection should be stored according to the storage policy:

- Preferred county may be global user preference.
- County-specific awareness areas and saved places should be county-scoped.
- Last active county may be global or device-scoped with validation against the registry.

### Manual override

Manual override should exist for testing/support only until user-facing multi-county selection is approved. Manual overrides must:

- Validate against the registry.
- Respect lifecycle visibility.
- Be clearly identified as override behavior.
- Never expose paused, retired, planned, prepared, or validated counties to general consumers.
- Never bypass storage or read/write containment.

### Missing county behavior

A missing county context should resolve as follows:

1. If the platform is in current Liberty-only mode, preserve Liberty County #1 fallback.
2. If multi-county mode is later approved, use the selected preferred county when valid.
3. If no selected preferred county exists, use GPS suggestion only if supported and visible.
4. If neither exists, show unsupported/choose-county behavior rather than silently showing unrelated county data.

### Invalid county behavior

An invalid county id should:

- Be rejected by registry validation.
- Not create storage namespaces.
- Not trigger reads or writes.
- Not show stale county data.
- Fall back to safe default behavior approved for that product phase.
- Emit diagnostics for maintainers if future implementation includes monitoring.

### Travel behavior

Travel behavior should support:

- User lives in County A, currently located in County B.
- User saved home/work in County A, but wants awareness in County B.
- User crosses unsupported counties.
- User has route endpoints in different counties.
- User opens the app with stale last-active county state.

Recommended policy:

- Keep **profile/home preference** separate from **current awareness county**.
- Treat route travel as a future multi-county problem unless both counties are activated and containment is proven.
- Do not merge alerts from multiple counties into one awareness feed until a regional aggregation architecture is approved.

### Future multi-county considerations

Future multi-county behavior should introduce a higher-level **regional awareness context** only after county-level containment is proven. It should not be implemented by removing county filters. Regional surfaces should be explicit aggregations of county-contained reads.

## 6. Storage Policy

### Storage ownership principles

1. **Identity can be global.** Device and account identity should not be duplicated per county unless required by privacy or support policy.
2. **Awareness state should be county-scoped.** Selected area, home town, localized preferences, and area-specific settings should not leak across counties.
3. **Operational records should be county-scoped.** Reports, feedback, historical capture, and Route Watch records must carry county metadata.
4. **Preferences may be mixed.** Some settings are global, while notification choices may include both global defaults and county-specific overrides.
5. **Legacy Liberty behavior must be preserved.** Existing Liberty keys and rows must not be broken by future namespacing work.

### Recommended classification

| State | Recommended ownership | Rationale |
| --- | --- | --- |
| Device ID | Global | Represents installation/device, not geography. |
| User profile | Global with county preferences | User identity is global; preferred county and home county can be fields. |
| Authentication/session state | Global | Not county-specific. |
| App settings | Global by default; county override when setting affects local behavior | Theme/map style can be global; local alert thresholds may be county-scoped. |
| Notification preferences | Global defaults plus county-scoped overrides | Users may want different alert behavior by county. |
| Awareness areas | County scoped | Area ids and labels are county-specific. |
| Home town | County scoped or profile home-county scoped | A town name can be ambiguous and should not bleed between counties. |
| Current awareness county | Global/device scoped, validated against registry | Represents active context. |
| Last GPS county | Global/device scoped with freshness | Detection state is device-level but must be validated. |
| Route Watch active route | County scoped initially; future regional route scoped when approved | Current route intelligence should not cross county boundaries without regional architecture. |
| Saved places | County scoped with optional global address book later | Place names/coordinates need county context to avoid wrong local interpretation. |
| Home/work places | County scoped plus optional global profile pointer | Home/work may belong to a specific county; profile may reference default saved place. |
| Feedback | County scoped | Feedback needs county context for triage and analytics. |
| Historical context | County scoped and internal-only | Historical evidence must not merge counties unless explicitly aggregated later. |
| Report metadata | County scoped | Reports must include county id/state and county-derived awareness metadata. |
| Crossing review state | County scoped | Crossing ids and overrides are county-specific. |
| Source health/cache | County scoped by source and county | Feed status and freshness differ by county. |
| QA/audit fixtures | County scoped | Fixtures validate county-specific package behavior. |
| Feature flags | Global with county eligibility | Flag may be global, but county activation eligibility must be registry-controlled. |

### Storage namespace recommendation

Future storage keys should follow a clear pattern:

```text
gridly:<domain>:<version>
gridly:<domain>:<version>:<countyId>
gridly:<domain>:<version>:<countyId>:<subscope>
```

Examples:

- Global: `gridly:device:v1`
- Global preference: `gridly:user-profile:v1`
- County scoped: `gridly:awareness:v1:liberty-tx`
- County scoped: `gridly:route-watch:v1:liberty-tx`
- County scoped: `gridly:feedback-draft:v1:liberty-tx`

No namespace change is implemented by V459. Future namespace work must include migration and rollback planning.

## 7. Read / Write Containment Architecture

### Containment principles

1. **Every write must know its county.** Any production write that represents local awareness, reporting, feedback, Route Watch, or source evidence must include county metadata.
2. **Every read must filter by county.** Consumer-visible reads must select only records eligible for the active county context.
3. **Unknown county records must not leak into County #2.** Legacy/null rows may be interpreted as Liberty only under approved Liberty compatibility policy.
4. **County filters are not UI-only.** Containment must exist at data access, service, cache, and presentation layers where applicable.
5. **Aggregations must be explicit.** Cross-county summaries require a future regional aggregation architecture.
6. **Paused counties must stop contributing.** Pausing a county should remove its records from consumer surfaces without deleting data.

### Reports

Reports should:

- Write `countyId`, `state`, awareness area, location, source channel, and package version where available.
- Validate report location against the active county boundary when location is available.
- Reject or quarantine invalid county/location combinations according to future implementation policy.
- Read only active county records for consumer surfaces.
- Treat missing county metadata according to the legacy/null policy, preserving Liberty compatibility without exposing null rows to County #2.

### Alerts

Alerts should:

- Be derived only from records eligible for the active county.
- Carry county metadata through alert generation, deduplication, lifecycle updates, and display.
- Avoid merging alerts across county boundaries unless a future regional alert architecture is approved.
- Suppress or quarantine alerts from paused counties.

### Historical Capture

Historical capture remains protected:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`

Future historical capture compatibility should:

- Include county metadata in capture envelopes.
- Preserve internal-only status.
- Avoid using historical evidence as live authority.
- Avoid cross-county aggregation unless explicitly approved.
- Keep historical UI/API closed.

### Route Watch

Route Watch should:

- Treat saved places, active routes, route geometry, route relevance, and route alerts as county-scoped until regional routing is approved.
- Detect when a route exits the active county and apply a safe limitation message or future regional policy.
- Never infer transportation-intelligence activation from county activation.
- Avoid mixing County A route state with County B awareness surfaces.

### Awareness

Awareness surfaces should:

- Use county package awareness areas and labels.
- Use active county copy, not Liberty fallback copy, for non-Liberty counties.
- Filter reports, alerts, crossings, road segments, and source summaries to active county.
- Show unsupported or unavailable behavior when county context is invalid.

### Community Pulse

Community Pulse should:

- Summarize only active-county eligible inputs.
- Keep awareness-area summaries county-scoped.
- Avoid comparing counties unless a future regional pulse product is approved.
- Suppress paused-county inputs.

### Transportation Intelligence

Transportation intelligence remains inactive. Future compatibility should require:

- County-specific source contracts.
- County-specific source identifiers.
- Feed status and freshness per county.
- Source-to-county boundary validation.
- Clear separation from reports and community awareness until activation is separately approved.

## 8. Rollback / Deactivation Architecture

### Deactivation triggers

A county should be paused or deactivated when any of the following occur:

- Source feed failure or stale source data.
- Boundary or package data error.
- Bad crossing, road, or awareness-area data that affects user trust.
- Read containment failure.
- Write containment failure.
- Storage namespace contamination.
- Invalid GPS/detection behavior.
- Support readiness failure.
- Legal/licensing concern.
- Operational incident requiring investigation.

### County deactivation process

Recommended process:

1. Change lifecycle state to `paused`.
2. Remove county from consumer-visible selection/detection eligibility.
3. Stop new county-scoped production writes except explicitly allowed diagnostics.
4. Suppress county-scoped consumer reads.
5. Preserve data for audit and recovery according to retention policy.
6. Display safe unsupported/unavailable messaging if users are in or selected that county.
7. Notify operations/support owners.
8. Open a containment/data-quality review.
9. Define return-to-service criteria.

### Feed failure behavior

If a county source feed fails:

- Do not promote stale feed data as current.
- Mark source status degraded or paused.
- Suppress feed-derived transportation intelligence unless stale-display policy is approved.
- Continue community/report awareness only if independently safe and approved.
- Avoid falling back to another county's source feed.

### Bad data behavior

Bad data should be handled by containment level:

| Bad data type | Recommended response |
| --- | --- |
| Boundary error | Pause county selection/detection and any location-based containment. |
| Awareness-area error | Suppress affected awareness area or pause county if area routing is unsafe. |
| Crossing error | Suppress affected crossing or crossing layer; do not contaminate reports. |
| Road segment error | Suppress road-derived relevance or route intelligence for the county. |
| Source contract error | Pause source-derived feature for county. |
| Report county mismatch | Reject, quarantine, or mark for review depending on future implementation. |

### Containment failure behavior

Containment failures should be treated as launch-blocking or pause-worthy:

- Cross-county read leak: pause affected county and remove visible surfaces until fixed.
- Cross-county write leak: stop writes, preserve evidence, and perform data repair analysis.
- Storage namespace leak: stop affected local state reads/writes and define migration cleanup.
- Alert/awareness leak: suppress derived surfaces and re-run fixtures.

### Rollback requirements

Every activated county must have:

- Registry state rollback.
- Selection/detection rollback.
- Storage read fallback.
- Write suppression path.
- Read suppression path.
- Source/feed pause path.
- User messaging fallback.
- Support playbook.
- Validation fixtures proving rollback behavior.

### Safe fallback behavior

Safe fallback should be phase-dependent:

- In current Liberty-only mode, preserve Liberty County #1 behavior.
- In future multi-county mode, fallback should prefer explicit unsupported/choose-county behavior over showing a wrong county.
- Paused County #2 must not fall back to Liberty data as if it were local.
- Retired counties should be hidden and non-selectable.

## 9. County #2 Readiness Criteria

County #2 cannot be visibly evaluated until all checklists below pass.

### County Activation Checklist

- [ ] County has a stable `countyId`.
- [ ] County has a registry entry in `planned` or later state.
- [ ] County package owner is assigned.
- [ ] Engineering owner is assigned.
- [ ] QA owner is assigned.
- [ ] Operations/support owner is assigned.
- [ ] County package manifest exists.
- [ ] County boundary source is identified.
- [ ] Awareness-area strategy is defined.
- [ ] Crossing strategy is defined.
- [ ] Road segment strategy is defined.
- [ ] Source contract inventory is complete.
- [ ] Storage classification is complete.
- [ ] Read/write containment plan is complete.
- [ ] Rollback/deactivation plan is complete.
- [ ] Protected boundaries are confirmed unchanged.

### County Validation Checklist

- [ ] Registry entry validates against registry schema.
- [ ] County id is unique and stable.
- [ ] Lifecycle state transition is valid.
- [ ] Boundary geometry validates.
- [ ] Boundary source and version are documented.
- [ ] Inside/outside point fixtures pass.
- [ ] Awareness areas resolve only inside intended county context.
- [ ] Awareness copy has no unintended Liberty fallback for the new county.
- [ ] Crossing source and fallback strategy validate.
- [ ] Crossing overrides are reviewed and owned.
- [ ] Road segment data validates.
- [ ] Road-name normalization fixtures pass.
- [ ] Report write metadata includes county context in future implementation validation.
- [ ] Report reads filter by county in future implementation validation.
- [ ] Alert derivation filters by county in future implementation validation.
- [ ] Route Watch storage and reads are county-scoped in future implementation validation.
- [ ] Feedback records are county-scoped in future implementation validation.
- [ ] Historical capture envelopes include county metadata if capture is active in future validation.
- [ ] Historical reads/UI/API remain disabled.
- [ ] DriveTexas remains paused.
- [ ] Rollback drill passes.

### County Launch Checklist

- [ ] County lifecycle state is `pilot_ready` before launch approval.
- [ ] Product/platform owner approves activation.
- [ ] Data/package owner certifies package completeness.
- [ ] Engineering owner certifies containment implementation.
- [ ] QA owner certifies validation evidence.
- [ ] Operations/support owner certifies support readiness.
- [ ] Source health monitoring is ready.
- [ ] Pause/deactivation controls are ready.
- [ ] User messaging for unsupported/paused county is ready.
- [ ] Selection/detection behavior is approved.
- [ ] No protected historical or DriveTexas boundary is changed.
- [ ] Launch criteria are documented in an activation approval artifact.

## 10. Transportation Intelligence Compatibility Review

### Compatibility goal

County activation architecture should make future transportation intelligence possible without activating it. The system should be ready to govern construction, road work, lane closures, road closures, travel advisories, and transportation disruptions as county-scoped awareness inputs later.

### Future data categories

| Category | Future compatibility requirement | Activation status in V459 |
| --- | --- | --- |
| Construction | County-specific source contract, geometry containment, freshness policy | Not active |
| Road work | Source authority, road-name normalization, duration policy | Not active |
| Lane closures | Direction/lane semantics, source confidence, active-time windows | Not active |
| Road closures | Closure authority, detour/route-impact policy, emergency override rules | Not active |
| Travel advisories | Advisory severity, geography, expiration, source trust | Not active |
| Transportation disruptions | Event taxonomy, county boundary containment, alert eligibility | Not active |
| DriveTexas-style feeds | County identifiers, corridor allowlists, replay validation, pause controls | Designed / Validated / Governed / Paused |

### Architecture compatibility requirements

Future transportation intelligence should require:

1. County-specific source contracts.
2. County-specific source identifiers and corridor allowlists.
3. Source-to-county geometry validation.
4. Freshness and stale-data handling.
5. Severity and confidence normalization.
6. Clear distinction between government/transportation sources and community reports.
7. County-scoped reads, writes, caches, and alerts.
8. Pause/deactivation per source and per county.
9. No historical UI/API exposure by default.
10. No Route Watch authority unless separately approved.

### DriveTexas compatibility position

DriveTexas remains:

- Designed
- Validated
- Governed
- Paused

County activation may define where future DriveTexas-style data would attach, but it must not start polling, ingestion, rendering, alerting, awareness influence, Route Watch influence, historical reads, or consumer UI behavior.

## 11. Recommended Milestone Sequence

Recommended sequence after V459:

1. **V460 Liberty County #1 Normalization Plan**
   - Plan how to move Liberty-specific assumptions into explicit County #1 configuration while preserving current Liberty behavior.
   - Documentation/architecture first; implementation only in a later authorized milestone.

2. **V461 County Registry Contract and Validation Plan**
   - Define registry schema, package manifest schema, validation fixtures, lifecycle-state validation, and governance artifacts.
   - Still no County #2 activation.

3. **V462 Storage Namespace and Legacy Liberty Compatibility Plan**
   - Define detailed localStorage/Supabase/storage migration strategy, legacy null county behavior, rollback, and validation.
   - No migrations or production changes unless separately authorized later.

4. **V463 Read/Write County Containment Validation Plan**
   - Define future tests/audits for reports, alerts, feedback, awareness, Community Pulse, historical capture envelopes, and Route Watch.
   - No behavior changes.

5. **V464 County Package Fixture Standard**
   - Define fixture requirements for boundary, road segments, crossings, awareness areas, report samples, and invalid-location cases.
   - Enables safe future evaluation of County #2 candidates.

6. **V465 Regional Expansion Candidate Review**
   - Evaluate possible County #2 candidates only after the activation architecture, registry contract, storage policy, and containment validation plan exist.
   - Candidate review should remain non-visible.

7. **V466 Transportation Intelligence Data Governance Plan**
   - Define source governance for construction, road work, lane closures, road closures, travel advisories, disruptions, and DriveTexas-style feeds.
   - Must preserve DriveTexas paused status unless a later milestone explicitly changes it.

## 12. Recommended Next Milestone

**Recommended next milestone: V460 Liberty County #1 Normalization Plan.**

Rationale:

- Liberty County is County #1, and current behavior must remain stable.
- Before evaluating County #2, Liberty-specific assumptions should be classified as either intentional County #1 defaults, package fields, registry fields, storage legacy behavior, or future normalization targets.
- V460 should remain architecture/planning unless separately authorized.
- V460 should not change UI, reporting, Route Watch, historical systems, Supabase, migrations, DriveTexas, or transportation intelligence.

V460 should produce a safe normalization plan that preserves Liberty County behavior while preparing the platform for governed multi-county readiness in later milestones.
