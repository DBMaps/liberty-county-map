# GRIDLY County Platform Readiness Audit V458

## 1. Executive Summary

V458 is an audit-only follow-up to V457. No production code, UI behavior, migrations, historical reads, DriveTexas activation, or transportation-intelligence activation were changed.

**Conclusion:** Liberty is ready to be treated as **County #1** for beta framing, provided that it remains the only visible county and the current Liberty fallback remains intentional. The codebase already has a small but real county-aware spine: a default county id, a registry entry, county-scoped metadata helpers, county filtering/fallback helpers, county-aware static path indirection, and a storage-readiness audit helper.

**County #2 is not ready to evaluate visibly.** The main blockers are not missing UI widgets; they are missing activation architecture, multi-county data packaging, county-specific awareness-area configuration, storage migration policy, source-governance rules, and proof that report reads, historical capture, Route Watch, crossings, hazards, and alert surfaces cannot leak Liberty assumptions into another county.

Protected boundaries remain preserved by audit finding:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`

DriveTexas remains **Designed / Validated / Governed / Paused**.

## 2. Audit Method

Reviewed repository files and searched for county, Liberty, storage, Supabase, awareness, Route Watch, crossing, hazard, historical, and audit-helper assumptions. Primary evidence included:

- `js/app.js` county registry, storage helpers, Supabase metadata helpers, crossing/roadway paths, awareness copy, localStorage access, reporting, Route Watch, and audit helpers.
- `js/gridlyTxdotService.js` external transportation-source prototype filtering and Liberty corridor assumptions.
- `js/history-capture/*` historical capture, historical intelligence, and historical awareness boundaries.
- `data/*` static Liberty County boundary, roadway, rail crossing, crossing override, and Route Watch geometry fixture files.
- `supabase/migrations/*` county metadata and historical schema governance.
- V457 roadmap and related route/historical/county-aware documentation.

Validation commands were documentation-safe only: `git diff -- GRIDLY-COUNTY-PLATFORM-READINESS-AUDIT-V458.md`, `git diff --check`, and `git status --short`.

## 3. County Platform Readiness Score

**County #1 readiness: 7 / 10.** Liberty can be framed as County #1 because current behavior already defaults to `liberty-tx`, preserves missing-county Liberty compatibility, and has county metadata helpers.

**County #2 visible-evaluation readiness: 3 / 10.** Architecture intent exists, but another county cannot safely become active until county selection/activation, data contracts, storage policy, awareness areas, external source rules, and containment tests are planned and proven.

## 4. Liberty-Specific Assumption Inventory

| Finding | Evidence | Classification | Rationale |
| --- | --- | --- | --- |
| Default county is hardcoded to `liberty-tx`. | `GRIDLY_DEFAULT_COUNTY_ID` and the only registry entry are Liberty. | A. Acceptable County #1 Default | Safe for beta and preserves current behavior. Must remain explicit fallback until migration is planned. |
| Registry contains Liberty name, state, default city, boundary, crossings, road segments, overrides, and planned future county folder paths. | Registry paths point to `data/liberty-county-*` plus planned `data/counties/liberty-tx/*`. | B. County Configuration Candidate | This is the correct shape for county config, but needs a governed registry and activation lifecycle before County #2. |
| Static data files are Liberty-specific. | `data/liberty-county-boundary.geojson`, `data/liberty-county-road-segments.geojson`, `data/liberty-county-rail-crossings.geojson`, and `data/gridly-crossing-review-overrides.json`. | B. County Configuration Candidate | Safe for County #1, but County #2 needs equivalent packaged files and a normalized folder convention. |
| FRA crossing source is fixed to Texas / Liberty in the registry URL. | `crossingsPath` uses `statename=TEXAS&countyname=LIBERTY`. | B. County Configuration Candidate | Acceptable as config for Liberty; each future county needs its own source contract and fallback. |
| Boundary constant name remains `LIBERTY_COUNTY_BOUNDARY_URL`. | Constant resolves from active county config but retains Liberty-specific name. | B. County Configuration Candidate | Behavior is county-aware enough for County #1; naming should normalize before multi-county work to reduce implementation errors. |
| Awareness fallbacks use “Liberty County”. | Awareness summary and panel defaults fall back to Liberty County in multiple copy paths. | B. County Configuration Candidate | Safe while Liberty is the only active county; must become active-county copy before County #2. |
| Awareness area model is town/place based and appears Liberty-local. | Home town / awareness area storage and summaries rely on selected local places such as Dayton/Hull-style examples. | B. County Configuration Candidate | Should become county-owned awareness-area configuration. |
| localStorage keys are mostly global. | Keys include `gridlyDeviceId`, `gridlyProfile`, `gridlyHomeTown`, `gridlyHome`, `gridlyWork`, saved places, settings, map style, smart alerts, crossing review storage, and feedback log. | B. County Configuration Candidate | Safe for County #1, but County #2 needs a migration/namespace policy to avoid cross-county preference bleed. |
| A county-scoped storage-key helper exists but is not universally adopted. | `gridlyBuildCountyStorageKey(baseKey, countyId)` exists and the readiness audit samples `gridlyEventHistoryV1:liberty-tx`. | B. County Configuration Candidate | Good foundation; adoption policy is required before additional counties. |
| Supabase report metadata can write `county_id` and `state`. | Insert keys include `county_id` and `state`; helper strips metadata for legacy schema fallback. | A. Acceptable County #1 Default | Backward-compatible and safe for Liberty beta. County #2 needs read/query containment proof. |
| Missing report county falls back to Liberty only when active county is default. | `gridlyReportMatchesActiveCounty` returns true for missing county only under default county. | A. Acceptable County #1 Default | This protects historical Liberty rows while hiding unknown-county rows from Liberty view. |
| TxDOT prototype defaults to county number `146` and Liberty corridors. | Service defaults `countyNum` to 146 and corridor list to US 90, TX 146, TX 321, FM 1960, FM 1409, FM 1008. | C. County #2 Blocker | Safe only because DriveTexas remains paused; must not become active without county-specific source config. |
| Route Watch fixtures are synthetic Liberty County-style corridors. | Fixture documentation states synthetic Liberty County-style LineStrings. | A. Acceptable County #1 Default | Audit/shadow fixtures are acceptable as County #1 validation data, not production County #2 evidence. |
| Historical intelligence is internal-only with protected reads/UI/API disabled. | Engine returns `internalOnly: true`, false historical-read/UI/API flags, and DriveTexas paused audit state. | A. Acceptable County #1 Default | Safe containment. County #2 needs county metadata propagation through captures before activation. |
| Crossings are loaded from active county config with remote and local fallback. | `FRA_URL`, local crossings, overrides, and roadway segment URLs derive from active county config. | A/B | Strong County #1 behavior and good config candidate; County #2 needs data readiness and fallback validation. |
| Audit helpers already check county storage readiness. | `gridlyCountyStorageReadinessAudit` checks registry count, Liberty fallback, unknown county hiding, static path config, metadata, and sample storage key. | A. Acceptable County #1 Default | Strong existing containment evidence, though not enough alone for County #2. |

## 5. County Configuration Candidate Inventory

These should eventually move into a governed county registry or county package:

1. County id, label, state, default city, startup map center/zoom, and county boundary.
2. Awareness areas / towns / localized place labels and default fallback copy.
3. Rail crossing source URL, local crossing fallback, crossing overrides, and crossing label-review decisions.
4. Roadway segment GeoJSON and road-name normalization expectations.
5. External transportation-source county identifiers and corridor allowlists.
6. localStorage key policy: global keys, county-scoped keys, migration, and legacy Liberty fallback.
7. Supabase county metadata query contract and legacy-null interpretation.
8. Route Watch fixture sets and route-corridor QA expectations per county.
9. Historical capture metadata: active county id, state, awareness area, source category, and suppression rules.
10. UI copy strings that mention Liberty County or assume a single county.
11. Audit helper expected values and County #2 readiness assertions.

## 6. County #2 Blocker Inventory

1. **No activation lifecycle.** There is no visible-go-live/deactivate/rollback process for another county.
2. **No county selection/detection policy.** Active county can be overridden by `window.GRIDLY_ACTIVE_COUNTY_ID`, but there is no product flow, governance, or invalid-county UX.
3. **Only one registry entry.** County #2 cannot be evaluated without a second config and equivalent static assets.
4. **Awareness areas are not proven county-configured.** Town/place defaults can bleed Liberty copy into another county.
5. **Storage namespace is incomplete.** County-scoped helper exists, but many localStorage keys remain global.
6. **Read containment needs proof.** Supabase writes include county metadata, but County #2 needs query/read filtering evidence across reports, alerts, Route Watch, feedback, and historical capture.
7. **DriveTexas/TxDOT prototype is Liberty-number/corridor specific.** Must remain paused until source governance and county containment exist.
8. **Crossing and roadway data readiness is Liberty-only.** County #2 needs boundary, rail, crossing overrides, road segments, source fallback, and QA fixtures.
9. **Historical capture county propagation needs explicit audit.** Historical reads/UI/API are closed, but future capture rows need county context before multi-county evaluation.
10. **Audit helper expectations are Liberty-centered.** Existing helper validates Liberty fallback, not full County #2 activation safety.

## 7. Existing County-Aware Strengths

- A first-class `GRIDLY_DEFAULT_COUNTY_ID` and registry object exist.
- Active county helpers normalize invalid/missing county ids back to Liberty.
- Static county paths are read through active county config.
- Report metadata helper emits `county_id` and `state`.
- Missing-county rows are interpreted as Liberty only for default-county compatibility.
- Unknown county rows are hidden from the Liberty active-county view.
- A storage-key builder already models `baseKey:countyId` naming.
- A county storage readiness audit helper explicitly checks fallback, static paths, metadata, and safe-to-add-next-county prerequisites.

## 8. Existing Containment / Fallback Strengths

- Legacy Supabase schema fallback strips `county_id` and `state` if the schema cache does not support them.
- Crossing loading attempts remote data and falls back to local curated data.
- Historical intelligence is generated as internal-only evidence with reads/UI/API disabled.
- Route Watch geometry scoring remains shadow/audit-oriented and non-mutating.
- TxDOT/DriveTexas service remains prototype/paused rather than a production awareness input.
- Missing county metadata preserves Liberty behavior instead of breaking legacy rows.
- Invalid active county ids normalize to `liberty-tx` rather than introducing an unknown active context.

## 9. System-by-System Review

### Onboarding / setup

- Current onboarding is effectively single-county and awareness-area oriented.
- **Classification:** B. County Configuration Candidate.
- **Before County #2:** define county activation, selection/detection, default county, invalid county handling, and support messaging.

### Awareness Brief

- Awareness copy uses active area names but has Liberty County fallback copy.
- **Classification:** B.
- **Before County #2:** awareness-area list, copy fallbacks, and localized labels must be county config.

### Community Pulse

- Pulse can summarize selected awareness areas, but locality defaults are Liberty-shaped.
- **Classification:** B.
- **Before County #2:** county-scoped pulse inputs and area containment must be validated.

### Alert Cards

- Alert card metadata includes awareness area, crossing id, hazard type, coordinates, and source-derived fields.
- **Classification:** B.
- **Before County #2:** ensure alert cache/read sources only include active-county records.

### Route Watch

- Route Watch has strong shadow/audit controls and route relevance work, but saved places and home/work storage remain global.
- **Classification:** B; County #2 blocker if visible activation depends on saved routes.
- **Before County #2:** saved places, selected place, home/work, route geometry, and relevance audits need county namespace or migration rules.

### Reporting

- Report insert metadata includes county id/state with legacy retry fallback.
- **Classification:** A for County #1, B for expansion.
- **Before County #2:** prove county-filtered reads, feedback county metadata, and mixed legacy/new row behavior.

### Historical Capture

- Historical capture boundaries are protected and internal-only.
- **Classification:** A for current beta, B for expansion.
- **Before County #2:** capture envelopes must carry active county context and never merge multi-county evidence without intent.

### Historical Awareness

- Historical awareness language and reads remain closed to consumers.
- **Classification:** A.
- **Before County #2:** county-scoped evidence and language fallback audits are needed before any historical UI/API exposure.

### Crossings

- Crossings are driven by active county paths and have remote/local fallback, but data is Liberty-only today.
- **Classification:** B.
- **Before County #2:** add equivalent county crossing files, source URLs, override ownership, and fallback tests.

### Hazards / roadway data

- Roadway segments are loaded through county config, but only Liberty data is present.
- **Classification:** B.
- **Before County #2:** county road segments, name normalization, hazard categories, and awareness-area resolution must be county-contained.

### Static data files

- Static data is Liberty-specific with a planned normalized folder structure noted in config.
- **Classification:** B.
- **Before County #2:** create data package contract, not just file naming.

### localStorage

- Many keys remain global, while a county-scoped helper exists.
- **Classification:** B/C depending on feature.
- **Before County #2:** define which keys are global identity/preferences vs county-scoped awareness, route, history, reports, and saved-place state.

### Supabase metadata

- Schema includes optional county metadata for reports/feedback; client has legacy fallback.
- **Classification:** A/B.
- **Before County #2:** establish read filters, indexes/policies if needed, and migration behavior for null county rows.

### Audit helpers

- Strong Liberty fallback audit exists; route/historical/crossing audits are non-mutating.
- **Classification:** A for County #1, B for expansion.
- **Before County #2:** add County #2 dry-run assertions for unknown/known county isolation and county data packages.

### UI copy

- Liberty County still appears in fallbacks and docs; product copy is not fully platform-neutral.
- **Classification:** B.
- **Before County #2:** inventory and move visible county names into active county context/config.

### External source assumptions

- FRA crossing URL is Liberty-specific through config; TxDOT prototype has hardcoded Liberty county number/corridors.
- **Classification:** B for FRA, C for TxDOT if activated.
- **Before County #2:** source authority, freshness, terms, county containment, corridor rules, and pause/rollback policy.

## 10. County #1 Promotion Assessment

**Yes — Liberty is ready to be treated as County #1.**

Caveats:

- County #1 framing should be product/roadmap framing, not a production behavior change.
- Liberty fallback must remain protected for legacy rows, storage, and user expectations.
- The registry should be treated as the seed of a county configuration system, not as complete activation architecture.
- DriveTexas and transportation intelligence must remain paused.
- Historical reads/UI/API must remain closed.

## 11. County #2 Readiness Assessment

County #2 cannot be safely evaluated until the platform has:

1. A county activation architecture and rollback policy.
2. A second county registry entry and static data package.
3. County-aware awareness-area configuration.
4. localStorage namespace/migration rules.
5. Supabase read/write county containment proof.
6. Route Watch saved-place and route-state county containment.
7. Crossing, roadway, hazard, and alert-card fixture validation for the second county.
8. External source governance that keeps DriveTexas/TxDOT paused unless specifically authorized.
9. Audit helpers that validate multi-county isolation, not just Liberty fallback.

## 12. Recommended Next Milestone

**Recommended: V459 County Activation Architecture Plan.**

V459 should define county registry governance, active county lifecycle, activation/deactivation rules, data-package contracts, onboarding/selection policy, localStorage scoping, Supabase read/write containment, audit helper expectations, and rollback criteria.

V460 Liberty County #1 Normalization Plan should follow V459 and translate this audit into a concrete plan for moving Liberty-specific defaults into explicit county configuration while preserving current behavior.
