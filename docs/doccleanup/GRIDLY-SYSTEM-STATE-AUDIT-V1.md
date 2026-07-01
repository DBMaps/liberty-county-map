# Gridly System State Audit V1

Branch: `V355-SYSTEM-STATE-AUDIT`  
Date: 2026-06-16  
Milestone type: Audit-only  
Production behavior changed: No

## Executive Summary

Gridly's current product state is best described as **awareness-platform stable with monitoring required around live validation and Route Watch readiness**.

The recent stabilization stack appears to have successfully aligned the active community incident chain around the reported target state:

- 4 active road hazards.
- 1 active blocked crossing.
- 5 active incidents.
- 5 alert rows.
- 5 markers.
- 5 awareness count.

The repository supports this as the intended current authoritative state through code and audit evidence showing:

- Road-hazard rows flow from Supabase shared reports into `activeHazards`, then generated road incidents, unified incidents, alert surfaces, awareness, and markers.
- Crossing reports remain owned by crossing-specific marker rendering, while unified incidents retain the data for alerts, diagnostics, Route Watch, and awareness.
- V313 road-hazard wording is now evidence-gated, reducing false intersection precision from proximity-only road references.
- V310.4 resolved the duplicate blocked-crossing marker ownership problem by assigning active rail/crossing marker ownership to `crossingLayer`.
- V309 accepted visible crossing behavior as passing, with one known audit discrepancy in `gridlyCrossingRenderAudit`.

The audit also found important boundaries:

- Live Supabase inventory could not be re-read from this container because the prior active-hazard inventory audit documents outbound Supabase access failure in this environment.
- DriveTexas is not production-active. It has architecture, contracts, normalization, validation, replay testing, and governance, but no production ingestion/rendering/alert/awareness/route ownership.
- Route Watch has significant architecture and validation assets, but functional readiness remains conditional on activation, OSRM success, route geometry retention, and route preview rendering.
- Existing audit inventory is broad but noisy: authoritative recent audits exist, older duplicate audit files exist, and some audit helpers are known to be inaccurate or environment-sensitive.

## System-by-System Findings

### 1. Community Hazard System

#### What is working

- **Road-hazard ingestion path is defined and centralized.** Shared Supabase rows are normalized into in-memory report arrays, with road hazards owned by `activeHazards` and generated into live road incidents.
- **Road-hazard rendering path is present.** `renderRoadHazards()` renders top road-hazard information from unified incident state.
- **Alert and awareness surfaces consume active incident state.** The alert snapshot pipeline merges active unified incidents and filtered active hazards, then builds alert cards and counts.
- **Evidence-aware road-hazard wording is active.** V313 prevents proximity-only road references from being promoted into `at <road>` intersection wording.
- **Other Hazard subtype handling exists.** Structured metadata and subtype narrative builders exist for `other_hazard`, reducing generic copy risk.
- **Lifecycle replay suppression exists.** Cleared-hazard rehydration guard state and lifecycle classification helpers are present.

#### What is stable

- The source-owner chain is explicit: `loadSharedReports()` selects shared road-hazard rows into `activeHazards`, `getLiveHazardIncidents()` generates road incidents, and downstream alert/awareness surfaces consume those active incidents.
- V313 regression protections explicitly avoid changing crossing data, Route Watch, Supabase sync, lifecycle, marker rendering, awareness filtering, and alert panel layout.
- Active road-hazard marker ownership remains with unified incident rendering, not crossing marker arbitration.

#### What remains fragile

- **Live validation depends on reachable Supabase.** The latest local inventory audit could not query Supabase from the container.
- **Road identity still depends on resolver/candidate quality.** V311 documents nearest-road candidate ambiguity around Waco Street, US 90, and Sawmill Road.
- **Lifecycle state is broad and complex.** Confirmation counts, cleared rows, local history, recent-cleared visibility, and replay suppression are distributed across several helpers.
- **Audit state can lag rendered state.** Cached alert arrays and DOM can remain visible until rerender, which is useful for UI stability but fragile for audit interpretation.

#### Known risks

- A stale or unreachable Supabase read can make local validation inconclusive even if production is healthy.
- Proximity-only road identity can still affect `near` wording and route/awareness diagnostics, even though V313 blocks false `at` wording.
- Developer cleanup helpers are powerful and must remain confirm-gated.

#### Known technical debt

- Large single-file JavaScript architecture makes source ownership hard to reason about.
- Hazard, alert, awareness, marker, and Route Watch diagnostics are numerous but not always consolidated into one authoritative runtime status.
- Several older audits overlap in scope and should be treated as historical unless superseded by the recent V309-V313 stabilization documents.

### 2. Supabase System

#### Submit path status

**Partially validated / needs monitoring.** The code initializes a Supabase client from the public URL/key, subscribes to `public.reports`, and reloads shared reports on realtime changes. Current context reports that Supabase submit health was recently stabilized, but this audit did not perform a live write because the milestone is read-only.

#### Sync status

**Partially validated.** Sync architecture is present: Supabase client initialization, `reports` table reads, normalized active arrays, and realtime reload hooks. The active-hazard inventory document reports the container could not complete live Supabase inventory due to outbound fetch failure.

#### Realtime status

**Partially validated.** Realtime channel wiring exists and subscribes to all `postgres_changes` on `public.reports`, calling `loadSharedReports("realtime_postgres_change")`. Runtime subscription success must still be validated in-browser or in a network environment that can reach Supabase.

#### Fallback status

**Partially validated.** The app has local/in-memory arrays, local cleanup helpers, cached alert arrays, and graceful sync status messages when Supabase JS is absent or initialization fails. These are fallbacks for user experience and diagnostics, not full substitutes for shared report persistence.

#### Validated / partially validated / unvalidated

- **Validated:** Supabase initialization and realtime subscription code paths exist; no syntax error was found by `node --check js/app.js`.
- **Partially validated:** Active row ingestion and count reconciliation are supported by recent context and source-owner audits, but not live-requeried from this container.
- **Unvalidated in this audit:** Live submit write, live PostgREST read, live realtime event delivery, row-level security behavior, and multi-device propagation.

### 3. Alert System

#### Alert generation status

**Needs Monitoring.** Alerts are generated from active unified incident/intelligence state, grouped by cluster key, priority-scored, and filtered by selected awareness area. Recent context says 5 active incidents produced 5 alert rows.

#### Alert rendering status

**Stable with monitoring.** Alert surface builders exist for active alert cards, grouping, hidden counts, alert headings, and mobile native alert center content.

#### Alert ownership status

**Mostly stable.** Alerts consume unified incidents and active hazards/crossing reports; marker ownership arbitration no longer removes unified rail incident data from alerts.

#### Alert count status

**Stable in current reported state.** The current context says 5 active incidents, 5 alert rows, 5 markers, and 5 awareness count. Code supports alert counts from `getAlertsSurfaceSnapshot()` and `window.__gridlyLatestAlertsForRender`.

#### Known issues / potential issues / unresolved questions

- **Known issue:** Older visual consistency audits may produce false positives when they include non-alert settings/Route Watch polish checks.
- **Potential issue:** Alert grouping can hide duplicates intentionally, so raw rows, grouped cards, and visible cards must be compared carefully.
- **Unresolved:** Live browser validation is still required to confirm the exact 5-row alert state after network sync.

### 4. Awareness System

#### Top Awareness ownership

**Stable with monitoring.** Top Awareness now prioritizes reusable existing alert wording and active road-hazard candidates, with rejection paths for stale/generic crossing or rail text.

#### Location Awareness

**Stable.** Awareness area definitions, selected area filtering, and area-scoped activity summaries exist. The awareness summary separates hazards and reports in the selected area and warns when coordinates are missing.

#### Route Awareness

**Needs Monitoring.** Route-aware intelligence exists, but Route Watch functional readiness is a prerequisite for trustworthy route-specific conclusions.

#### Community Pulse ownership

**Stable with monitoring.** Community Pulse is driven from active hazards, active reports, crossing inventory, selected awareness area, and community activity counts.

#### Known limitations / unresolved ownership concerns

- Route Awareness should not overstate route relevance when Route Watch geometry is missing or fallback-only.
- Area filtering depends on coordinates or crossing inventory links; missing coordinates create warnings and can affect locality counts.
- Top Awareness should continue to reuse alert wording only when the candidate is classified as an actual alert item rather than a generic container or stale rail summary.

### 5. Marker System

#### Rendering status

**Stable with monitoring.** Road-hazard markers render through unified incident layers. Active blocked crossing marker ownership belongs to `crossingLayer`.

#### Visibility status

**Stable in current reported state.** Current context reports 5 markers for 5 active incidents.

#### Consistency status

**Improved / needs monitoring.** V310.4 resolved duplicate active blocked-crossing marker rendering by suppressing only the duplicate unified marker when a crossing marker already represents the same active rail/crossing report.

#### Crossings

- Crossing markers remain owned by `crossingLayer`.
- V309 accepted visible crossings, tappability, and popups as passing.
- `gridlyCrossingRenderAudit` has a known marker-count discrepancy and should not be used as a blocker until corrected.

#### Hazards

- Road hazard markers remain owned by `unifiedIncidentLayer`.
- Road hazard marker rendering was explicitly preserved by V310.4.

#### Clustering / grouping behavior

- Alerts group by alert cluster key and select lead cards by severity/rank/freshness.
- Hazard incidents group source reports by hazard cluster key.
- Marker grouping/clustering should continue to be validated visually because alert grouping and marker ownership solve different problems.

### 6. Crossing System

#### Reporting status

**Needs Monitoring.** Crossing report arrays and confirmation counts exist, and recent context says one blocked crossing is active. This audit did not submit a crossing report.

#### Rendering status

**Stable with known audit discrepancy.** V309 accepted that crossings are visible, tappable, and popups open, while classifying `gridlyCrossingRenderAudit` reporting zero markers as an audit accuracy issue.

#### Alert status

**Stable with monitoring.** Unified rail/crossing incidents continue feeding alerts after marker arbitration.

#### Awareness status

**Stable with monitoring.** Crossing reports contribute to selected-area awareness and community activity when active and locatable.

#### Validated / partially validated / unresolved

- **Validated:** Crossing visual ownership decision and V309 visible-behavior baseline are documented.
- **Partially validated:** Current 1 blocked crossing state is reported by recent validation but not live-requeried here.
- **Unresolved:** The crossing render audit marker-count discrepancy remains audit technical debt.

### 7. Route Watch

#### Setup status

**Needs Monitoring.** Route Watch setup, saved places, selected start/destination, and activation states are represented in code and audits.

#### Rendering status

**Needs Monitoring.** V298 says route geometry readiness requires at least two route vertices plus preview/render evidence.

#### Intelligence status

**Needs Work before stronger claims.** Route intelligence architecture and geometry validation are extensive, but V298 explicitly warns not to continue geometry scoring unless Route Watch is functional.

#### Stable

- Architecture and audit helpers exist.
- Geometry validation scripts demonstrate local route geometry availability and retained-geometry shadow scoring value.

#### Unstable

- Real-device observation in V298 showed `routeWatchActive: false`, OSRM failure, fallback route source, zero vertices, and no rendered preview.
- `scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs` failed in this environment with `legacy recorder should evaluate one candidate`.

#### Needs validation

- Live activation.
- OSRM route generation.
- Route geometry retention.
- Preview layer rendering.
- Runtime shadow observation after route geometry exists.

### 8. Audit Coverage

#### Authoritative audits

Treat these as the current authoritative stabilization set:

- `docs/status/GRIDLY_V309_STABILITY_BASELINE_VALIDATION.md` — crossing and portrait stabilization baseline.
- `docs/GRIDLY_V310_4_BLOCKED_CROSSING_MARKER_OWNERSHIP_ARBITRATION.md` — current blocked crossing marker ownership.
- `docs/audits/GRIDLY_ACTIVE_HAZARD_INVENTORY_2026_06_16.md` — latest active hazard inventory attempt and Supabase reachability limitation.
- `docs/GRIDLY_V312_4_ROAD_HAZARD_LOCATION_STRATEGY_DECISION.md` — road-hazard location policy.
- `docs/GRIDLY_V313_ROAD_HAZARD_LOCATION_DESCRIPTION_IMPLEMENTATION.md` — production application of evidence-gated road-hazard wording.
- `docs/GRIDLY_V298_ROUTE_WATCH_FUNCTIONAL_READINESS_AUDIT.md` — Route Watch readiness gate.
- `docs/GRIDLY_V296_ROUTE_WATCH_GEOMETRY_RUNTIME_SHADOW_AUDIT.md` and route geometry scripts — Route Watch geometry shadow evidence, not production activation.

#### Duplicate audits

The inventory command showed duplicate audit paths in output because `find docs docs/audits ...` traversed `docs/audits` twice. Beyond command duplication, many historical V140-V144 and V260-V276 audits overlap in incident sources, commute intelligence, reporting, render breakdowns, and Route Watch display. They should be considered historical unless a recent stabilization document references them.

#### Obsolete audits

Older audits that predate V309-V313 should not override:

- V309 crossing baseline.
- V310.4 marker arbitration.
- V312.4/V313 road-hazard wording policy.
- Current reported count reconciliation.

#### Audit gaps

- Live read-only Supabase count validation from a reachable environment.
- Single authoritative dashboard for active hazards + crossing reports + alerts + markers + awareness count.
- Browser-console replay of all current helper audits after the current deployment loads.
- Audit cleanup for known crossing marker count false negative.
- Route Watch functional readiness rerun after activation/generation/preview fixes.

### 9. Known Risks

#### High Risk

1. **Live Supabase validation gap in this environment.** The latest active-hazard inventory audit could not complete a live PostgREST read due to fetch failure, so current live counts require browser or reachable-network confirmation.
2. **Route Watch can over-promise if route geometry is unavailable.** V298 documents a real-device state with inactive Route Watch, OSRM failure, fallback route source, zero vertices, and no preview rendering.

#### Medium Risk

1. **Crossing render audit false negative.** V309 documents that `gridlyCrossingRenderAudit` reports zero markers despite accepted visible crossing behavior.
2. **Road identity ambiguity.** V311 shows nearest-road ranking can prefer one road over a more useful human crossing/road reference depending on coordinates.
3. **Distributed lifecycle logic.** Active, cleared, recently cleared, confirmation, and replay suppression logic span multiple helpers and local/shared state.
4. **Alert grouping/count interpretation.** Raw records, grouped alert cards, hidden alert counts, and rendered marker counts can diverge by design if interpreted without the owning audit context.

#### Low Risk

1. **Audit inventory noise.** Many historical audits exist; this is manageable if V309-V313 are treated as authoritative.
2. **DriveTexas architecture misunderstood as production.** The repo contains TxDOT/DriveTexas service and validation assets, but production rendering/alerts/awareness/route impacts are not active.
3. **Local cleanup helper misuse.** Confirm-gated cleanup helpers are present; risk is low if confirm guards remain intact.

### 10. Current Product Readiness Scorecard

| Area | Status | Rationale |
| --- | --- | --- |
| Reporting | Needs Monitoring | Recent submit health is reported stable, but this audit was read-only and did not perform live submissions. |
| Hazards | Stable | Current counts are internally consistent, V313 wording is evidence-gated, and active hazard source ownership is defined. |
| Crossings | Stable | User-facing rendering/tap/popup baseline is accepted; only audit count discrepancy remains. |
| Alerts | Stable | Current count reconciliation reports 5 alert rows for 5 active incidents; grouping/ownership are coherent. |
| Awareness | Stable | Awareness-first ownership is reinforced; Top Awareness reuses valid alert wording and area filtering is present. |
| Route Watch | Needs Work | Functional readiness must be proven before route intelligence claims are strengthened. |
| Markers | Stable | Current marker count is reported consistent; crossing/hazard marker ownership is clarified. |
| Supabase | Needs Monitoring | Architecture exists and recent health is reported stable, but live read validation was blocked here. |
| DriveTexas | Unknown | Architecture and validation exist, but no production ingestion/rendering/alerts/awareness/route impacts are active. |

### 11. Recommended Priorities

#### Immediate Priorities

1. **Preserve the current stable count reconciliation.** Do not modify production hazard, crossing, alert, awareness, lifecycle, marker, Route Watch, DriveTexas, Supabase, HTML, CSS, or JavaScript behavior as part of this audit milestone.
2. **Run browser read-only validation in a reachable environment.** Confirm active hazards, blocked crossings, active incidents, alert rows, markers, and awareness count from the deployed app.
3. **Treat V309-V313 as the authoritative stabilization stack.** Avoid reopening older audit conclusions unless a current runtime validation contradicts them.
4. **Document any count mismatch with source ownership.** If counts drift, trace active hazards, active reports, unified incidents, alert render cache, marker layers, and awareness summary separately before changing code.

#### Near-Term Priorities

1. **Fix audit accuracy, not product behavior, for known false negatives.** The crossing render audit discrepancy should be corrected without changing crossing architecture or source priority.
2. **Consolidate a read-only state dashboard/audit.** Create one browser helper or documented checklist that reports hazards, crossings, alerts, markers, awareness, Supabase sync, and Route Watch readiness in one place.
3. **Revalidate Supabase from a reachable environment.** Perform read-only inventory and realtime status checks without writes.
4. **Route Watch functional readiness validation.** Rerun V298 helper after activation/generation/rendering are observable; do not resume geometry scoring work before that passes.

#### Deferred Priorities

1. **DriveTexas production activation.** Explicitly defer. Current DriveTexas state is architecture/validation/governance only.
2. **Major rewrites or framework migration.** Not supported by audit evidence.
3. **Directional display expansion.** Defer unless a future milestone demonstrates stable source data and route geometry readiness.
4. **Cosmetic polish chasing.** Defer while count reconciliation and system ownership remain the priority.

## Current Stability Assessment

Gridly is currently strongest as a **Know Before You Go awareness platform**:

- Community hazards and crossings can produce a coherent active incident picture.
- Alerts and awareness are aligned around active incident ownership.
- Marker ownership is clarified and currently consistent.
- Road-hazard wording is safer and less likely to overstate precision.

Gridly is less ready as a route-intelligence platform:

- Route Watch has substantial architecture and geometry validation, but runtime functional readiness is not yet proven enough to rely on route-specific intelligence as the primary product promise.
- Route Watch should remain second to awareness until activation, geometry, and preview rendering are consistently validated.

## Current Product Status

Current product status: **Mergeable as an audit-only documentation milestone**.

Reasoning:

- No production behavior was changed.
- The audit records current system ownership and stability boundaries.
- It does not recommend DriveTexas activation, major rewrites, framework migration, or speculative roadmap work.
- It supports the product philosophy: **Awareness Platform First; Route Intelligence Second**.

## Testing and Validation Performed

### Commands run

```bash
git switch -c V355-SYSTEM-STATE-AUDIT
```

```bash
find .. -name AGENTS.md -print
```

```bash
rg --files -g '!node_modules' -g '!android/.gradle' -g '!android/build'
```

```bash
rg -n "supabase|hazard|alert|awareness|Route Watch|routeWatch|marker|crossing|DriveTexas|txdot|clear|confirm|confirmation|cluster|group" js index.html docs/audits docs/status docs/*.md scripts -g '!node_modules'
```

```bash
node scripts/v291-route-watch-geometry-prototype.mjs
node scripts/v292-route-watch-geometry-validation.mjs
node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs
node scripts/v295-route-watch-geometry-fixture-expansion.mjs
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
node scripts/v311-road-name-regression-audit.mjs
```

```bash
node --check js/app.js
```

```bash
find . -maxdepth 3 -type f \( -name '*AUDIT*.md' -o -name '*AUDIT*.mjs' \) -not -path './node_modules/*' | sort | wc -l
```

```bash
find docs docs/audits scripts -maxdepth 2 -type f \( -name '*AUDIT*.md' -o -name '*audit*.mjs' -o -name '*AUDIT*.mjs' \) -not -path './node_modules/*' | sort
```

### Results

- Branch creation succeeded.
- No `AGENTS.md` files were found in or above the repo path by `find .. -name AGENTS.md -print`.
- Code and document review completed using ripgrep and targeted file reads.
- `node --check js/app.js` passed.
- Route Watch geometry scripts V291, V292, V294, V295, and V311 produced audit output.
- `scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs` failed with `Error: legacy recorder should evaluate one candidate`; this is recorded as a Route Watch audit/runtime-shadow validation issue, not a production behavior change.
- Audit inventory review counted 56 matching audit files at max depth 3, excluding `node_modules`.

## Final Conclusion

Gridly's current authoritative state is coherent enough to preserve and document. The community hazard, crossing, alert, awareness, and marker systems now appear internally aligned around the latest reported 5-active-incident state. Supabase and Route Watch should remain monitored because this audit did not perform live writes and the environment could not independently re-read Supabase active inventory. DriveTexas should remain non-production.

Recommended merge decision: **Merge this audit-only branch after reviewing the report.** The next work should be read-only validation and targeted audit accuracy cleanup, not product behavior changes.
