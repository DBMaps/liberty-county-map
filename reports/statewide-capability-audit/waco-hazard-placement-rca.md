# Waco / McLennan hazard-placement root-cause analysis

## Finding

**Classification: stale pre-statewide implementation defect (active runtime configuration), not crossing policy and not an intentional reporting policy.** Waco is a canonical PLACE (`4876000`) in operational `mclennan-tx`. The county registry says boundary `available`, but `GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID` contains only the legacy 28 counties and has no `mclennan-tx` entry. The statewide 254-feature polygon package exists and is readable; the bounds prefilter prevents McLennan from ever becoming a polygon candidate.

## First blocking guard and exact values

1. The selected Waco camera and PLACE identity are valid. Active county is `mclennan-tx`, operational/productionEnabled/selectable are all `true`.
2. Tap Map may collect the Waco coordinate; crossing selection is not required for a road hazard.
3. `createSharedHazardReport()` calls `gridlyResolveCountyIdForCoordinate(lat,lng)`.
4. `gridlyResolveCountyIdForCoordinate()` builds `boundsMatches` only from operational counties for which `gridlyCoordinateInsideCountyBounds()` succeeds.
5. For McLennan, `GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID['mclennan-tx'] === undefined`. Therefore `gridlyCoordinateInsideCountyBounds()` returns `false`, `boundsMatches=[]`, the geometry loader is asked for no McLennan candidate, and the result is `{countyId:null, coordinateInsideSupportedCounty:false}`.
6. `gridlyGetReportSubmissionCountyScopedMetadata()` returns `null`.
7. The **first user-visible rejection** is `if (!countyScopedReportMetadata)` in `createSharedHazardReport()`. It displays: “That location is outside the current coverage area. Move the pin closer to a supported road and try again.” It finalizes with reason `coverage_invalid` and returns `false` **before the Supabase insert**.

The crossing runtime is irrelevant to this guard. Road snapping/context may be incomplete in McLennan, but neither a road artifact nor a crossing association is required by the failing condition.

## Full path assessment

| Stage | Waco result | Evidence |
|---|---|---|
| PLACE selection/camera | Pass | Projection and LP201.3 camera artifacts |
| Active county identity | Pass (`mclennan-tx`) | `GRIDLY_COUNTY_REGISTRY` |
| Awareness selection | Pass, but limited local transportation coverage | Registry awareness areas |
| Tap/GPS placement UI | Opens | Generalized report flow |
| County bounds candidate | **Fail** | Missing McLennan runtime bounds |
| Authoritative polygon containment | Never reached for McLennan candidate | Statewide geometry exists |
| Crossing association | Not required | Non-crossing hazard path |
| Client payload validation | Stops at coverage guard | `createSharedHazardReport()` |
| Supabase insert/RLS | Not attempted; remote policy therefore not the observed cause | Insert follows guard |
| Local optimistic visibility | Not reached | Registration follows accepted insert |

## Repair boundary

Repository-completable after owner authorization: derive all 254 bounds deterministically from the already governed statewide polygon package, replace the hard-coded 28-entry bounds projection, and add a non-writing 254-county centroid/point-on-surface submission simulation. Do not change backend policy or crossing activation as part of that repair. Live persistence/RLS still needs remote validation afterward.
