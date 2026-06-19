# GRIDLY V617 — Montgomery Runtime Product Regression Audit

## 1. Executive Summary

This V617 audit is audit-only. No production runtime behavior was patched, no assets were normalized, no Montgomery runtime assets were registered, and no protected historical/DriveTexas/Transportation Intelligence systems were activated.

The observed Montgomery runtime regressions are real and trace back to incomplete county-context containment rather than one isolated rendering bug:

- **County view / county filter zoom:** Montgomery has a promoted boundary path in the active county registry, but the map context still has Liberty-named debug state and relies on crossing-driven fit behavior. Because Montgomery has no runtime crossings, the startup/filter flow falls through to anchor/bounds paths that can feel broader than a Conroe/Montgomery-local context.
- **Destination search containment:** Destination Search is not county-aware enough. It uses global/local POI seeds that are Liberty/Baytown-oriented, generic locality tests that explicitly treat Liberty as local, and Nominatim viewbox support that is usually unbounded unless callers pass `bounded: "1"`.
- **Railroad crossings:** Montgomery crossing source availability is explicitly `missing`; both remote and local crossing paths are null. The crossing loader therefore returns an empty FeatureCollection, so Gridly marker creation/click binding never receives Montgomery crossings. Any rail symbols visible in Montgomery are base-map rail labels/symbols, not Gridly crossing markers.
- **Road hazard fallback language:** The code contains Montgomery-specific sanitation for `Local Road Impact Into Liberty`, but Montgomery road geometry is explicitly missing. The bad observed string indicates an upstream fallback/resolver path can still create Liberty-contaminated road labels before or outside the normalized display-text path, especially when no county-owned road source is available.

## 2. Final Determination

**ROOT_CAUSE_PARTIALLY_IDENTIFIED**

The major causes are identified in source: missing Montgomery roads/crossings, non-county-bounded destination search, and crossing-fit behavior depending on crossing availability. The exact live path that produced `Disabled Vehicle on Local road impact into Liberty` is only partially identified because existing tests cover and pass the display-text sanitizer, while local manual testing proves at least one production surface or upstream resolver still bypasses or precedes that sanitizer.

## 3. Scope Controls

This audit did not:

- patch runtime behavior;
- normalize assets;
- activate new behavior;
- register Montgomery runtime roads/crossings;
- touch DriveTexas implementation files;
- enable Transportation Intelligence;
- enable historical reads or historical UI.

Files reviewed were limited to the active runtime, tests, and existing source/package evidence.

## 4. Manual Test Evidence Summary

Manual observations under Montgomery/Conroe context:

1. County view / County filter zoomed too broadly and felt region/Houston-area centered rather than bounded to Montgomery/Conroe.
2. Destination Search for `walmart` returned Cleveland, Liberty, and Harris-area options while Montgomery/Conroe was active.
3. Montgomery/Conroe railroad crossings appeared only as base-map rail symbols and were not Gridly-styled/clickable crossing markers.
4. A Conroe road hazard displayed `Disabled Vehicle on Local road impact into Liberty`, indicating Liberty fallback leakage in a Montgomery context.

## 5. County Context Audit

### Active county state

The active county defaults to Liberty unless `window.GRIDLY_ACTIVE_COUNTY_ID` is set, and the active config is derived from that normalized county id. Montgomery is present and operational in the registry, but defaulting remains Liberty-first. 【F:js/app.js†L4-L8】【F:js/app.js†L134-L143】

### Selected town state

The selected awareness area is used as display context when its `countyId` matches the active record/county context. This means Conroe should be valid display context for Montgomery when the selected awareness area is resolved correctly. 【F:js/app.js†L159-L181】

### County/town filter behavior

Saving an awareness area sets `activeGeoFilter` to `county` for county-wide/fallback selections and `town` for normal town selections, then applies home-town awareness context and schedules crossing rendering. 【F:js/app.js†L27287-L27292】

### County bounds source

The active registry points Montgomery boundary data at `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`. Runtime-source registration exposes this as the active boundary source. 【F:js/app.js†L32-L56】【F:js/app.js†L59-L70】

### Map fit / zoom behavior

County-wide test helpers call `gridlyGetCountyBounds(...)` and `map.fitBounds(...)` when bounds exist, otherwise they fall back to a county anchor and `GRIDLY_COUNTY_STARTUP_ZOOM`. 【F:js/app.js†L27371-L27384】

Normal home-town awareness fitting depends heavily on loaded crossings. If there are no crossings, the map sets the awareness anchor/zoom directly. If crossings exist, the code fits to town crossings or county bounds. Montgomery currently has no crossing runtime source, which makes this path sensitive to anchor definitions and fallback zoom rather than a populated Montgomery marker set. 【F:js/app.js†L28663-L28691】

### Whether Montgomery borrows Liberty bounds or generic region defaults

Montgomery does **not** appear to borrow Liberty's boundary path in the registry. However, Liberty contamination remains visible in debug naming and default behavior: default county id is Liberty, and the awareness test helper exposes `countyBounds` from `LIBERTY_COUNTY_AWARENESS_BOUNDS` even while it also exposes `resolveCountyIdForAwarenessArea`. 【F:js/app.js†L4-L8】【F:js/app.js†L27342-L27350】

**Finding:** The county zoom issue is most likely a fit-context problem: Montgomery has a boundary source, but county/town fitting can fall back to anchor/zoom behavior because Montgomery crossings are empty and road/crossing data is unavailable. The source does not prove Montgomery is using Liberty boundary geometry, but it does prove the runtime remains Liberty-defaulted and crossing-dependent.

## 6. Destination Search Containment Audit

### Search provider query context

Search map context uses the current map center and current map bounds to build a `viewbox` string. 【F:js/app.js†L21376-L21393】

Nominatim search accepts `viewbox`, but `bounded` is passed through from caller options and defaults to `"0"`; therefore the provider can rank around the viewbox without being forced to stay inside it. 【F:js/app.js†L59785-L59834】【F:js/app.js†L59890-L59907】

### Active town/county influence

Destination Search can use the selected awareness area as an anchor, but the fallback anchor is still Liberty County/default center if no awareness area is resolved. 【F:js/app.js†L21101-L21115】

### Result ranking/filtering

The local POI seed list contains Liberty/Cleveland/Baytown-area stores and no equivalent Montgomery/Conroe Walmart seed. The first two Walmart seeds are Cleveland and Liberty. 【F:js/app.js†L20796-L20821】

The generic locality test explicitly treats `Liberty County`, `Liberty, Texas`, and any town in `LOCAL_PLACE_LOOKUP` as local. That is not active-county-contained and can allow Liberty results to appear local in a Montgomery context. 【F:js/app.js†L21400-L21407】

The quality filter allows local POI seeds, Liberty County, locality matches, broad anchor-distance matches up to 150 miles, and Texas matches up to 250 miles. 【F:js/app.js†L21539-L21551】

### Whether Liberty/Harris results can appear while Montgomery/Conroe is active

Yes. The seed and ranking logic can produce Cleveland/Liberty/Baytown/Harris-adjacent results independent of active county ownership, and remote Nominatim results are not forced into a county/town bounding box by default. 【F:js/app.js†L20796-L20965】【F:js/app.js†L59831-L59834】

### Whether search needs county/town bounding box support

Yes. Search needs active county/town bounding boxes with bounded provider queries and a post-provider containment filter. Ranking alone is insufficient because current ranking still accepts broad Texas/locality results.

## 7. Crossing Render and Interaction Audit

### Montgomery FRA crossing source availability

Montgomery has `crossingsPath: null`, `localCrossingsPath: null`, and runtime source availability marks crossings as `missing`. 【F:js/app.js†L45-L53】

### Crossing marker creation path

If crossing source availability is not available, `fetchFraCrossingsWithRetry()` returns an empty FeatureCollection. 【F:js/app.js†L29686-L29689】

`loadCrossings()` normalizes the fetched features into the `crossings` array, then schedules `renderCrossings()`. With an empty FeatureCollection, no Montgomery crossing records reach marker creation. 【F:js/app.js†L29426-L29537】

### Marker icon/style parity with Liberty

The marker creation path itself uses the Gridly production marker family, `L.divIcon`, and production marker assets for rail blockage or crossing infrastructure. 【F:js/app.js†L33468-L33535】

### Click binding/popups

Gridly crossing markers are created with `L.marker(...).bindPopup(...)`, added to the crossing layer, and then explicitly receive guarded click binding that calls `openCrossingPopupFromMarkerInteraction(...)`. 【F:js/app.js†L33537-L33545】

### Filter gating

`renderCrossings()` exits early when `crossingLayer` is missing or `crossings.length` is zero. It also filters visible crossings by active geo filter, viewport bounds, infrastructure visibility, and active delay state. 【F:js/app.js†L33421-L33442】

### Whether base-map rail symbols are being mistaken for Gridly crossing markers

Yes. Because Montgomery has no runtime crossing source, Gridly marker creation never runs for Montgomery crossing records. Rail symbols visible in the base map are therefore not Gridly crossing markers and cannot be expected to have Gridly click bindings/popups.

## 8. Road Hazard Location Language Audit

### Report coordinate county ownership

Hazard metadata is county-scoped from the active county config, and containment checks require the report county id to match the active county. 【F:js/app.js†L151-L156】【F:js/app.js†L117-L132】

### Road resolver county context

Road resolution is blocked for Montgomery because `roadSegmentsPath` is null and runtime availability marks roads as missing. The roadway loader exits with `roadway_dataset_unavailable`. 【F:js/app.js†L45-L53】【F:js/app.js†L29564-L29572】

### Fallback road label path

The nearest-road resolver cannot use Montgomery road geometry while roads are unavailable. The display-text sanitizer rejects `Local Road Impact Into Liberty` as invalid and rewrites Liberty wording for non-default counties. 【F:js/app.js†L189-L219】

### Phrase `Local road impact into Liberty`

The phrase is explicitly recognized as invalid by `gridlyIsInvalidCountyAwareRoadLabel()` and handled by `normalizeGridlyCountyAwareDisplayText()` for non-default counties. 【F:js/app.js†L189-L219】

### Where Liberty is injected

The exact live injection point is not fully proven by static review. The most likely source is an upstream fallback label generated when no county-owned road geometry exists, followed by at least one hazard UI path that uses the raw/fallback road label before the Montgomery sanitizer runs.

### Why Conroe/Montgomery hazards still reference Liberty

Montgomery lacks runtime roads, so road labels can fall back to generic or legacy wording. Tests prove the sanitizer can remove Liberty wording when invoked, but manual testing proves a live surface still saw unsanitized text. This points to sanitizer coverage gaps rather than absence of a sanitizer.

## 9. Protected Systems Verification

Protected boundaries remain declared false/paused in runtime audit state:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

These values are present in the runtime storage readiness audit object. 【F:js/app.js†L81303-L81312】

No activation, runtime registration, DriveTexas resumption, Transportation Intelligence enablement, or historical UI/read enablement was performed in this V617 audit.

## 10. Root Cause Findings

### County bounds / zoom

**Root cause partially identified:** Montgomery has a county boundary source, but fit behavior is still crossing-dependent and fallback-anchor-dependent. Because Montgomery crossings are missing, town/county context can fit broadly or feel region-centered even without borrowing Liberty boundary geometry. 【F:js/app.js†L45-L53】【F:js/app.js†L28663-L28691】

### Search containment

**Root cause identified:** Destination Search lacks active county/town containment. Local POI seeds are Liberty/Cleveland/Baytown-oriented, locality matching includes Liberty as local, and provider viewbox use is not bounded by default. 【F:js/app.js†L20796-L20821】【F:js/app.js†L21400-L21407】【F:js/app.js†L59831-L59834】

### Crossing markers/clicks

**Root cause identified:** Montgomery runtime crossings are not registered/available. The loader returns an empty FeatureCollection, so no Gridly crossing marker/icon/click path runs for Montgomery. 【F:js/app.js†L45-L53】【F:js/app.js†L29686-L29689】【F:js/app.js†L33421-L33427】

### Hazard location language

**Root cause partially identified:** Montgomery road geometry is missing, so road resolution falls back. Sanitizers exist and are covered by tests, but at least one live hazard surface appears to bypass or precede them. 【F:js/app.js†L189-L219】【F:js/app.js†L29564-L29572】

## 11. Patch Recommendations

Do not implement in V617. Recommended future sequence:

1. **Context containment design first:** Define active county/town bounds as first-class runtime context independent of crossing availability.
2. **County/town map fit patch:** Fit Montgomery county view from Montgomery boundary and Conroe/town view from approved town anchor/bounds, not from crossing availability.
3. **Destination Search containment patch:** Add active county/town bounding-box support, call Nominatim with `bounded=1` for generic local searches, filter out non-contained provider/seed results, and replace Liberty-only seed assumptions with county-scoped seed registries.
4. **Crossing activation plan:** Do not fake markers. Register Montgomery FRA/static crossing runtime assets only after source review/normalization approval, then reuse the existing Gridly marker/click path.
5. **Road resolver containment patch:** Add Montgomery road source registration only after approved data is available; until then, force all road-hazard fallback strings through county-aware sanitizer before any title/card/popup render.
6. **Regression tests:** Add tests that simulate Montgomery active county + Conroe selected area for search, map fit mode, crossing empty-state behavior, and every hazard render surface.

## 12. Recommended Next Milestone

**V618 — Montgomery Runtime Context Containment Patch Plan**

V618 should remain a plan/patch-design milestone unless explicitly authorized to patch. It should specify exact file scopes, required fixtures/assets, search containment rules, map-fit acceptance criteria, and hazard-language sanitizer coverage before implementation.

## Testing

- `node tests/county-runtime/montgomeryRuntimeDataSourceIntegrationV598.test.js` — passed.
- `node tests/county-runtime/montgomeryCountyContextLanguageResolverV595.test.js` — passed.
- `node tests/county-runtime/montgomeryRoadResolverIncidentLocationV596.test.js` — passed.
- `node tests/county-runtime/montgomeryReportingHazardVisibilityV594.test.js` — passed.
- `git diff --check` — passed.
- `git status --short` — showed this audit document plus pre-existing untracked dependency/build directories.
