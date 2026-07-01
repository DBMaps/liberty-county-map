# GRIDLY V651 — Montgomery-to-San Jacinto Operational Parity Review

## 1. Quick summary

**Mission:** Know Before You Go. Awareness Platform First. Route Intelligence Second.

**Purpose:** Stop isolated San Jacinto investigations and compare San Jacinto directly against the Montgomery operational baseline.

**Scope:** Documentation-only parity review. This milestone does not activate San Jacinto, create new systems, redesign alerts, redesign awareness, change source registration, change protected systems, or change production behavior.

**Final determination:** **OPERATIONAL PARITY NOT YET ACHIEVED**.

San Jacinto now has the runtime source types needed to behave through the same shared browser pipelines as Montgomery for ownership, visibility, road candidate lookup, road runtime integration, alert language generation, and awareness generation. The remaining true Montgomery-level blocker is **boundary credibility / production boundary recommendation**. Other differences are operational observations or readiness-package differences rather than current browser-behavior blockers.

## 2. Runtime comparison

| Runtime item | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| countyId | `montgomery-tx` | `san-jacinto-tx` | Different county IDs as expected. | Observation only. |
| Stage | `operational` | `validation-only` | San Jacinto remains validation-only. | Blocker for production activation, not blocker for controlled parity validation. |
| operational | `true` | `true` | Both can enter shared runtime paths. | No blocker. |
| selectable | `true` | `true` | Both can be selected in the current runtime context. | No blocker. |
| productionEnabled | `true` | `false` | San Jacinto is deliberately not production-enabled. | Blocker for production parity. |
| validationOnly | Not set / false | `true` | San Jacinto remains explicitly validation-only. | Blocker for production parity until reauthorized. |
| productionActivationBlocked | `false` | `true` | San Jacinto has activation hold. | Blocker for production parity. |
| runtimeSourceOwner | `montgomery-owned` | `san-jacinto-owned` | Both county-owned. | No blocker. |
| boundaryPath | County-specific Montgomery boundary GeoJSON | County-specific San Jacinto boundary GeoJSON | Both registered, but San Jacinto credibility is not production-recommended. | Boundary blocker. |
| roadSegmentsPath | `null` | Normalized San Jacinto road segment GeoJSON | San Jacinto has a road asset where Montgomery uses safe missing-road behavior. | Observation; San Jacinto is ahead for validation roads. |
| localCrossingsPath | County-specific Montgomery rail crossings | County-specific San Jacinto rail crossings | Both county-owned and registered. | No blocker. |
| crossingOverridesPath | County-specific Montgomery overrides | County-specific San Jacinto overrides | Both county-owned and registered. | No blocker. |
| defaultAwarenessAreas | Montgomery County, Conroe, The Woodlands, Magnolia, Willis, Montgomery, New Caney, Porter, Splendora, Other | San Jacinto County, Coldspring, Shepherd, Point Blank, Oakhurst | County-appropriate lists differ. | No blocker. |
| runtimeSourceAvailability | boundary available, roads missing, crossings available, awareness available | boundary available, roads available, crossings available, awareness validation-only | San Jacinto awareness availability remains validation-only. | Production-readiness blocker only. |

**Runtime finding:** San Jacinto is not missing the basic runtime registration needed to behave like Montgomery in controlled validation. Its production state differs by design: validation-only, production-disabled, activation-blocked, and reauthorization-required.

## 3. Source inventory comparison

| Source category | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| Boundary source | `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson` | `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson` | Both have county-specific boundary files. San Jacinto provenance/visual credibility remains failed or held. | Blocker. |
| Road source | No registered normalized runtime road GeoJSON; `roadSegmentsPath: null` | Registered normalized GeoJSON at `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`; previous shapefile retained as source history | San Jacinto has validation road geometry; Montgomery does not. | Observation, not blocker. |
| Crossing source | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson` | Both present. Montgomery has 239 features; San Jacinto has 14. | No blocker; county size/source difference. |
| Crossing overrides | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json` | `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json` | Both present. | No blocker. |
| Manifest | Full package manifest V577 with validation/evidence/dependency lists | Runtime onboarding manifest V639 with source inventory link | San Jacinto manifest is thinner and focused on runtime onboarding. | Observation for roadmap; not browser-behavior blocker. |
| Registry artifact | Montgomery registry artifact | San Jacinto runtime registry artifact | Both present. | No blocker. |
| Inventory | Montgomery package has broad evidence, validation, containment, launch, rollback, activation folders | San Jacinto has source inventory and targeted validation artifacts | San Jacinto lacks Montgomery-level readiness package breadth. | Observation unless activation package is required by next milestone. |
| Validation artifacts | Broad Montgomery validation set | San Jacinto V640, V648, V650R.10, V650R.11, V650R.12 targeted validation set | San Jacinto browser validation evidence is targeted and still flags boundary credibility. | Boundary blocker; otherwise observations. |

## 4. Road resolution comparison

| Road-resolution component | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| roadSegmentsPath | `null` | Normalized road GeoJSON path | San Jacinto has runtime road geometry; Montgomery safe-falls back when no registered road dataset exists. | Observation. |
| Roadway loader | Shared `loadRoadwayDataset()` uses active county runtime road source. | Same shared loader. | Same pipeline. | No blocker. |
| Road candidate generation | Shared `collectNearbyRoadCandidates()` when roadway features are loaded; Montgomery has no registered road features. | Shared candidate path finds San Jacinto road candidates from normalized GeoJSON. | Same pipeline; San Jacinto has more road data. | No blocker. |
| Road selection | Shared `resolveNearestRoadName()` selection and fallback logic. | Same shared selector. | Same pipeline. | No blocker. |
| Corridor resolution | Shared road/corridor helper stack, dependent on loaded road features and event fields. | Same shared stack. | Same pipeline. | No blocker. |
| Observed community preference | Expected fallback behavior when Montgomery lacks road geometry or event fields. | V650R.12 observed `Crash / Wreck on Coldspring` even with nearby road candidates. | Explicit community/event fields can win before resolver-derived road labels. | Observation; consumer-safe but less specific. |

**Road finding:** Road resolution parity is functionally achieved for shared runtime path use. San Jacinto differs because it has normalized road geometry and can generate candidates; the remaining community-over-road wording is a shared location-precedence observation, not a San Jacinto-only architecture gap.

## 5. Alert language comparison

| Alert-language component | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| Alert title generation | Shared `buildGridlyAlertCardConsumerModel()` path. | Same shared path. | No county-specific San Jacinto alert pipeline was added. | No blocker. |
| Alert detail generation | Shared alert card/detail location helpers. | Same shared helpers. | No pipeline difference. | No blocker. |
| Location phrase generation | Shared location-label normalization and coordinate/road fallback helpers. | Same shared helpers. | San Jacinto validation observed community label can remain when explicit community fields are present and road fields are absent. | Observation. |
| Runtime inputs | Montgomery can use county/city/explicit event labels and crossing labels; registered roads are missing. | San Jacinto can use county/community/explicit event labels, crossing labels, and road candidates. | San Jacinto has road data but does not always force it into alert copy. | Observation. |

**Alert language finding:** Montgomery and San Jacinto use the same alert pipeline. No alert redesign is required for parity. The only alert-language difference is input precedence: community labels may be preferred over available roads for San Jacinto validation events.

## 6. Awareness comparison

| Awareness component | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| Top awareness | Shared `buildGridlyLightweightActiveAwareness()` path. | Same shared path. | No county-specific San Jacinto awareness pipeline. | No blocker. |
| Awareness brief | Shared awareness brief / localized intelligence surface stack. | Same shared stack. | Same pipeline. | No blocker. |
| Location card/count surfaces | Shared awareness/count consistency and location-card audit paths. | Same shared paths. | San Jacinto is validation-only; current browser evidence says counts passed after reconciliation review, with boundary still failed. | No blocker for language; activation remains blocked. |
| Awareness areas | Production available. | Validation-only. | San Jacinto awareness areas are scoped but not production-approved. | Production-readiness blocker, not pipeline blocker. |
| Community preference | Montgomery can fall back to city/county labels when roads are unavailable. | San Jacinto can display Coldspring despite available road candidates. | Same precedence model, different data availability. | Observation. |

**Awareness finding:** San Jacinto and Montgomery use the same awareness pipeline. San Jacinto's awareness status differs because it is validation-only and activation-blocked, not because the awareness architecture differs.

## 7. Boundary comparison

| Boundary component | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| Source provenance | Montgomery has a boundary source provenance evidence artifact and validation package. | San Jacinto has source inventory/registry references, but V648 states extraction lineage is not documented enough for production credibility. | San Jacinto provenance is weaker. | Blocker. |
| Active boundary source | County-specific boundary path registered. | County-specific boundary path registered. | Both active paths exist. | No file-availability blocker. |
| Visual validation | Montgomery boundary accepted for operational production use. | San Jacinto visual correctness remains failed/held; production recommendation is blocked. | San Jacinto does not meet Montgomery-level boundary credibility. | Blocker. |
| Production recommendation | Not blocked. | Blocked by boundary credibility review. | Direct operational parity gap. | Blocker. |

**Boundary finding:** This is the remaining true blocker. San Jacinto has a boundary file, but the system explicitly does not treat it as production-credible at Montgomery level.

## 8. Browser behavior comparison

| Browser behavior | Montgomery | San Jacinto | Difference | Impact |
|---|---|---|---|---|
| Ownership | County-owned runtime owner and operational county context. | County-owned runtime owner; validation-only county context. | Same ownership concept, different activation state. | No blocker for validation; production blocker by state. |
| Visibility | Operational/production-visible. | Validation-visible only. Current validation reports pass ownership, visibility, count reconciliation, audit reliability, runtime road geometry, road candidate lookup, road runtime integration, and county containment. | Visibility is deliberately validation-only. | Production-readiness blocker only. |
| Counts | Operational count surfaces. | Validation evidence reports count reconciliation pass after rerun/review. | No remaining count blocker identified in this parity milestone. | No blocker. |
| Road resolution | Montgomery uses safe fallback when roads are missing. | San Jacinto roads load and candidates resolve; community can still win. | San Jacinto road data exists; text precedence observation remains. | Observation. |
| Alerts | Shared alert pipeline. | Shared alert pipeline. | Same pipeline; community preference observed. | Observation. |
| Awareness | Shared awareness pipeline. | Shared awareness pipeline. | Same pipeline; validation-only state. | Production state blocker only. |
| Boundary | Operational boundary credibility. | Boundary credibility failed/blocked. | Material behavioral difference. | Blocker. |

## 9. Remaining differences matrix

| Category | Montgomery | San Jacinto | Impact | Blocker? | Required fix? |
|---|---|---|---|---|---|
| County registration | Operational, selectable, production-enabled, not validation-only. | Selectable/operational for validation, production-disabled, validation-only, activation-blocked, reauthorization-required. | San Jacinto cannot be treated as production parity. | Yes for activation; no for controlled validation. | Future reauthorization/activation milestone after blockers clear. |
| Source registration | Boundary/crossings/overrides registered; roads intentionally missing. | Boundary/crossings/overrides/roads registered; roads point to normalized validation GeoJSON. | San Jacinto has sufficient runtime sources for validation. | No. | None for parity review. |
| Runtime availability | boundary available, roads missing, crossings available, awareness available. | boundary available, roads available, crossings available, awareness validation-only. | Awareness remains validation-only by design. | Yes for production state only. | Reauthorize awareness after boundary credibility passes. |
| Manifest breadth | Full Montgomery package manifest and dependency structure. | Thin runtime-onboarding manifest. | Documentation/readiness package gap. | Observation. | Build Montgomery-style package manifest only in a future readiness milestone if required. |
| Evidence/activation/rollback/observation folders | Present. | Not present as Montgomery-level package set. | Governance-readiness gap, not current browser runtime path gap. | Observation. | Add formal readiness artifacts before production activation. |
| Boundary provenance | Montgomery provenance evidence exists. | V648 says extraction lineage is insufficient and visual credibility is held/failed. | Prevents production boundary recommendation. | Yes. | Authoritative boundary provenance and visual validation hardening. |
| Boundary visual validation | Production acceptable. | `visualCorrectnessPass: false` / production recommendation blocked. | Prevents Montgomery-level behavior. | Yes. | Revalidate against authoritative geography; update only after evidence supports pass. |
| Road geometry | Missing in registry; fallback expected. | Normalized GeoJSON present with 3,906 features; candidates found near validation coordinate. | San Jacinto is not blocked by road data. | No. | No parity fix; optionally tune shared location precedence later. |
| Road candidate lookup | Shared resolver available but no Montgomery road dataset. | Shared resolver finds candidates. | San Jacinto has better validation road input. | No. | None. |
| Location phrase precedence | Fallback/community language expected when road data unavailable. | Community can win over available road candidates. | Less specific wording, but consumer-safe. | No. | Future shared precedence cleanup, not activation-blocking unless product requires road-first text. |
| Alert language pipeline | Shared alert card consumer model. | Same shared alert card consumer model. | No San Jacinto-specific alert gap. | No. | None. |
| Awareness language pipeline | Shared lightweight awareness / awareness brief stack. | Same shared stack. | No San Jacinto-specific awareness gap. | No. | None. |
| Counts and audit reliability | Operational runtime baseline. | Current browser validation reports pass count reconciliation and audit reliability. | No remaining parity blocker identified. | No. | None from this milestone. |
| Protected systems | Historical, DriveTexas, and Transportation Intelligence protected states remain unchanged. | Same protected states remain unchanged. | No protected-system delta. | No. | Preserve unchanged. |

## 10. Final determination

**OPERATIONAL PARITY NOT YET ACHIEVED.**

Rationale:

1. San Jacinto and Montgomery now share the same runtime architecture for county registration, source lookup, road loading, road candidate generation, alert language, and awareness language.
2. San Jacinto has county-owned runtime sources for boundary, roads, crossings, crossing overrides, awareness candidates, registry, manifest, inventory, and validation artifacts.
3. San Jacinto remains deliberately validation-only, production-disabled, activation-blocked, and reauthorization-required.
4. The only true current behavior blocker found by this parity review is **boundary credibility**: San Jacinto's boundary file exists, but provenance/visual validation does not yet reach Montgomery-level production recommendation.
5. Community-over-road text is an **observation**, not a blocker, because the shared pipeline can resolve road candidates and the observed copy remains consumer-safe. It is less specific than ideal, but it does not prove a missing San Jacinto runtime system.

## 11. Recommended next milestone

Recommended next milestone: **V652 — San Jacinto Boundary Credibility Remediation and Production Recommendation Review**.

Minimum scope:

1. Do not activate San Jacinto.
2. Do not change alert or awareness architecture.
3. Prove authoritative San Jacinto boundary source provenance and extraction lineage.
4. Compare the active San Jacinto boundary against authoritative county geography, including Coldspring, Shepherd, Point Blank, Oakhurst, Lake Livingston edge behavior, and Montgomery/Liberty/Walker adjacency.
5. Re-run boundary visual validation and production recommendation checks.
6. If boundary credibility passes, proceed to a separate activation reauthorization review that also packages manifest/evidence/rollback readiness.

## 12. Merge recommendation

**Merge recommendation: merge as documentation-only parity review.**

This patch should merge because it creates the requested authoritative remaining-differences matrix without activating San Jacinto, changing runtime behavior, changing production exposure, changing alert language, changing awareness language, or changing protected systems.

Protected systems remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Appendix A. Review evidence and commands

Commands used for this parity review:

```bash
sed -n '1,110p' js/app.js
find assets/county-implementation/san-jacinto/runtime-assets -maxdepth 2 -type f | sort
python3 - <<'PY'
import json, pathlib
for f in [
 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson',
 'assets/county-implementation/montgomery/runtime-assets/source/montgomery-county-road-segments.geojson'
]:
 p=pathlib.Path(f)
 print(f, p.exists())
 if p.exists():
  o=json.load(open(p))
  print(o.get('type'), len(o.get('features', [])))
PY
sed -n '1,130p' assets/county-implementation/montgomery/manifests/montgomery-package-manifest.json
sed -n '1,130p' assets/county-implementation/san-jacinto/manifests/san-jacinto-runtime-onboarding-v639.json
sed -n '1,110p' assets/county-implementation/san-jacinto/validation/san-jacinto-road-resolution-validation-v650r12.json
rg -n "function loadRoadwayDataset|collectNearbyRoadCandidates|resolveNearestRoadName|buildGridlyAlertCardConsumerModel|buildGridlyLightweightActiveAwareness|productionRecommendationBlocked|visualCorrectnessPass" js/app.js -S
git diff --check
```

Evidence reviewed:

- `js/app.js` county registry and runtime source registry.
- Montgomery manifest, registry, runtime assets, validation artifacts, and evidence folders.
- San Jacinto source inventory, manifest, registry, runtime assets, and validation artifacts.
- V648 boundary ownership hardening evidence.
- V650R.10 road geometry runtime wiring evidence.
- V650R.11 browser validation rerun status.
- V650R.12 road resolution validation evidence.
