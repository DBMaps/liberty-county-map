# GRIDLY Runtime Architecture Tree & Downstream Flow Audit V624

## 0. Milestone Scope

V624 is a documentation-only root-cause architecture audit for the Gridly runtime. It maps the current downstream flow from county selection and reporting through visibility, clustering, markers, alerts, awareness, road naming, crossings, historical surfaces, and audit helpers before selecting the next implementation fix.

This milestone makes no runtime behavior change, no Supabase schema change, no historical read or UI enablement, no DriveTexas change, no Transportation Intelligence change, no framework introduction, and no UI redesign.

Protected boundary status for this audit:

| Boundary | Required Status |
| --- | --- |
| Runtime behavior | Unchanged |
| Supabase schema | Unchanged |
| `historicalReadsEnabled` | `false` |
| `historyUiEnabled` | `false` |
| DriveTexas | Paused |
| Transportation Intelligence | Disabled |
| Framework introduction | None |
| UI redesign | None |

## 1. Top-Level Runtime Tree

### 1.1 County Selection / Awareness Area

**Primary responsibility:** decide the user's current viewing and awareness context.

**Representative runtime functions and state:**

- `gridlyGetActiveCountyId()` resolves the active county from selected awareness area/window state/default behavior.
- `getGridlySelectedAwarenessArea()` supplies the selected awareness area when available.
- `gridlyResolveCountyIdForAwarenessArea()` maps selected local awareness areas such as Conroe or Liberty-area towns into county identity.
- `gridlyCountyContextContainmentAudit()` verifies that selected awareness area, active county, active town, map context, and label containment are aligned.
- `gridlyCountyRuntimeOwnershipAudit()` verifies active runtime text/state/search ownership surfaces.

**Architecture role:** `activeCounty` is the viewing and awareness context, not necessarily the ownership county of every report the driver may submit.

### 1.2 Map Bounds

**Primary responsibility:** keep map fit/search context county-scoped instead of borrowing unrelated crossing or legacy Liberty bounds.

**Representative runtime functions and state:**

- `gridlyGetCountyBounds(countyId)` returns county-scoped map bounds when available.
- `gridlyCoordinateInsideCountyBounds(lat, lng, countyId)` checks whether a coordinate is inside a supported county boundary envelope.
- `getGridlyDestinationSearchContainmentContext(getGridlySearchMapContext())` supplies bounded destination search context.
- `gridlyResolveCountyIdForCoordinate(lat, lng)` determines the supported county that owns a tapped/report coordinate.

**Architecture role:** bounds support selection containment, destination search containment, coordinate-county ownership, and fail-closed behavior for unsupported coordinates.

### 1.3 Reporting

**Primary responsibility:** convert a user action into a report payload and submit it while preserving coordinate ownership.

**Representative runtime functions and state:**

- Tap/map action captures a selected coordinate.
- `resolveRoadHazardReportTypeForAction(hazardType, options)` normalizes road-hazard type.
- `gridlyGetCoordinateScopedReportMetadata(lat, lng)` returns coordinate-owned report metadata.
- `gridlyGetCountyScopedReportMetadata()` still exists for active-county-scoped metadata paths.
- Road-hazard submission constructs Supabase row metadata, local `localHazardEntry`, structured county metadata, and duplicate/cluster key fields.
- `gridlyRecordReportSubmissionOwnershipAttempt()` and `gridlyRecordReportSubmissionOwnershipAccepted()` update diagnostic state.

**Architecture role:** reporting is allowed outside the currently selected county if the coordinate belongs to another supported county.

### 1.4 Report Coordinate Ownership

**Primary responsibility:** separate the county that owns the tapped coordinate from the county currently selected for viewing.

**Representative runtime functions and state:**

- `gridlyResolveCountyIdForCoordinate(lat, lng)` is the coordinate ownership resolver.
- `gridlyGetCoordinateScopedReportMetadata(lat, lng)` provides `county_id`/`countyId` for the report payload.
- `gridlyReportLocationCountyOwnershipAudit()` verifies coordinate county, submit county, active-county forcing, and out-of-active-county acceptance.

**Architecture role:** `reportCoordinateCounty` and `reportSubmitCounty` are actual report ownership fields; they must not be coerced to `activeCounty` when the tapped coordinate is in a different supported county.

### 1.5 Local Active Hazard Inventory

**Primary responsibility:** keep accepted local road-hazard submissions visible to downstream local pipelines immediately after submission, before or independent of async shared-report refresh.

**Representative runtime functions and state:**

- `activeHazards` stores active local road hazards.
- `gridlyCanonicalReportIdForRecord(record, fallback)` normalizes report identity.
- `gridlyRegisterAcceptedLocalHazard(localHazardEntry, submittedReportId)` inserts the accepted local hazard by canonical ID.
- `gridlyMergeAcceptedLocalHazardsIntoActiveInventory(reason)` restores accepted local hazards if a refresh overwrites `activeHazards`.
- `gridlyReportSubmissionOwnershipState` stores registration and refresh diagnostics.

**Architecture role:** accepted local hazards enter the local inventory even when their ownership county is outside the active viewing county.

### 1.6 `activeReports` / Shared Reports

**Primary responsibility:** represent shared crossing reports and loaded report rows, separate from local road-hazard inventory.

**Representative runtime functions and state:**

- `activeReports` stores shared report rows.
- `loadSharedReports(reason)` reads reports from Supabase and normalizes them for runtime use.
- `gridlyReportMatchesActiveCounty(report, activeCounty)` filters rows by county metadata.
- Combined shared inventory in audits is usually `[...activeHazards, ...activeReports]`.

**Architecture role:** shared reports are not the only visibility source for locally accepted road hazards; `activeHazards` remains authoritative for accepted road-hazard registration.

### 1.7 Supabase Write/Read

**Primary responsibility:** persist live reports and read shared reports.

**Representative runtime functions and state:**

- Report submission uses `supabase.from("reports").insert(...)` style live-report writes.
- `loadSharedReports(reason)` reads live shared reports from the reports table.
- Historical sidecar writer uses isolated `history_capture.historical_events` insert-only paths and must not enable historical reads/UI.

**Architecture role:** live report writes use report metadata county ownership; V624 does not modify schema or read/write behavior.

### 1.8 Filtering

**Primary responsibility:** select the rows eligible for a given active viewing context or downstream rendering stage.

**Representative runtime functions and state:**

- `gridlyReportMatchesActiveCounty(report, activeCounty)` determines whether a report belongs in the active-county visible set.
- `gridlyFilterRoadHazardsByLatestLifecycle(activeHazards, Date.now())` removes expired/cleared/suppressed hazards before cluster input.
- `getGridlyAwarenessLifecycleActiveHazards(activeHazards)` selects hazards that count in awareness.
- `gridlyFilterAlertCorridorsBySelectedAwarenessArea(corridorClusters)` filters alert corridor output by selected awareness area.

**Architecture role:** filtering is where an accepted out-of-selected-county report becomes intentionally hidden from the active county view.

### 1.9 Clustering

**Primary responsibility:** group active road hazards into road incident clusters for unified incidents and marker rendering.

**Representative runtime functions and state:**

- `getHazardClusterKey(record)` builds road-hazard cluster keys.
- `getLiveHazardIncidents()` groups filtered `activeHazards` into live road-hazard incidents.
- `gridlyFilterRoadHazardsByLatestLifecycle()` supplies cluster input.
- `gridlyRoadClusterAudit(options)` / `gridlyBuildRoadClusterAudit(options)` inspect cluster inputs, representative coordinates, rendered coordinates, and high-zoom risk.

**Architecture role:** clustering occurs after active-hazard registration and lifecycle filtering, before unified incidents and marker input.

### 1.10 Marker Rendering

**Primary responsibility:** render unified rail and road incidents as map markers.

**Representative runtime functions and state:**

- `getUnifiedIncidents()` combines crossing and road incidents.
- `renderUnifiedIncidents()` is the marker rendering consumer for unified incidents.
- `unifiedIncidentLayer` stores rendered marker layers.
- `gridlyReportVisibilityPipelineAudit()` checks marker input and attempts to infer rendered marker evidence from `unifiedIncidentLayer`.
- `gridlyBuildRoadClusterAudit()` also samples rendered marker placement audits.

**Architecture role:** current marker evidence can prove countability and marker input more reliably than final DOM/map rendering; rendered-marker confirmation remains weaker when layer state is delayed or unavailable.

### 1.11 Alert Generation

**Primary responsibility:** transform active reports/incidents into alert cards and corridor summaries.

**Representative runtime functions and state:**

- `renderAlerts()` builds alert cards from commute consequence intelligence and unified incidents.
- `buildCommuteConsequenceIntelligence({ limit })` constructs alert/corridor intelligence.
- `getRoadHazardSurfaceIncidents(limit)` and `renderRoadHazards()` render road-hazard alert rows.
- `getUnifiedIncidents()` supplies recently cleared and other incident content.

**Architecture role:** alert generation consumes active-county-filtered context and unified incident state; out-of-selected-county reports should not silently appear in a different county's alert cards unless a product policy explicitly says so.

### 1.12 Awareness Generation

**Primary responsibility:** generate active awareness header/counts, community pulse, selected-location intelligence, and top-strip status.

**Representative runtime functions and state:**

- `getGridlyAwarenessLifecycleActiveHazards(activeHazards)` supplies active hazard counts.
- Active awareness state uses active-county/active-town context.
- `refreshPortraitV2LocalizedIntelligence()` and related awareness renderers consume text models and counts.
- `gridlyCountyRuntimeOwnershipAudit()` checks awareness language county ownership.

**Architecture role:** awareness is anchored to `activeCounty` and `activeTown`; it should not count out-of-active-county reports unless the view explicitly changes or an All/cross-county mode is selected.

### 1.13 Destination Search

**Primary responsibility:** search destinations within the active county/search bounds.

**Representative runtime functions and state:**

- `gridlySearchAddress(query, options)` performs destination search.
- `getGridlyDestinationSearchContainmentContext(getGridlySearchMapContext())` supplies county-bounded search context.
- `runGridlyLiveDestinationSearch()` renders current search results.
- `gridlyDestinationSearchContainmentAudit(query)` proves Montgomery search does not leak Liberty/Harris results when Montgomery is active.

**Architecture role:** destination search is a selected-county context surface, separate from report coordinate ownership.

### 1.14 Route Context

**Primary responsibility:** keep route/commute language and route impact interpretation aligned to the selected county/awareness area.

**Representative runtime functions and state:**

- Route context samples appear in `gridlyCountyRuntimeOwnershipAudit()`.
- `buildCommuteConsequenceIntelligence()` and corridor functions supply route-adjacent alert context.
- Route Watch remains separate and must not be expanded by this milestone.

**Architecture role:** route context is viewing-context-owned, not report-coordinate-owned, unless a future route-specific policy says cross-county reports affect an active route.

### 1.15 Crossings

**Primary responsibility:** load and render county-owned rail crossing data and marker/click behavior.

**Representative runtime functions and state:**

- `loadCrossings()` loads active county crossing data.
- `gridlyGetActiveCountyRuntimeSources()` reports active crossing/road/boundary sources.
- `gridlyCountyRuntimeSourceAvailable("crossings")` indicates whether crossing assets are available for a county.
- `gridlyCrossingPipelineAudit()` and `gridlyCrossingRenderAudit()` inspect crossing load/render status.

**Architecture role:** Montgomery can show railroad/base-map features while Gridly crossing markers/click behavior remain unwired if county-owned crossing assets are missing or unavailable.

### 1.16 Road Resolver / Road Naming

**Primary responsibility:** turn a coordinate/report into a useful road/location label.

**Representative runtime functions and state:**

- Reference-road resolver and evidence helpers include `gridlyReferenceRoadResolverAudit(options)`, `gridlyReferenceRoadEvidenceAudit(options)`, and `gridlyRoadHazardLocationShadowAudit(options)`.
- Road naming standardization helpers include `gridlyRoadNameStandardizationAudit()` and location consistency helpers such as `gridlyRoadHazardLocationConsistencyAudit(options)`.
- `buildRoadHazardDisplay(incident)` and alert/popup label builders consume the resolved names.

**Architecture role:** Montgomery reporting ownership now works better than Montgomery road naming. Poor labels such as “Road Hazard on Conroe” and “Local Road Impact Shared Report” indicate the resolver/display path does not yet have sufficient Montgomery road asset or naming coverage.

### 1.17 Historical Panel

**Primary responsibility:** show or audit historical intelligence surfaces while preserving protected historical-read/UI boundaries.

**Representative runtime functions and state:**

- `gridlyHistoricalIntelligenceExperienceAudit()` audits historical intelligence experience readiness.
- `gridlyHistoricalIntelligenceFinalRenderAudit(options)` audits final rendered historical rows.
- `gridlyHistoricalCanaryAudit()` and historical status/canary helpers validate dormant/protected behavior.
- `historicalReadsEnabled` and `historyUiEnabled` must remain false.

**Architecture role:** historical UI/content remains a protected boundary. Existing Dayton historical cards visible under Montgomery/Conroe indicate a containment leak in rendered/demo/seeded historical panel content, not authorization to enable historical reads or UI.

### 1.18 Audit Helpers

**Primary responsibility:** expose targeted diagnostics without changing runtime behavior.

**Representative helper families:**

- County context containment: `gridlyCountyContextContainmentAudit()`.
- Destination containment: `gridlyDestinationSearchContainmentAudit(query)`.
- Runtime ownership: `gridlyCountyRuntimeOwnershipAudit()`.
- Report visibility pipeline: `gridlyReportVisibilityPipelineAudit()`.
- Montgomery report submission: `gridlyMontgomeryReportSubmissionAudit()`.
- Report location county ownership: `gridlyReportLocationCountyOwnershipAudit()`.
- Crossing pipeline/render: `gridlyCrossingPipelineAudit()`, `gridlyCrossingRenderAudit()`.
- Road naming/location: `gridlyReferenceRoadResolverAudit()`, `gridlyReferenceRoadEvidenceAudit()`, `gridlyRoadHazardLocationShadowAudit()`, `gridlyRoadHazardLocationConsistencyAudit()`, `gridlyRoadNameStandardizationAudit()`.
- Historical canary/status/final render: `gridlyHistoricalCanaryAudit()`, `gridlyHistoricalIntelligenceFinalRenderAudit()`, `gridlyHistoricalIntelligenceExperienceAudit()`.

## 2. Data Flow: Road Hazard Report

### 2.1 Stage-by-Stage Flow

| Stage | Function Names | Primary Inputs | Outputs | County Ownership Source | Known Failure Modes | Audit Helper Coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Tap map | Map click/report UI handlers; selected coordinate state | User tap lat/lng, selected hazard type, device/session state | Pending coordinate and report action | Raw tapped coordinate, not `activeCounty` | Coordinate missing, stale tap, unsupported coordinate, popup lifecycle reset | `gridlyReportActionCompletionAudit`; downstream ownership audits infer coordinate state |
| Selected coordinate | Coordinate selection/reporting state | Lat/lng from map or user location | `reportLat`, `reportLng`, raw tap/final placement coordinate | Coordinate itself | Invalid numbers, location permission fallback, stale selected coordinate | `gridlyReportLocationCountyOwnershipAudit()` records `reportLat`/`reportLng` |
| Coordinate county resolution | `gridlyResolveCountyIdForCoordinate(lat, lng)`; `gridlyCoordinateInsideCountyBounds()` | Selected lat/lng, supported county bounds | `reportCoordinateCounty` or null | Supported county bounds | Unsupported coordinate fails closed; boundary gaps/overlaps can misclassify | `gridlyReportLocationCountyOwnershipAudit()`; V623 tests |
| Report object construction | `resolveRoadHazardReportTypeForAction()`; `gridlyGetCoordinateScopedReportMetadata()`; road-hazard submit path | Hazard type, coordinate, resolved county metadata, road name/location fields | Supabase row, `legacyRow`, `localHazardEntry` | `gridlyGetCoordinateScopedReportMetadata()` | Active-county-forced ownership, missing county metadata, poor road name, generic labels | `gridlyRoadHazardSubmitShapeAudit()`; `gridlyReportLocationCountyOwnershipAudit()` |
| Supabase insert | Live report insert path to `reports` | Constructed row and metadata | Submitted row/id/error | Row `county_id` / coordinate-scoped metadata | Network error, schema mismatch, ID mismatch, fallback legacy shape | `gridlyRoadHazardSubmitShapeAudit()`; `gridlyMontgomeryReportSubmissionAudit()` |
| Local accepted hazard registration | `gridlyRegisterAcceptedLocalHazard(localHazardEntry, submittedReportId)`; `gridlyRecordReportSubmissionOwnershipAccepted()` | Accepted local hazard, submitted row ID | Entry inserted into `activeHazards`, ownership state updated | `localHazardEntry.county_id` / `countyId` / raw metadata | Refresh overwrite, canonical ID mismatch, local entry not inserted | `gridlyReportVisibilityPipelineAudit()`; `reportRegistrationRootCauseV622_1` test coverage |
| `activeHazards` | Runtime state array | Accepted local hazard rows and shared/refreshed hazards | Authoritative local active hazard inventory | Per-row county metadata | Reset after refresh, duplicate canonical IDs, expired/cleared lifecycle suppression | `gridlyReportVisibilityPipelineAudit()`; `gridlyMontgomeryReportSubmissionAudit()` |
| Active county visible set | `gridlyReportMatchesActiveCounty(report, activeCounty)` | `activeHazards + activeReports`, current `activeCounty` | Filtered visible rows | Row county metadata compared with `activeCounty` | Out-of-active-county report hidden; missing metadata fallback risks | `gridlyReportVisibilityPipelineAudit()`; `gridlyReportLocationCountyOwnershipAudit()` |
| Clustering | `gridlyFilterRoadHazardsByLatestLifecycle()`; `getLiveHazardIncidents()`; `getHazardClusterKey()` | Active hazard rows | Live road-hazard incidents/clusters | Inherited from hazard rows; should be pre-filtered or row-owned | Expired/cleared suppression, broad cluster merge, representative coordinate drift | `gridlyRoadClusterAudit()`; `gridlyReportVisibilityPipelineAudit()` |
| Marker input | `getUnifiedIncidents()`; `getLiveHazardIncidents()` | Rail incidents and road incidents | Unified incident rows for marker rendering | Incident/report county metadata or active context filtering | Incident not built, missing coordinates, hidden by active county | `gridlyReportVisibilityPipelineAudit()`; `gridlyRoadClusterAudit()` |
| Marker render | `renderUnifiedIncidents()`; `unifiedIncidentLayer` | Unified incidents | Map marker layers | Rendered incidents already selected by pipeline | Render delay, layer unavailable, marker audit cannot see layer, coordinate mismatch | `gridlyReportVisibilityPipelineAudit()` has `markerRendered`; `gridlyBuildRoadClusterAudit()` samples rendered placement |
| Alert input | `buildCommuteConsequenceIntelligence()`; `getRoadHazardSurfaceIncidents()`; `getUnifiedIncidents()` | Active reports, cluster input, unified incidents | Alert/corridor/road-hazard inputs | Active county/selected awareness context | Out-of-county report in wrong alert context, poor labels, route context ambiguity | `gridlyReportVisibilityPipelineAudit()` checks `inAlertInput`; runtime ownership audit checks language |
| Alert card | `renderAlerts()`; `renderRoadHazards()`; `buildRoadHazardDisplay()` | Alert input/corridors/incidents | Alert card HTML/content | Active viewing/awareness context | Generic labels, wrong county text, missing road cue | `gridlyCountyRuntimeOwnershipAudit()`; road naming audits |
| Awareness header/counts | `getGridlyAwarenessLifecycleActiveHazards()`; awareness renderers; `refreshPortraitV2LocalizedIntelligence()` | Active hazards and selected awareness context | Counts, header, pulse, localized intelligence | `activeCounty`/`activeTown` | Cross-county count leakage, stale Dayton/Liberty copy, hidden report confusion | `gridlyCountyContextContainmentAudit()`; `gridlyCountyRuntimeOwnershipAudit()`; `gridlyReportVisibilityPipelineAudit()` |

### 2.2 Key Root-Cause Observation

The current architecture correctly separates **coordinate ownership** from **active viewing context**. A road hazard can be accepted and locally registered under the tapped coordinate county while still being hidden from the active county visible set because `activeCounty` remains the selected viewing/awareness context.

That is an architecture success for ownership containment but an unresolved product experience decision for out-of-selected-county reporting.

## 3. Data Flow: Out-of-Selected-County Report

Scenario:

```text
activeCounty = montgomery-tx
tap coordinate county = liberty-tx
```

### 3.1 What Currently Happens

| Question | Current Answer |
| --- | --- |
| Is the report accepted? | Yes, when the coordinate resolves to a supported county and the Supabase/local submission path succeeds. V623 evidence shows Liberty-coordinate reporting while Montgomery is selected resolves ownership to `liberty-tx`. |
| Is it registered locally? | Yes. The accepted local hazard registration path inserts the local hazard into `activeHazards` by canonical report ID. |
| Is it intentionally hidden because current view is Montgomery? | Yes. `gridlyReportMatchesActiveCounty(report, activeCounty)` treats the Liberty-owned report as not visible while `activeCounty` is `montgomery-tx`. |
| Should UX switch to the report county? | Undefined. This is a product policy decision, not a runtime ownership bug. |
| Should the app show a confirmation like “Reported in Liberty County”? | Recommended as a safe near-term UX policy because it confirms acceptance without silently changing context. |
| Should the map marker appear even while Montgomery is selected? | Undefined and risky by default. Showing a Liberty marker while Montgomery is selected can violate the county-as-viewing-context contract unless the UI clearly enters an All/cross-county mode or temporary submitted-report preview state. |
| Should only “All” mode show cross-county reports? | This is a safe long-term option if an explicit All/cross-county viewing mode exists or is introduced later. |
| What are safe product options? | See options below. |

### 3.2 Safe Product Options

#### Option A — Accept, stay in selected county, show ownership confirmation

- Keep current report ownership behavior.
- Keep current active-county filtering behavior.
- Show confirmation such as “Reported in Liberty County.”
- Do not render the marker while Montgomery remains selected.
- Offer a secondary action such as “View Liberty County” if product wants an explicit switch.

**Pros:** safest containment; minimal runtime risk; explains why marker/counts do not appear in Montgomery.
**Cons:** user may expect to see the marker immediately and may perceive the report as missing.

#### Option B — Accept and automatically switch to report county

- After successful report submission, switch `activeCounty`/awareness area to the report county.
- Render marker/counts under the report county context.

**Pros:** marker becomes visible in its rightful county; simple mental model after reporting.
**Cons:** unexpected context jump; requires careful activeTown fallback; can disrupt users who intentionally monitor Montgomery while reporting nearby Liberty.

#### Option C — Accept and show temporary submitted-report preview while selected county stays unchanged

- Keep Montgomery as active county.
- Show a transient local marker/toast/banner for the just-submitted Liberty report.
- Do not include it in Montgomery awareness counts or alert cards.

**Pros:** immediate visual reassurance without corrupting awareness counts.
**Cons:** adds a special marker state and needs expiration/interaction rules.

#### Option D — Explicit All/cross-county mode

- Keep county-specific views strict.
- Add or use an explicit All mode where supported counties' visible sets can be combined.
- Cross-county reports appear only in All mode or after user switches county.

**Pros:** clean semantics for multi-county visibility.
**Cons:** larger product/UI decision and not appropriate as a quick downstream fix.

### 3.3 Recommended Next Step

Recommended next milestone: **define and implement Option A first**.

The safest immediate product contract is:

1. Drivers may report hazards anywhere inside supported county coverage.
2. The report belongs to the tapped coordinate county.
3. The app remains in the currently selected county unless the user explicitly changes context.
4. Successful out-of-selected-county reports show clear confirmation: “Reported in Liberty County.”
5. The app may offer a clear “View Liberty County” action later, but should not auto-switch without a separate UX decision.
6. Montgomery awareness counts, alerts, and markers remain Montgomery-only while Montgomery is selected.

This resolves user confusion without weakening V619-V623 containment.

## 4. County Ownership Model

The intended model separates viewing context, local awareness context, report ownership, render ownership, and supporting asset ownership.

| Term | Intended Meaning | Source of Truth | Should It Change During Out-of-Selected-County Report? |
| --- | --- | --- | --- |
| `activeCounty` | Current viewing/awareness county context | Selected awareness area / active county resolver | No, unless product chooses explicit switch behavior |
| `activeTown` | Current selected local awareness area, such as Conroe | Selected awareness area label/storage value | No, unless switching county/area intentionally |
| `reportCoordinateCounty` | County containing the tapped/report coordinate | `gridlyResolveCountyIdForCoordinate(lat, lng)` | Yes; it follows the coordinate |
| `reportSubmitCounty` | County written into the live report payload | `gridlyGetCoordinateScopedReportMetadata(lat, lng)` | Yes; it should equal coordinate county for supported coordinates |
| `visibleCounty` | County used by current filter/render/awareness context | `activeCounty` or explicit All/cross-county mode | No in county mode; maybe multiple in future All mode |
| `crossingSourceCounty` | County whose crossing assets are loaded/clickable | Active county runtime sources | Usually active county; not report coordinate county |
| `roadResolverCounty` | County whose road assets/resolver context names road hazards | Ideally report coordinate county for report naming; active county for search/view context | For report construction, should follow report coordinate county; for view labels, must not leak inactive counties unintentionally |

Important separation:

- `activeCounty` answers “what county am I viewing?”
- `reportCoordinateCounty` answers “where did the driver tap?”
- `reportSubmitCounty` answers “where does this report belong in storage?”
- `visibleCounty` answers “which county's reports should render/count now?”
- `crossingSourceCounty` answers “which county's crossing inventory is wired?”
- `roadResolverCounty` answers “which county's road naming assets should interpret this coordinate?”

## 5. Current County Switching Contract

### 5.1 V619 Context Containment

V619 established that selected awareness area should own county context. Montgomery/Conroe selection should keep active county, active town, labels, and map context contained instead of leaking Liberty defaults.

**Now working:** selected Montgomery/Conroe can remain Montgomery/Conroe through context containment checks.

### 5.2 V620 Destination Search Containment

V620 established bounded destination search for the selected county context.

**Now working:** Montgomery destination search is constrained against Liberty/Harris leakage by active county/search bounds diagnostics.

### 5.3 V621 Runtime Ownership Containment

V621 expanded runtime ownership checks across text, state, search, route, crossing source, and report-registration status.

**Now working:** active runtime samples can prove awareness, alert, popup, route context, crossing source, destination context, and checked state surfaces are owned by the active county instead of stale Liberty defaults.

### 5.4 V622 Report Visibility Pipeline Diagnostics

V622 added first-drop diagnostics for accepted reports moving through local registration, active/shared inventories, active-county filtering, cluster input, alert input, marker input, and awareness counting.

**Now working:** accepted report diagnostics can identify where a report leaves the downstream pipeline instead of only saying “not visible.”

### 5.5 V623 Coordinate-Based Report Ownership

V623 changed/validated report ownership to follow tapped coordinate county instead of forcing active county.

**Now working:** Montgomery-selected + Montgomery-coordinate reports submit as Montgomery; Montgomery-selected + Liberty-coordinate reports submit as Liberty; unsupported coordinates fail closed.

## 6. Remaining Known Blockers

### 6.1 Out-of-Selected-County Report UX/Visibility Undefined

Ownership is now correct, but user experience is undefined when a driver reports in a supported county that is not currently selected. The report is accepted and locally registered, then hidden from the active county visible set by design. The app needs an explicit UX policy.

### 6.2 Montgomery Road Naming Still Poor

Observed labels include:

- “Road Hazard on Conroe”
- “Local Road Impact Shared Report”

This suggests Montgomery report ownership can succeed while road resolver/display naming remains underpowered. The likely gap is road asset/resolver coverage or handoff between coordinate county, road resolver county, and display builders.

### 6.3 Historical Panel Leak

Dayton historical cards remain visible while Montgomery/Conroe is active. This is a containment leak in historical/demo/rendered panel content. It must be fixed without enabling historical reads, history UI, dashboards, APIs, DriveTexas, or Transportation Intelligence.

### 6.4 Montgomery Crossings Not Wired

Railroad base-map features may be visible, but Gridly Montgomery crossing markers/clicks are not fully wired. This likely reflects missing or unavailable county-owned crossing source data rather than a report ownership issue.

### 6.5 Marker Render Audit May Not Confirm Rendered Marker

`gridlyReportVisibilityPipelineAudit()` can show a report is countable and present in marker input, but `markerRendered` depends on observable `unifiedIncidentLayer` layers. If layer rendering is async, unavailable, or not annotated with matching report IDs, the audit may not prove final marker render even when the pipeline is otherwise healthy.

## 7. Audit Coverage Map

| Helper | What It Proves | What It Does Not Prove |
| --- | --- | --- |
| `gridlyCountyContextContainmentAudit()` | Selected awareness area, active county, active town, and context containment are aligned. | It does not prove report coordinate ownership, Supabase writes, marker rendering, or crossing asset completeness. |
| `gridlyDestinationSearchContainmentAudit(query)` | Destination search is bounded to the selected county/search context and flags Liberty/Harris leakage under Montgomery. | It does not prove report submission, road resolver quality, marker rendering, or historical containment. |
| `gridlyCountyRuntimeOwnershipAudit()` | Runtime language/state/search/route/crossing-source ownership surfaces are active-county-safe; passive county selector options are exempted. | It does not prove a just-submitted report is rendered as a marker, nor does it decide cross-county report UX. |
| `gridlyReportVisibilityPipelineAudit()` | For the last accepted report, checks accepted state, `activeHazards`, `activeReports`, shared inventory, active-county visible set, cluster input, alert input, marker input, marker-render observation, and awareness count. | It does not define product policy for out-of-selected-county reports; marker-render evidence may be inconclusive if layers are delayed/unavailable. |
| `gridlyMontgomeryReportSubmissionAudit()` | Active county, submit county, accepted/visible state, active-county-visible count, and Montgomery-oriented submission safety. | It is less general than the coordinate ownership audit and can classify out-of-active-county ownership as not safe for active-county visibility, which is expected under current policy. |
| `gridlyReportLocationCountyOwnershipAudit()` | Coordinate county resolution, submit county ownership, active-county forcing detection, accepted-outside-active-county state, and active-county visibility state. | It does not implement UX, switch counties, prove marker rendering, or prove road naming quality. |
| `gridlyCrossingPipelineAudit()` | Crossing pipeline availability/load/render signals for the active county. | It does not create crossing assets, prove report ownership, or fix road hazard labels. |
| `gridlyCrossingRenderAudit()` | Whether crossing markers/render state can be observed. | It does not prove base-map rail features are Gridly crossing markers and may not cover missing Montgomery crossing data. |
| `gridlyReferenceRoadResolverAudit(options)` | Reference-road resolver behavior and evidence for road naming. | It does not guarantee every Montgomery coordinate has a useful road label or that alert display copy uses the best resolver output. |
| `gridlyReferenceRoadEvidenceAudit(options)` | Evidence inputs/candidates available for reference-road naming. | It does not by itself change report display labels. |
| `gridlyRoadHazardLocationShadowAudit(options)` | Shadow comparison of road-hazard location behavior. | It does not prove production label quality unless paired with rendered display audits. |
| `gridlyRoadHazardLocationConsistencyAudit(options)` | Consistency of hazard location fields and display assumptions. | It does not supply missing Montgomery road data. |
| `gridlyRoadNameStandardizationAudit()` | Road-name standardization safety and text cleanup behavior. | It does not resolve missing/poor underlying road names. |
| `gridlyRoadClusterAudit(options)` | Road-hazard clustering, representative coordinates, rendered placement sample, and high-zoom placement risk. | It does not decide active-county visibility or out-of-county UX. |
| `gridlyHistoricalCanaryAudit()` | Historical canary/protected behavior status. | It does not prove no stale historical UI/demo cards render under the wrong county. |
| `gridlyHistoricalIntelligenceFinalRenderAudit(options)` | Final historical row rendering quality and weak rendered title/location examples. | It does not authorize historical reads/UI and does not enforce county containment alone. |
| `gridlyHistoricalIntelligenceExperienceAudit()` | Broad historical intelligence experience/readiness diagnostics. | It does not fix Dayton historical cards leaking into Montgomery/Conroe active context. |

## 8. Recommended Next Implementation Order

### A. Out-of-Selected-County Report UX/Visibility Policy

**Recommended first.** Ownership and registration are now behaving correctly, but the user experience is ambiguous. Implement the smallest safe UX contract first:

1. Keep coordinate-based ownership.
2. Keep active-county filtering strict.
3. Add clear success confirmation with report county: “Reported in Liberty County.”
4. Optionally add a non-invasive “View Liberty County” next action after separate UX approval.
5. Do not auto-render cross-county markers in Montgomery county mode unless explicitly choosing a temporary preview or All mode policy.

**Why first:** it resolves the current root confusion without weakening county containment.

### B. Montgomery Road Naming Resolver

**Recommended second.** Once the report UX is clear, improve label quality for Montgomery reports. Focus on coordinate-owned road resolver context and display handoff so labels stop falling back to city/generic names.

**Why second:** accepted Montgomery reports are useful only if alert/popup labels identify the road/location clearly.

### C. Historical Panel Containment

**Recommended third.** Fix Dayton historical cards appearing while Montgomery/Conroe is active, while preserving historical protected boundaries.

**Why third:** this is a visible county-containment leak, but it is separate from live report ownership and should be fixed without expanding historical capability.

### D. Montgomery Crossing Runtime Wiring

**Recommended fourth.** Wire or validate Montgomery county-owned crossing source data, marker creation, and click behavior.

**Why fourth:** crossings need county-owned assets. This is important, but it should not block live road-hazard ownership/UX clarity.

### E. Marker Rendered Evidence Reliability

**Recommended fifth.** Strengthen marker-render audit evidence so countable marker input can be traced to a rendered layer deterministically.

**Why fifth:** current audits are enough to find ownership/filtering drops. Render evidence reliability is valuable but should follow the product policy and naming/containment blockers.

## 9. Most Important Architecture Findings

1. **Report ownership and active viewing context are now intentionally separate.** A driver can report in Liberty while Montgomery is selected; the report belongs to Liberty because the coordinate belongs to Liberty.
2. **The current hidden-marker behavior is expected under strict active-county filtering.** The accepted Liberty report is hidden while Montgomery remains selected because `visibleCounty = activeCounty` in county mode.
3. **The missing piece is UX policy, not another ownership patch.** The app should explain “Reported in Liberty County” or explicitly switch/preview/all-mode by product decision.
4. **Montgomery road naming is a separate downstream quality problem.** Ownership can be correct while labels remain generic or city-based.
5. **Historical and crossings are separate containment/wiring blockers.** Dayton historical leakage and missing Montgomery crossing markers should be handled after the reporting UX contract is settled.
6. **Marker-render audit evidence is useful but incomplete.** Marker input/counting can be proven more reliably than final rendered layer observation.

## 10. Merge Recommendation

Merge V624 as a documentation-only architecture audit. It creates a shared root-cause map and recommends that the next implementation milestone define the out-of-selected-county reporting UX policy before more downstream fixes are made.
