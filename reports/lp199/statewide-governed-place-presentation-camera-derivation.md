# LP199 — Statewide governed PLACE presentation-camera derivation

## Decision

**NO_SAFE_GENERIC_DERIVATION_FOUND_REQUIRES_DIFFERENT_GOVERNED_SIGNAL**

No new camera is runtime-active. The certified safe model is the four owner-approved overrides followed by the existing canonical internal point; geometry candidates remain review evidence only.

## Current source and root cause

2025 TIGER/Line Texas PLACE DBF INTPTLAT and INTPTLON, copied verbatim and keyed by PLACE GEOID. Census internal points are guaranteed interior identity representatives, not recognizable populated or civic cores; irregular and water-heavy PLACE polygons can therefore frame far from the consumer-recognizable core.

All **1,859** governed consumer PLACE identities and **2,058** county memberships reconcile. The companion JSON contains every identity, membership, current camera, candidate, selected fallback, confidence, extent diagnostic, and provenance record.

## Evidence and candidates

Evaluated current Census internal point, equal-area geometry centroid, GEOS point-on-surface, bounding-box center, and a contained-centroid/point-on-surface hybrid. A populated-core candidate is not evaluable: statewide address density, road density, and another authorized populated-core signal are unavailable. The locked 2025 TIGER/Line polygon and all four geometry candidates cover every PLACE. Coordinates alone do not certify visual direction.

## Owner-approved calibration (metres)

| Candidate | Mean | Total | Maximum |
|---|---:|---:|---:|
| existingCurrentPoint | 4855.401 | 19421.605 | 10562.89 |
| geometryCentroid | 4848.438 | 19393.751 | 10601.011 |
| pointOnSurface | 5020.755 | 20083.022 | 7110.092 |
| boundingBoxCenter | 5738.879 | 22955.515 | 8359.129 |
| hybridContainedCentroid | 4848.438 | 19393.751 | 10601.011 |

## Ten controls

| Place | GEOID | Evidence class | Current camera | Owner-approved camera |
|---|---|---|---|---|
| Amarillo | 4803000 | KNOWN_GOOD_EXISTING_GENERIC | 35.1999034, -101.8301942 | — |
| Austin | 4805000 | KNOWN_GOOD_OWNER_APPROVED | 30.2986219, -97.7541339 | 30.274931186653326, -97.74415969848634 |
| Corpus Christi | 4817000 | KNOWN_BAD_EXISTING_GENERIC | 27.7542524, -97.1733853 | — |
| Dallas | 4819000 | KNOWN_GOOD_OWNER_APPROVED | 32.7933334, -96.7665128 | 32.78294501748632, -96.79538726806642 |
| El Paso | 4824000 | KNOWN_GOOD_OWNER_APPROVED | 31.8477804, -106.4311055 | 31.765537409484374, -106.48704528808595 |
| Fort Worth | 4827000 | KNOWN_GOOD_OWNER_APPROVED | 32.7819538, -97.3485732 | 32.757685346479455, -97.33182907104494 |
| McAllen | 4845384 | KNOWN_BAD_EXISTING_GENERIC | 26.2249657, -98.246083 | — |
| Port Arthur | 4858820 | KNOWN_BAD_EXISTING_GENERIC | 29.9000079, -93.8944195 | — |
| Tyler | 4874144 | KNOWN_BAD_EXISTING_GENERIC | 32.3173339, -95.3063994 | — |
| Waco | 4876000 | KNOWN_BAD_EXISTING_GENERIC | 31.5579941, -97.1897498 | — |

Candidate coordinates and per-control errors are in JSON. Known-bad movement is explicitly uncertified pending rendered browser review.

## Zoom, viewport, and confidence

Zoom **13** is retained. No global padding/offset change is authorized. Confidence totals: `OWNER_APPROVED_OVERRIDE` 4; `DERIVED_HIGH_CONFIDENCE` 0; `DERIVED_REVIEW_RECOMMENDED` 0; `FALLBACK_EXISTING_CAMERA` 1855; `UNRESOLVED` 0.

## Corpus Christi search parity

Corpus Christi is GEOID 4817000 with memberships 48007, 48273, 48355, 48409 and qualifies for LP196 canonical multi-county collapse. Owner-visible duplicate rows are classified as an LP196 parity defect at the visible-picker boundary. Current generic tests cover the repository path; LP199 makes no speculative search/runtime repair.

## Owner visual-review cohort (18)

| Place | GEOID | Safe selected camera |
|---|---|---|
| Dallas | 4819000 | 32.78294501748632, -96.79538726806642 / 13 |
| Fort Worth | 4827000 | 32.757685346479455, -97.33182907104494 / 13 |
| Austin | 4805000 | 30.274931186653326, -97.74415969848634 / 13 |
| El Paso | 4824000 | 31.765537409484374, -106.48704528808595 / 13 |
| Amarillo | 4803000 | 35.1999034, -101.8301942 / 13 |
| Corpus Christi | 4817000 | 27.7542524, -97.1733853 / 13 |
| McAllen | 4845384 | 26.2249657, -98.246083 / 13 |
| Port Arthur | 4858820 | 29.9000079, -93.8944195 / 13 |
| Tyler | 4874144 | 32.3173339, -95.3063994 / 13 |
| Waco | 4876000 | 31.5579941, -97.1897498 / 13 |
| Lubbock | 4845000 | 33.5619007, -101.888883 / 13 |
| Alpine | 4802104 | 30.3639055, -103.6644561 / 13 |
| Laredo | 4841464 | 27.5603789, -99.4891809 / 13 |
| Nacogdoches | 4850256 | 31.6123641, -94.6520458 / 13 |
| Temple | 4872176 | 31.1049362, -97.3885117 / 13 |
| Galveston | 4828068 | 29.1863276, -94.9657583 / 13 |
| Brownsville | 4810768 | 25.9894042, -97.4806255 / 13 |
| Denton | 4819972 | 33.2174488, -97.1413455 / 13 |

Review current and candidate centers using SEARCH → SELECT → CAMERA → RELOAD and record where the recognizable label/core falls inside the usable viewport.

## Activation recommendation

**DO_NOT_ACTIVATE; seek owner visual evidence and a separately governed statewide populated-core signal before LP200 activation.** Runtime camera registry, LP197 registry, identities, memberships, ZIPs, awareness arrays, Houston, San Antonio, Route Watch, and `js/app.js` are unchanged.
