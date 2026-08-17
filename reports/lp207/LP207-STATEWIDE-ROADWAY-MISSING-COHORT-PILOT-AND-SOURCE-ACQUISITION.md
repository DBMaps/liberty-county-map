# LP207 — Statewide Roadway Missing-Cohort Pilot and Source Acquisition

## Decision

**READY_FOR_STATEWIDE_SOURCE_ACQUISITION**

The real owner pilot passed on QGIS 3.44.11 / GDAL 3.13.0 "Iowa City". The earlier environment-only block is preserved as superseded history: it described repository-container limitations, not a source or tool failure. Statewide manufacturing is not ready because only 3 of 226 missing-cohort sources are valid; 223 still require acquisition.

## Owner source certification

The LP207 acquisition tool verified the three existing ZIPs under `C:\GitHub\Gridly-Source-Data\Census\TIGER2025\ROADS`. Every ZIP was valid, contained required members, and was neither downloaded nor overwritten. LP118 used the 254-feature FeatureCollection at `assets/boundaries/texas-counties-boundaries.geojson`. The earlier alternative-boundary invocation failed its input contract and is classified as a superseded invocation error.

## Pilot manufacturing

| County | FIPS | Source features | Retained | Candidate bytes | Candidate SHA-256 | LP116 (twice) |
|---|---:|---:|---:|---:|---|---|
| Lee | 48287 | 3004 | 3004 | 4710026 | `a9d589e476caaf128cb7a8777ccbe9f8d39ad7421e3e073c1d680d8556a55a33` | PASS |
| Milam | 48331 | 4292 | 4292 | 6719460 | `374ae91f11f30e0227065ab7704fd96f424edb40f2098b89c95acd98126386a9` | PASS |
| Robertson | 48395 | 3391 | 3391 | 6503023 | `40c20e284e68e43b8051ccca6fd1a2d044be4d3ad46eb789698c96863587ecba` | PASS |

All counties had zero rejected, out-of-county, and duplicate features. Both LP116 runs passed per county, produced five files per run, shared three deterministic artifacts, and had deterministic hashes.

## Downstream compatibility

Roadway loader, nearest-road lookup, road-name extraction, and hazard/report road association are **NOT_CERTIFIED** in LP207. The real owner outputs were intentionally not committed, so existing consumer tooling cannot run against hashes/counts alone. LP116 manufacture and determinism passed, but this report does not invent downstream passes or alter production consumers.

## Safety conservation

- Pilot requested/source valid/manufactured/certified: 3 / 3 / 3 / 3
- Pilot activated/uploaded/published: 0 / 0 / 0
- Production roadway counties before/after: 28 / 28
- Supabase roadway writes: 0
- Runtime activations: 0
- Existing governed roadway packages modified: 0
- Runtime manifest SHA-256 before/after: `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd` / `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd`

## Statewide plan

The deterministic, non-executing plan contains 226 missing-cohort entries, 3 owner/local-valid sources, 223 acquisitions required, and zero existing-runtime overlap. No acquisition executed. Dallas (48113) remains the recommended later scale control.
