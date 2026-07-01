# GRIDLY County Runtime Asset Inventory Comparison — V650R.6

## 1. Quick summary

**Mission:** Know Before You Go. Awareness Platform First. Route Intelligence Second.

**Scope:** Audit-only comparison of Liberty, Montgomery, San Jacinto, and Jefferson runtime asset availability. No activation was performed and no runtime behavior was changed.

**Final determination for San Jacinto:** **ASSET INCOMPLETE**.

San Jacinto has a county implementation folder, a county-specific boundary GeoJSON, a rail crossing GeoJSON, crossing review overrides, a runtime registry artifact, a runtime onboarding manifest, and source TIGER road shapefile components. It does **not** have a browser-consumable normalized road segment GeoJSON equivalent to Liberty's `data/liberty-county-road-segments.geojson`. Its registered `roadSegmentsPath` points directly to a `.shp` source file, which is not JSON and is not a normalized runtime roadway asset. This gap can explain road-name and location-wording failures. The boundary asset exists, but current browser audit code explicitly blocks San Jacinto boundary production recommendation because visual credibility did not pass. Count reconciliation issues are likely not explained by total absence of crossing assets, because San Jacinto crossing GeoJSON and overrides exist; they are more likely caused by validation-only runtime flow, filter/reconciliation logic, and audit counting differences, with missing normalized roads worsening location text reliability.

## 2. Directory inventory

Inventory commands used:

```bash
find assets/county-implementation/montgomery assets/county-implementation/san-jacinto assets/county-implementation/jefferson data -maxdepth 3 -type f | sort
python3 - <<'PY'
from pathlib import Path
for c in ['liberty','montgomery','san-jacinto','jefferson']:
    p=Path('assets/county-implementation')/c
    print(c, p.exists())
    if p.exists():
        for child in sorted(p.iterdir()):
            print(child, sum(1 for x in child.rglob('*') if x.is_file()) if child.is_dir() else 'file')
PY
```

### Liberty

`assets/county-implementation/liberty` does **not** exist. Liberty's active runtime assets are stored in `data/`:

- `data/liberty-county-boundary.geojson`
- `data/liberty-county-rail-crossings.geojson`
- `data/liberty-county-road-segments.geojson`
- `data/gridly-crossing-review-overrides.json`

### Montgomery

`assets/county-implementation/montgomery` exists and is the fullest county implementation package among the compared implementation directories:

- `README.md`
- `activation/` — activation readiness, implementation, rollback, observation-period, and gap-analysis artifacts.
- `boundary/` — `montgomery-county-boundary.geojson`.
- `containment/` — fixture suite artifact.
- `evidence/` — boundary provenance, readiness, activation, rollback, runtime data integration, controlled observation, and launch evidence.
- `launch/` — launch readiness/decision/gap matrix artifacts.
- `manifests/` — `montgomery-package-manifest.json`.
- `observation/` — controlled observation plan/report/findings and success/failure criteria.
- `registry/` — `montgomery-county-registry-artifact.json`.
- `rollback/` — rollback procedure artifact.
- `runtime-assets/` — rail crossings, crossing review overrides, and source road shapefile components.
- `validation/` — boundary, registry, package, containment, rollback, activation, staged runtime, observation, and implementation validations.

### San Jacinto

`assets/county-implementation/san-jacinto` exists but is much thinner than Montgomery:

- `boundary/` — `san-jacinto-county-boundary.geojson`.
- `inventory/` — `san-jacinto-source-inventory-v639.json`.
- `manifests/` — `san-jacinto-runtime-onboarding-v639.json`.
- `registry/` — `san-jacinto-county-runtime-registry-v639.json`.
- `runtime-assets/` — rail crossings, crossing review overrides, and source road shapefile components.
- `validation/` — runtime validation and boundary ownership hardening artifacts.

Missing versus Montgomery: no containment folder, launch folder, observation folder, rollback folder, activation folder, evidence folder, broad validation set, or generated normalized road GeoJSON.

### Jefferson

`assets/county-implementation/jefferson` exists as a limited comparison package:

- `boundary/` — only `.gitkeep`; no Jefferson boundary GeoJSON in the inspected path.
- `runtime-assets/` — Jefferson rail crossings, crossing review overrides, and source road shapefile components.

## 3. Runtime asset comparison matrix

| Asset / capability | Liberty | Montgomery | San Jacinto | Jefferson | Impact |
|---|---|---|---|---|---|
| County implementation directory | No; active assets are in `data/` | Yes | Yes | Yes | San Jacinto package exists but is not as complete as Montgomery. |
| Boundary asset | Yes: `data/liberty-county-boundary.geojson` | Yes | Yes | No county boundary GeoJSON found in `assets/county-implementation/jefferson/boundary` | San Jacinto has a boundary file, but browser credibility remains blocked. |
| Runtime boundary registration | Yes | Yes | Yes | Not registered in `js/app.js` county registry | San Jacinto can load a county-specific boundary path during validation. |
| Road segment GeoJSON | Yes: `data/liberty-county-road-segments.geojson` | No registered normalized GeoJSON | No | No | San Jacinto lacks browser-ready normalized roads. |
| Normalized road geometry | Yes, Liberty road segment FeatureCollection | No normalized file found; source shapefile only | No normalized file found; source shapefile only | No normalized file found; source shapefile only | Explains weak road-name/location wording for San Jacinto. |
| Source roadway shapefile components | Not in inspected Liberty implementation path | Yes: `tl_2025_48339_roads.*` | Yes: `tl_2025_48407_roads.*` | Yes: `tl_2025_48245_roads.*` | Source exists for San Jacinto but is not runtime-normalized. |
| Rail crossing GeoJSON | Yes | Yes | Yes | Yes | Crossing data is not absent for San Jacinto. |
| Crossing review overrides | Yes | Yes | Yes | Yes | Overrides are present for San Jacinto. |
| Manifests | Not in implementation dir | Yes | Yes | No | San Jacinto has onboarding manifest, not Montgomery-level package manifest set. |
| Registry artifacts | Runtime registry in `js/app.js`; no Liberty implementation artifact | Yes | Yes | No | San Jacinto has package registry artifact and app registry entry. |
| Containment artifacts | Not in implementation dir | Yes | No | No | San Jacinto lacks Montgomery-style containment readiness. |
| Activation artifacts | Active production baseline | Yes | No | No | San Jacinto has activation hold in registry, not activation package. |
| Rollback artifacts | Not in implementation dir | Yes | No | No | San Jacinto lacks formal rollback artifact package. |
| Observation/evidence artifacts | Not in implementation dir | Yes | Limited validation only; no evidence/observation folders | No | San Jacinto audit reliability gaps are consistent with package incompleteness. |
| Generated assets | Road segments in `data/` are browser-consumable | No generated road GeoJSON found | No generated road GeoJSON found | No generated road GeoJSON found | San Jacinto needs generated runtime package work. |
| Source assets | Runtime data files in `data/` | Source road shapefile components | Source road shapefile components | Source road shapefile components | San Jacinto source is present but not enough for activation. |

## 4. Road geometry findings

### San Jacinto

San Jacinto **does not** have `san-jacinto-county-road-segments.geojson`.

San Jacinto **does not** have any discovered `road-segments.geojson` equivalent.

San Jacinto **does not** have a normalized roadway GeoJSON or generated roadway runtime asset in the inspected package.

San Jacinto **does** have source roadway shapefile components:

- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.dbf`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shx`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.prj`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.cpg`
- TIGER metadata XML files.

The San Jacinto source inventory explicitly classifies roadway assets as `source-shapefile-inventory-only`, with `normalization: false` and `activation: false`. `js/app.js` currently registers San Jacinto `roadSegmentsPath` to the `.shp` file, not a GeoJSON runtime file.

### Montgomery comparison

Montgomery has the same type of source road shapefile components for FIPS/GEOID `48339`, but the app registry marks Montgomery roads as `missing` and sets `roadSegmentsPath: null`. Montgomery therefore does **not** pretend a shapefile is a runtime road segment GeoJSON. This is cleaner from a browser-runtime contract perspective than San Jacinto's current validation-only registration of a `.shp` path.

### Liberty comparison

Liberty has the browser-ready road segment GeoJSON: `data/liberty-county-road-segments.geojson`, parsed as a FeatureCollection with 8,407 features during this audit.

## 5. Crossing findings

San Jacinto has crossing assets:

- `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson`
- `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json`

JSON parse checks showed San Jacinto rail crossings are a valid GeoJSON FeatureCollection with 14 features.

Montgomery has:

- `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson`
- `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json`

JSON parse checks showed Montgomery rail crossings are a valid FeatureCollection with 239 features.

Jefferson has:

- `assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson`
- `assets/county-implementation/jefferson/runtime-assets/jefferson-county-crossing-review-overrides.json`

JSON parse checks showed Jefferson rail crossings are a valid FeatureCollection with 577 features.

**Conclusion:** San Jacinto's crossing data is present but smaller. Current crossing-related browser count divergence is not explained by total absence of a crossing GeoJSON or overrides. It may still be affected by normalization assumptions, validation-only filtering, county context, marker/report reconciliation, or mismatch between source crossing inventory semantics and UI/audit counts.

## 6. Boundary findings

San Jacinto has a county-specific boundary asset:

- `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson`

JSON parse checks showed the San Jacinto boundary is a valid FeatureCollection with 1 feature.

San Jacinto provenance/source artifacts exist in limited form:

- `assets/county-implementation/san-jacinto/inventory/san-jacinto-source-inventory-v639.json` identifies the standard Texas boundary GEOID `48407`, standard statewide source path, and San Jacinto county-specific boundary path.
- `assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json` identifies the same boundary foundation and labels the county-specific boundary as `identified-not-activated`.

However, `js/app.js` contains a San Jacinto-specific boundary credibility review that sets `visualCorrectnessPass: false`, `credibilityDetermination: "failed_validation_only"`, and `productionRecommendationBlocked: true`. Therefore an asset exists, but the browser audit explicitly does **not** consider it production-authoritative.

The statewide Texas county boundary file is still referenced by boundary overlay code as the standard/passive fallback source. The code first loads the statewide file, maps all 254 county features as passive/fallback payloads, then attempts to replace supported active counties with county-specific boundary paths. The active San Jacinto safety condition explicitly rejects use of statewide payload as acceptable for San Jacinto active display. This means statewide data is still referenced for passive/fallback architecture, but current safety logic does not approve statewide fallback as a San Jacinto active boundary.

## 7. Runtime registration comparison

### Liberty — `liberty-tx`

- Stage: `operational`.
- Operational/selectable/production enabled: true/true/true.
- Boundary path: `data/liberty-county-boundary.geojson`.
- Road source path: `data/liberty-county-road-segments.geojson`.
- Crossing paths: remote Transportation.gov URL plus local `data/liberty-county-rail-crossings.geojson`.
- Crossing overrides: `data/gridly-crossing-review-overrides.json`.
- Awareness areas: Entire Liberty County plus Dayton, Liberty, Cleveland, Ames, Hardin, Devers, Hull, Daisetta, Moss Hill, Raywood, Kenefick, Tarkington.
- Validation-only fields: none.

### Montgomery — `montgomery-tx`

- Stage: `operational`.
- Operational/selectable/production enabled: true/true/true.
- Package root and package artifacts are registered.
- Boundary path: `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`.
- Road source path: `null`.
- Crossing path: `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson`.
- Crossing overrides: `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json`.
- Awareness areas: Montgomery County, Conroe, The Woodlands, Magnolia, Willis, Montgomery, New Caney, Porter, Splendora, Other.
- Runtime source availability marks roads as `missing`.
- Validation-only fields: none.

### San Jacinto — `san-jacinto-tx`

- Stage: `validation-only`.
- Operational/selectable: true/true for controlled browser validation.
- Production enabled: false.
- Validation-only: true.
- Production activation blocked: true.
- Reauthorization required: true.
- Boundary path: `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson`.
- Road source path: `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp`.
- Crossing path: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson`.
- Crossing overrides: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json`.
- Awareness areas: San Jacinto County, Coldspring, Shepherd, Point Blank, Oakhurst.
- Runtime source availability marks roads as `inventory-only` and awareness areas as `validation-only`.
- Activation hold explicitly blocks production activation and requires reauthorization.

## 8. Browser symptom explanation

| Symptom | Could missing San Jacinto assets explain it? | Determination |
|---|---:|---|
| A. Road names not resolving | Yes | Missing normalized runtime road GeoJSON is a direct and likely cause. A `.shp` source path is not a browser-ready road segment FeatureCollection. |
| B. Alert wording falling back to county/community | Yes | Without normalized road geometry and road-name properties, location labels are more likely to fall back to county/community wording. Language logic may contribute, but asset incompleteness materially explains the symptom. |
| C. Location card count mismatch | Partially | Crossing GeoJSON exists, so this is not explained by missing crossing assets alone. Validation-only status, filter boundaries, report/marker/card reconciliation, and audit count semantics remain likely causes. Missing roads may worsen grouping or location text but does not alone explain crossing count mismatch. |
| D. Marker/alert/awareness count divergence | Partially | Crossing assets exist, but San Jacinto validation-only flow and incomplete county package can cause audit reliability gaps. Missing normalized roads can produce weaker labels and fallback grouping, but count divergence needs separate reconciliation RCA. |
| E. Boundary visual failure | Yes, but not due to absent file | Boundary file exists, but app audit explicitly says San Jacinto visual correctness failed and production recommendation is blocked. Missing authoritative/proven boundary acceptance explains the browser failure more than physical file absence. |

## 9. San Jacinto gap matrix

| Asset / capability | Liberty | Montgomery | San Jacinto | Impact | Required before activation? |
|---|---|---|---|---|---|
| Browser-ready road segment GeoJSON | Available | Missing/unsupported | Missing | Road names and precise location wording degrade. | Yes |
| Normalized roadway properties | Available through road segment GeoJSON | Not registered | Missing | Road/location intelligence cannot be trusted. | Yes |
| Road source shapefile | Not applicable in active Liberty runtime | Available | Available | Useful source but not browser runtime asset. | Needs conversion before activation |
| County-specific boundary GeoJSON | Available | Available | Available | San Jacinto file exists. | Must pass credibility review |
| Boundary provenance/lineage | Mature enough for active Liberty | Montgomery provenance evidence exists | Limited inventory/registry only; browser review blocks recommendation | Boundary visual credibility failure remains. | Yes |
| Rail crossing GeoJSON | Available | Available | Available | Not a missing-asset root cause for crossing display by itself. | Yes, present |
| Crossing review overrides | Available | Available | Available | Overrides present. | Yes, present |
| Crossing source inventory/normalization evidence | Liberty active runtime baseline | Runtime assets and broad evidence package | Limited runtime assets/inventory | Count reconciliation confidence remains limited. | Yes, or explicit acceptance criteria |
| Runtime manifest | Active data baseline | Full package manifest | Runtime onboarding manifest | San Jacinto package is thinner. | Yes, strengthen to package manifest |
| Registry artifact | App registry baseline | Registry artifact | Registry artifact | Present. | Yes, present but review after roads/boundary |
| Containment artifacts | Not in implementation package | Available | Missing | Audit reliability gap. | Yes |
| Activation artifacts | Active baseline | Available | Missing; app has activation hold only | No activation packet. | Yes |
| Rollback artifacts | Active baseline | Available | Missing | No formal rollback package. | Yes |
| Observation/evidence artifacts | Active baseline | Available | Missing evidence/observation folders | Browser validation/audit reliability gap. | Yes |
| Validation-only guards | Not applicable | Not applicable | Present | Correctly blocks production. | Must remain until readiness passes |

## 10. Final determination

**San Jacinto asset readiness: ASSET INCOMPLETE.**

Rationale:

1. San Jacinto lacks a normalized browser-ready roadway GeoJSON such as `san-jacinto-county-road-segments.geojson`.
2. San Jacinto's registered road source is a TIGER `.shp`, not a runtime GeoJSON FeatureCollection.
3. San Jacinto has crossing GeoJSON and overrides, so crossing count failures are not caused by a total missing crossing file, but the package lacks Montgomery-style evidence, containment, observation, activation, and rollback artifacts.
4. San Jacinto has a boundary file, but browser credibility review explicitly blocks production recommendation.
5. The county remains validation-only and production activation blocked in app registration.

## 11. Recommended next milestone

Recommended next milestone: **full county runtime asset package creation**, with the first workstream being **road geometry acquisition/normalization**.

Minimum workstreams:

1. Generate `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson` from the existing TIGER source shapefile or an approved better roadway source.
2. Validate road feature count, geometry types, coordinate bounds, road-name/property coverage, and browser fetch compatibility.
3. Update only a future authorized milestone to register the normalized GeoJSON path instead of the `.shp` path.
4. Re-run San Jacinto browser validation for road-name resolution, alert wording, and location-card text.
5. Perform boundary acquisition/provenance hardening until visual correctness can pass against authoritative geography.
6. Add Montgomery-style containment, observation/evidence, rollback, activation-readiness, and validation artifacts before any activation reauthorization.
7. Run a separate count reconciliation RCA after normalized roads and boundary credibility are fixed, because crossing assets are present and count divergence likely has logic/audit-flow causes beyond missing asset files.

## 12. Merge recommendation

**Merge recommendation: merge only as documentation/audit-only.**

This patch creates a forensic inventory document only. It does not activate San Jacinto, expose San Jacinto to production, modify Liberty behavior, modify Montgomery behavior, change protected systems, or change runtime behavior.

Protected systems remain unchanged by this audit-only document:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Appendix A. JSON parse check results

Command:

```bash
python3 - <<'PY'
import json
files=[
 'data/liberty-county-boundary.geojson',
 'data/liberty-county-rail-crossings.geojson',
 'data/liberty-county-road-segments.geojson',
 'assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson',
 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson',
 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson',
 'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson',
 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson'
]
for f in files:
    o=json.load(open(f))
    print(f, 'OK', o.get('type'), len(o.get('features', [])))
PY
```

Results:

- `data/liberty-county-boundary.geojson` — OK, FeatureCollection, 1 feature.
- `data/liberty-county-rail-crossings.geojson` — OK, FeatureCollection, 5 features.
- `data/liberty-county-road-segments.geojson` — OK, FeatureCollection, 8,407 features.
- `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson` — OK, FeatureCollection, 1 feature.
- `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson` — OK, FeatureCollection, 239 features.
- `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson` — OK, FeatureCollection, 1 feature.
- `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson` — OK, FeatureCollection, 14 features.
- `assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson` — OK, FeatureCollection, 577 features.

## Appendix B. Registry/source-path inspection commands

Commands:

```bash
rg -n "san-jacinto|montgomery|liberty|jefferson|historicalReadsEnabled|historyUiEnabled|DriveTexasPaused|TransportationIntelligence" js/app.js assets -g '!node_modules'
rg -n "statewide|counties.*geojson|san-jacinto-county-boundary|boundaryPath|roadSegmentsPath|localCrossingsPath|crossingOverridesPath|operational|selectable|validationOnly" js/app.js
sed -n '1,110p' js/app.js
sed -n '8070,8105p' js/app.js
sed -n '28880,29110p' js/app.js
```
