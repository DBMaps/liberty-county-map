# GRIDLY REGIONAL RUNTIME CERTIFICATION V820

## Summary

- Audit: **V820 Regional Runtime Certification**
- Generated at: **2026-06-29T16:26:54.925Z**
- Operational county count: **28**
- Counties passed: **28**
- Counties warned: **22**
- Counties failed: **0**
- Overall determination: **REGIONAL_RUNTIME_CERTIFIED_WITH_WARNINGS**

## Scope

V820 is certification-only tooling. It does not activate new counties and does not modify Awareness, Reporting, Route Watch, Alerts, Supabase sync, Community Intelligence, or user-facing UI logic. The operational county registry remains the source of truth.

## Warnings

- montgomery-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at null.
- hardin-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/hardin/runtime-assets/source/tl_2025_48199_roads.shp.
- walker-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/walker/runtime-assets/source/tl_2025_48471_roads.shp.
- orange-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/orange/runtime-assets/source/tl_2025_48361_roads.shp.
- jasper-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/jasper/runtime-assets/source/tl_2025_48241_roads.shp.
- newton-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/newton/runtime-assets/source/tl_2025_48351_roads.shp.
- tyler-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/tyler/runtime-assets/source/tl_2025_48457_roads.shp.
- galveston-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/galveston/runtime-assets/source/tl_2025_48167_roads.shp.
- brazoria-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/brazoria/runtime-assets/source/tl_2025_48039_roads.shp.
- fort-bend-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/fort-bend/runtime-assets/source/tl_2025_48157_roads.shp.
- waller-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/waller/runtime-assets/source/tl_2025_48473_roads.shp.
- austin-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/austin/runtime-assets/source/tl_2025_48015_roads.shp.
- washington-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/washington/runtime-assets/source/tl_2025_48477_roads.shp.
- brazos-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/brazos/runtime-assets/source/tl_2025_48041_roads.shp.
- grimes-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/grimes/runtime-assets/source/tl_2025_48185_roads.shp.
- wharton-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/wharton/runtime-assets/source/tl_2025_48481_roads.shp.
- colorado-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/colorado/runtime-assets/source/tl_2025_48089_roads.shp.
- fayette-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/fayette/runtime-assets/source/tl_2025_48149_roads.shp.
- lavaca-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/lavaca/runtime-assets/source/tl_2025_48285_roads.shp.
- jackson-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/jackson/runtime-assets/source/tl_2025_48239_roads.shp.
- matagorda-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/matagorda/runtime-assets/source/tl_2025_48321_roads.shp.
- calhoun-tx: `roadSourcePresentWhenExpected` — Roads are expected but no local road source file exists at assets/county-implementation/calhoun/runtime-assets/source/tl_2025_48057_roads.shp.

## Failures

- None.

## County Results

| County | Boundary | Roads | Crossings | Package | Result |
| --- | --- | --- | --- | --- | --- |
| Liberty County (`liberty-tx`) | pass | present | present | active | pass |
| Montgomery County (`montgomery-tx`) | pass | warning | present | operational-maintenance | pass with warnings |
| San Jacinto County (`san-jacinto-tx`) | pass | present | present | operational-maintenance | pass |
| Chambers County (`chambers-tx`) | pass | present | present | active | pass |
| Jefferson County (`jefferson-tx`) | pass | present | present | active | pass |
| Hardin County (`hardin-tx`) | pass | warning | present | active | pass with warnings |
| Polk County (`polk-tx`) | pass | present | present | active | pass |
| Walker County (`walker-tx`) | pass | warning | present | active | pass with warnings |
| Harris County (`harris-tx`) | pass | present | present | active | pass |
| Orange County (`orange-tx`) | pass | warning | present | active | pass with warnings |
| Jasper County (`jasper-tx`) | pass | warning | present | active | pass with warnings |
| Newton County (`newton-tx`) | pass | warning | present | active | pass with warnings |
| Tyler County (`tyler-tx`) | pass | warning | present | active | pass with warnings |
| Galveston County (`galveston-tx`) | pass | warning | present | active | pass with warnings |
| Brazoria County (`brazoria-tx`) | pass | warning | present | active | pass with warnings |
| Fort Bend County (`fort-bend-tx`) | pass | warning | present | active | pass with warnings |
| Waller County (`waller-tx`) | pass | warning | present | active | pass with warnings |
| Austin County (`austin-tx`) | pass | warning | present | active | pass with warnings |
| Washington County (`washington-tx`) | pass | warning | present | active | pass with warnings |
| Brazos County (`brazos-tx`) | pass | warning | present | active | pass with warnings |
| Grimes County (`grimes-tx`) | pass | warning | present | active | pass with warnings |
| Wharton County (`wharton-tx`) | pass | warning | present | active | pass with warnings |
| Colorado County (`colorado-tx`) | pass | warning | present | active | pass with warnings |
| Fayette County (`fayette-tx`) | pass | warning | present | active | pass with warnings |
| Lavaca County (`lavaca-tx`) | pass | warning | present | active | pass with warnings |
| Jackson County (`jackson-tx`) | pass | warning | present | active | pass with warnings |
| Matagorda County (`matagorda-tx`) | pass | warning | present | active | pass with warnings |
| Calhoun County (`calhoun-tx`) | pass | warning | present | active | pass with warnings |

## Validation

1. `node --check js/app.js`
2. `node --check scripts/v820-regional-runtime-certification.mjs`
3. `node scripts/v820-regional-runtime-certification.mjs --json`
4. Browser helper: `window.gridlyRegionalRuntimeCertification?.()`
