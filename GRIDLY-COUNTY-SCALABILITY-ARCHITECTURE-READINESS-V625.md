# GRIDLY County Scalability Architecture Readiness V625

## 1. Executive verdict

**Verdict: PARTIALLY COUNTY-SCALABLE.**

Gridly now has the beginnings of a county-scalable runtime contract: a county registry, per-county runtime source registry, county bounds lookup, coordinate-owned report metadata, active-county visibility filtering, destination-search containment, and audits for Montgomery leakage. However, the implementation is still materially **Liberty/Montgomery-shaped**, not county-platform-shaped. Adding a third active county today would require touching multiple runtime surfaces and would likely repeat the same failure modes discovered during Montgomery activation: missing roads/crossings, Liberty fallback text, static Liberty DOM labels, area/town hardcoding, and demo/historical surfaces that do not have county containment.

The root cause is not a single bug. The root cause is that **county activation is still a set of coupled runtime edits rather than a declarative county package contract with a gate**. The registry exists, but it does not fully own every county-dependent dependency.

## 2. County onboarding dependency tree

A safe new-county activation currently depends on all of the following:

1. **County registry entry**
   - Add a `GRIDLY_COUNTY_REGISTRY` entry with id, name, state, default city, operational/selectable flags, package paths, source availability, and blockers.
   - Risk: registry normalization falls back unknown or non-operational ids to Liberty, so an incomplete entry can silently become Liberty-owned.
2. **County bounds**
   - Add county bounds to `GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID` and make `gridlyGetCountyBoundsMetadata()`, `gridlyGetCountyBounds()`, and `gridlyResolveCountyIdForCoordinate()` resolve the county without Liberty fallback.
3. **Awareness areas/towns**
   - Add county-wide and town-level entries to `GRIDLY_AWARENESS_AREA_DEFINITIONS` and `GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY`.
   - Each area needs `countyId`, label, storage value, anchor lat/lng, radius/startup zoom, and source.
4. **Road assets**
   - Provide normalized road segment GeoJSON and point `roadSegmentsPath` to it.
   - `runtimeSourceAvailability.roads` must be `available` only after the asset exists and resolver evidence passes.
5. **Crossing assets**
   - Provide county-owned rail crossing data and optional overrides.
   - `crossingSource` should resolve from local county-owned crossings before remote fallback; missing crossings must not borrow Liberty.
6. **Destination search bounds**
   - County bounds must drive `getGridlyDestinationSearchContainmentContext(getGridlySearchMapContext())` so search results are constrained to the active county/search context.
7. **Road resolver support**
   - The road resolver must resolve report-coordinate county roads, not active-county roads, for report labels.
   - Missing roads cause generic labels such as local-road impact phrasing.
8. **Map fit bounds**
   - Startup and awareness fit bounds must target the active county and fail closed if bounds are missing, not fit to Liberty.
9. **Report coordinate ownership**
   - `gridlyResolveCountyIdForCoordinate(lat,lng)` must identify the tapped coordinate county and `gridlyGetCoordinateScopedReportMetadata()` must write that county metadata.
10. **Report visibility filtering**
    - `gridlyReportMatchesActiveCounty()` must render/filter only rows whose metadata belongs to the current visible county.
11. **Alert generation**
    - Alert inputs must consume active-county-filtered reports and county-owned incident/crossing sources.
12. **Awareness generation**
    - Awareness headers/counts/community pulse must use `activeCounty` and `activeTown`, not passive county options or out-of-active-county submissions.
13. **Static DOM county-owned labels**
    - Static markup that still says Liberty County or Dayton must either become runtime-bound or be formally Liberty-only.
14. **Historical/demo containment**
    - Historical and demo seed content must be suppressed or county-tagged while `historicalReadsEnabled` and `historyUiEnabled` remain false.
15. **Tests/audits**
    - Add or extend audits to prove registry, bounds, source availability, search containment, report ownership, visibility filtering, road naming, crossing rendering, and historical/demo containment for the new county.

## 3. Liberty-shaped assumptions inventory

| Finding | File/function | Risk | Blocks scaling? | Recommended fix pattern |
|---|---|---:|---:|---|
| Default county is hardcoded to `liberty-tx`. | `js/app.js` / `GRIDLY_DEFAULT_COUNTY_ID` | Unknown/non-operational counties normalize to Liberty, causing silent ownership leakage. | **Yes, for activation without a gate.** | Keep Liberty as product default only, but make missing county dependencies fail closed in activation/audit paths. |
| Registry contains only Liberty and Montgomery as operational counties. | `js/app.js` / `GRIDLY_COUNTY_REGISTRY` | Third county has no first-class runtime identity until code is edited. | **Yes.** | Move toward data/package-driven registry entries with required readiness fields. |
| Montgomery is operational/selectable even while roads and crossings are marked missing. | `js/app.js` / Montgomery registry entry | Users can enter a county whose key inventory surfaces are unavailable. | **Yes, for full county parity.** | Add activation gate that separates selectable preview from fully operational county activation. |
| Source registry falls back to Liberty for unknown county ids. | `js/app.js` / `gridlyGetCountyRuntimeSources()` | Missing county source may load Liberty assets. | **Yes.** | Return null/unavailable for known missing county packages; allow Liberty fallback only for explicitly defaulted app boot. |
| County normalization falls back to Liberty for unknown/non-operational values. | `js/app.js` / `gridlyNormalizeCountyId()` | Passive options or typos become Liberty instead of failing closed. | **Yes.** | Add strict normalization for ownership/source contexts and permissive normalization only for legacy UI defaults. |
| Report rows with no county metadata match Liberty when Liberty is active. | `js/app.js` / `gridlyGetReportCountyId()` and `gridlyReportMatchesActiveCounty()` | Legacy untagged reports can appear in Liberty; new counties cannot rely on equivalent behavior. | **Partial.** | Require county metadata for multi-county report visibility; quarantine unknown legacy rows. |
| Display normalization explicitly rewrites Liberty phrases for non-Liberty counties. | `js/app.js` / `normalizeGridlyCountyAwareDisplayText()` | This is a patch around Liberty-generated labels, not a generic label contract. | **Partial.** | Prevent Liberty text at source; use county-aware label builders rather than downstream replacement. |
| Invalid road-label regex includes Liberty-specific phrases. | `js/app.js` / `gridlyIsInvalidCountyAwareRoadLabel()` | Road-quality checks are tuned to Liberty/Montgomery symptoms. | **Partial.** | Replace with generic invalid label taxonomy plus county package aliases. |
| Other-hazard generic area rejection includes `liberty county`. | `js/app.js` / `getOtherHazardAwarenessAreaRejectionReason()` | Area validation is Liberty-specific and may miss third-county generic labels. | **Partial.** | Reject current county name dynamically and use county registry names. |
| Legacy constants are still named `LIBERTY_COUNTY_BOUNDARY_URL`. | `js/app.js` / runtime source constants | Naming signals that generic paths are still Liberty-retrofitted. | **No by itself, but high confusion risk.** | Rename to county-neutral constants in a later runtime patch. |
| Awareness areas are a single hardcoded array. | `js/app.js` / `GRIDLY_AWARENESS_AREA_DEFINITIONS` | Each county requires code edits; passive and active choices can mix. | **Yes, at scale.** | Move awareness areas into county packages or registry-owned arrays. |
| Home-area options are hardcoded only for Liberty and Montgomery. | `js/app.js` / `GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY` | Third county will have no settings choices unless code is patched. | **Yes.** | Derive options from county registry/package awareness definitions. |
| Bounds exist only for Liberty and Montgomery. | `js/app.js` / `GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID` | Coordinate ownership, fit bounds, and search containment fail for any third county. | **Yes.** | Require bounds before selectable/operational activation. |
| Map containment audit treats Liberty fallback as a known special risk. | `js/app.js` / `gridlyCountyContextContainmentAudit()` | Audit is Montgomery-specific instead of N-county generic. | **Partial.** | Audit “fallback to any non-active county,” not only Liberty fallback. |
| Crossing normalization stamps `LOCATION_DEFAULTS.county`. | `js/app.js` / `loadCrossings()` | Loaded crossings may carry default county text rather than active/source county metadata. | **Yes for crossing ownership.** | Stamp crossing rows with active county/source county config. |
| Roadway loader reads a startup constant instead of dynamically resolving per county. | `js/app.js` / `ROADWAY_SEGMENTS_URL`, `loadRoadwayDataset()` | Switching counties after startup can leave road resolver tied to stale source. | **Yes if runtime county switching is expected.** | Resolve source inside loader from current active/report-coordinate county. |
| TxDOT local records default county number is 146. | `js/gridlyTxdotService.js` / `getLocalRecords()` | Transportation/event analytics are Liberty-biased if re-enabled. | **Not active now, but future blocker.** | Map county id to TxDOT county number via registry. |
| TxDOT analytics exposes Liberty-specific samples. | `js/gridlyTxdotService.js` / `gridlyTxdotAnalytics()` | Diagnostics and future intelligence remain Liberty-first. | **Not active now, but cleanup needed.** | Make analytics county-parameterized. |
| Static DOM labels say Liberty County Beta, Liberty County, and Liberty County Active Feed. | `index.html` | Users in Montgomery or future counties can see Liberty-owned labels. | **Yes for UX correctness.** | Bind static labels to active county or mark them as product/global copy. |
| Static placeholder says Dayton, TX. | `index.html` / work input placeholder | Route/search UX nudges all counties toward Dayton. | **Partial.** | Use active county default city or generic placeholder. |
| Tests/audits are heavily Montgomery-after-Liberty oriented. | Runtime audit helpers and V619-V624 docs | County #3 may pass because tests only prove Montgomery does not leak Liberty. | **Yes for governance.** | Add N-county activation checklist and generic county fixture suite. |

## 4. New county activation checklist

A county must not be fully activated until the following exist and pass audit:

- **Source data:** registry artifact, package manifest, provenance notes, and source availability declarations.
- **Normalized roads:** road segment GeoJSON present, parseable, in county bounds, and usable by the reference-road resolver.
- **Crossing data:** rail crossing GeoJSON present, parseable, county-owned, and renderable with click/report behavior.
- **Bounds:** county bounds present in runtime, valid, and used for coordinate ownership, map fit, and search containment.
- **Area/town list:** county-wide awareness area and local towns/areas with anchors and `countyId` values.
- **Report support:** report submit path writes coordinate-scoped `county_id`/`countyId` and rejects unsupported coordinates safely.
- **Road naming support:** report labels use report-coordinate county roads and avoid generic/Liberty fallback labels.
- **Crossing render support:** active county crossing inventory loads without borrowing another county.
- **Search containment:** local and destination search stay inside active county/search bounds.
- **Alert/awareness containment:** cards, counts, and community pulse only count visible active-county reports unless an explicit cross-county mode exists.
- **Historical containment:** historical/demo rows are dormant, county-tagged, or suppressed under protected flags.
- **Audit pass criteria:** registry, bounds, awareness, roads, crossings, report ownership, visibility, search, labels, and static DOM text all pass for the candidate county and regression counties.

## 5. Generic county contract

The intended scalable contract should be:

- **`activeCounty` = viewing context.** It controls map fit, active crossing inventory, awareness copy, alert context, and search containment.
- **`activeTown` = local awareness context.** It narrows awareness labels/counts within the active county.
- **`reportCoordinateCounty` = tapped coordinate ownership.** It is resolved from coordinate bounds and may differ from the current viewing context.
- **`reportSubmitCounty` = write ownership.** It is the county metadata written to live report rows; it should derive from `reportCoordinateCounty`, not from `activeCounty`.
- **`visibleCounty` = render/filter context.** It decides which reports, markers, alert inputs, and awareness counts appear in the current view.
- **`roadResolverCounty` = report coordinate county for report labels.** Road labels should resolve against the county where the report coordinate lives.
- **`crossingSourceCounty` = active county for crossing inventory.** Crossing inventory is a viewing-context asset, not a report-coordinate asset.
- **Passive county options must not count as active leakage.** County choices shown in settings/dropdowns are not active context until selected, and their labels/assets must not affect visible runtime state.

## 6. Current county readiness matrix

| County | Registry present? | Bounds present? | Awareness areas present? | Roads present? | Crossings present? | Search containment ready? | Report ownership ready? | Road naming ready? | Crossing render ready? | Historical containment ready? | Activation status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Liberty | Yes | Yes | Yes | Yes | Yes | Mostly | Mostly, with legacy untagged fallback | Yes/legacy mature | Yes | Partial; demo/historical surfaces still need containment audit | **Operational baseline** |
| Montgomery | Yes | Yes | Yes | No | No | Mostly | Mostly for coordinate metadata | No; missing roads cause generic labels | No; source missing | Partial; Dayton/Liberty historical/demo leakage risk remains | **Operational but not fully source-ready** |
| Chambers | No runtime registry | No | No | Not wired | Not wired | No | No | No | No | No | **Not activatable** |
| Jefferson | No runtime registry | No | No | Not wired | Not wired | No | No | No | No | No | **Not activatable** |
| Polk | No runtime registry | No | No | Not wired | Not wired | No | No | No | No | No | **Not activatable** |
| San Jacinto | No runtime registry | No | No | Not wired | Not wired | No | No | No | No | No | **Not activatable** |
| Harris | No runtime registry | No runtime bounds | No | Assets appear in implementation folders but are not wired | Assets appear in implementation folders but are not wired | No | No | No | No | No | **Not activatable / asset-only candidate** |

## 7. Risk of adding County #3 today

If another county is added today, likely breakage includes:

- The county would need code edits in the registry, bounds map, awareness definitions, home-area options, source availability, and tests.
- If any id/source/bounds field is missing, several paths can default or fall back to Liberty.
- Report ownership may work only if bounds are present; otherwise coordinate-scoped metadata returns null and report support fails closed or becomes legacy-shaped.
- Road naming would repeat Montgomery issues unless normalized roads and resolver county selection are complete before activation.
- Crossing render would repeat Montgomery issues unless county-owned crossings are wired and loaded dynamically.
- Search containment would fail or degrade without bounds.
- Static DOM and historical/demo surfaces would still expose Liberty/Dayton language unless separately contained.

**Would it repeat Montgomery issues?** Yes. A third county would likely repeat Montgomery's missing-source and fallback-label issues unless activation is gated by required assets and generic audits.

**Which V619-V624 fixes generalize?**

- Active-county versus report-coordinate ownership separation.
- Coordinate-scoped report metadata.
- Active-county report visibility filtering.
- Search containment concept.
- County runtime source registry concept.
- Montgomery leakage audits as a pattern.

**Which do not generalize enough yet?**

- Liberty text replacement for non-Liberty labels.
- Montgomery-specific runtime gate and audit language.
- Hardcoded two-county awareness arrays and bounds maps.
- Startup constants for crossing/road source URLs.
- Static DOM Liberty labels.
- Historical/demo containment that is not county-tagged.

## 8. Recommended architecture corrections before County #3

### Blocker

- Build a **county activation checklist/gate** that prevents `operational/selectable` activation unless bounds, awareness areas, roads, crossings, report ownership, search containment, and render audits pass.
- Make source/bounds/report ownership paths fail closed for known-but-incomplete counties instead of falling back to Liberty.
- Require county-owned road and crossing assets before full operational status.

### High priority

- Refactor awareness areas and home-area options into registry/package-owned county definitions.
- Dynamically resolve road and crossing sources at load time from active/report-coordinate context instead of relying on startup constants.
- Make road resolver county equal report-coordinate county for submitted report labels.
- Replace Liberty-specific text cleanup with generic county-aware label construction.
- Bind static county labels in the DOM to active county or remove county-specific copy from static markup.

### Medium priority

- Generalize audits from “Montgomery does not leak Liberty” to “active county does not leak any non-active county.”
- Add county package schema validation for manifest, bounds, roads, crossings, and awareness areas.
- Quarantine untagged legacy reports from multi-county views unless explicitly mapped.
- Parameterize TxDOT/transportation county numbers before re-enabling DriveTexas or Transportation Intelligence.

### Optional

- Rename Liberty-named constants to county-neutral names.
- Consolidate docs into a single county activation playbook.
- Add passive county preview mode for asset-only counties.

## 9. Recommended next milestone

**Recommended next milestone: B. first build a county activation checklist/gate.**

The next milestone should be a documentation/test/audit gate before more runtime expansion. The order should be:

1. **B — Build county activation checklist/gate.** This prevents repeating Montgomery's partial activation pattern.
2. **D — Generalize road/crossing asset loaders.** The gate will identify these as hard blockers for County #3.
3. **C — Refactor county source registry.** Move county package data toward declarative ownership.
4. **E — Contain historical/demo surfaces.** Required before public multi-county credibility.
5. **A — Continue Montgomery runtime fixes.** Continue, but only under the new gate so Montgomery becomes the proof case rather than another one-off patch sequence.

## Top 5 scaling risks

1. **Liberty fallback semantics in normalization/source/bounds paths.** Missing county state can become Liberty state instead of failing closed.
2. **No activation gate.** Operational/selectable flags can be true while required roads/crossings are missing.
3. **Road and crossing loaders are not fully dynamic county package consumers.** Startup constants and default location stamping keep assets Liberty-shaped.
4. **Awareness/town definitions are hardcoded in runtime.** Every county requires fragile code edits.
5. **Static and demo/historical surfaces are not county-contained.** Runtime correctness can still be contradicted by visible Liberty/Dayton copy.

## Merge recommendation

**Merge this documentation-only audit.** It makes no runtime behavior changes, no Supabase schema changes, and does not alter historical reads/UI, DriveTexas, Transportation Intelligence, framework structure, or UI design. Use it as the decision record for building the County #3 activation gate before adding another operational county.
