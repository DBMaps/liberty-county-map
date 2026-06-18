# GRIDLY Montgomery Runtime Data Source Integration — V598

## Final Determination

**MONTGOMERY RUNTIME DATA SOURCE INTEGRATION COMPLETE WITH OBSERVATIONS**

## Root Fix Summary

V598 moves Montgomery runtime behavior from downstream text cleanup to upstream county runtime source selection. Producer systems now resolve county-dependent boundary, road, crossing, awareness, metadata, and event-row visibility inputs through an active county runtime source registry.

## Runtime Data Source Inventory

| Runtime area | Liberty source | Montgomery source | V598 status |
| --- | --- | --- | --- |
| County boundary | `data/liberty-county-boundary.geojson` | `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson` | County-aware |
| Road segments | `data/liberty-county-road-segments.geojson` | None present | Montgomery fails safe; no Liberty road candidates |
| Rail crossings | `data/liberty-county-rail-crossings.geojson` plus FRA Liberty URL | None present | Montgomery neutral/pending; no Liberty crossing count |
| Awareness areas | Liberty community list | Montgomery community list | County-aware |
| County defaults | Dayton / Liberty County | Conroe / Montgomery County | County-aware |
| Resolver fallback data | Liberty road labels allowed only in Liberty context | Conroe, Montgomery County, selected awareness area, or `this area` | County-aware |
| Active incident generation inputs | Liberty-tagged plus legacy untagged Liberty-compatible rows | Montgomery-tagged rows only | County-isolated |
| Event history storage / metadata | `liberty-tx` metadata | `montgomery-tx` metadata | County-aware |
| Alert/marker/popup producers | Active county source registry | Active county source registry or neutral fallback | Producer-source fixed |

## Montgomery Road Source Integration

No Montgomery road segment geometry exists in the current package. V598 therefore does **not** fabricate Montgomery road names. The Montgomery road source is explicitly represented as unavailable, roadway loading fails closed with `roadway_dataset_unavailable`, and road resolution can fall back only to Conroe, Montgomery County, the selected awareness area, or neutral `this area` wording.

## Montgomery Rail Crossing Source Integration

No Montgomery rail crossing source exists in the current package. V598 explicitly records this as a runtime data blocker and prevents Liberty crossing paths/counts from acting as Montgomery crossing data. Montgomery crossing state is neutral/pending with an empty feature collection if crossing loading is invoked before Montgomery crossing data is supplied.

## County-Aware Runtime Source Registry

The runtime source registry maps each active county to its boundary, road, crossing, crossing review, and awareness sources. Producers bind to this registry instead of direct Liberty defaults.

Minimum V598 mapping:

- `liberty-tx`
  - Boundary: `data/liberty-county-boundary.geojson`
  - Roads: `data/liberty-county-road-segments.geojson`
  - Crossings: `data/liberty-county-rail-crossings.geojson`
  - Awareness areas: Liberty defaults
- `montgomery-tx`
  - Boundary: `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`
  - Roads: missing / unavailable
  - Crossings: missing / unavailable
  - Awareness areas: Montgomery defaults

## Producer Contract Fix

Producer systems now obey the contract that county-dependent labels, counts, source paths, and storage metadata must come from the active county context or a neutral safe fallback. This covers road resolver inputs, crossing source/count inputs, generated incident filters, hazard lifecycle metadata, alert/popup language, awareness summaries, and local event history metadata.

## Storage and Event History County Isolation

Montgomery active incident generation accepts only `montgomery-tx` rows. Liberty rows and unknown-county rows are excluded from Montgomery. Legacy untagged rows remain Liberty-compatible only, preventing global legacy storage from contaminating Montgomery runtime behavior.

## Protected Boundaries

V598 does not enable historical UI/API systems, DriveTexas, Transportation Intelligence, or migrations. Protected boundaries remain:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `historicalApiExposure: false`
- `consumerFacingHistoryDashboard: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Required Final Statement

Has the Liberty-rooted runtime data/source leakage been fixed at the producer/source layer?

**YES**
