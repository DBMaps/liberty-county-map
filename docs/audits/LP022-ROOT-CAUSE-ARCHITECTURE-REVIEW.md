# LP022 Root-Cause Architecture Review — Community-Relative Location Addendum

Branch: `LP022-AUTHORITATIVE-LOCATION-REPAIR`  
Scope: investigation-only correction; no production rendering, submission, synchronization, marker, focus, clearing, crossing, Story Engine, awareness-cache, or refresh-ownership behavior was changed.

## Quick summary

The prior LP022 architecture conclusion was **incomplete**. The current live-report presentation path does not prove that a selected road name is required for a truthful consumer location such as `1 mile north of Goodrich`. Gridly already contains a community-relative resolver that can calculate this output from report coordinates plus configured awareness/community coordinates: `resolveGridlyV313RoadHazardCommunityDistance()` ranks configured communities by `haversineDistance()`, derives a coarse cardinal direction from coordinate deltas, and formats `distance direction of community` text. The road-relative resolver and the community-relative resolver are separate capabilities.

## Corrected capability separation

### A. Road-relative location

Examples: `Near FM 1988`, `On US 59`, `At Main Street`.

Current owners and inputs include `gridlyBuildRoadHazardSubmissionLocationPayload()`, `resolveNearestRoadName()`, road/crossing candidate fields, and selected road metadata. Road-relative output may be empty when `selectedRoadName` is empty, stale, or intentionally rejected.

### B. Community-relative location

Examples: `1 mile north of Goodrich`, `3 miles southwest of Livingston`, `Near Dayton`.

Community-relative output does **not** require `selectedRoadName`. The historical/current calculation owner is `resolveGridlyV313RoadHazardCommunityDistance(coords)`, called by `buildGridlyCanonicalRoadHazardDisplayLocation(record, options)`. Its required inputs are a report coordinate, configured community anchors in `GRIDLY_AWARENESS_AREA_DEFINITIONS`, `haversineDistance()`, and the V313 formatter. The current implementation supports the four primary directions (`north`, `south`, `east`, `west`); it does not calculate eight-way intercardinal phrases such as `southwest`.

## Origin of the exact `1 mile north of Goodrich` expectation

Repository-wide and git-history search found the exact phrase first in commit `52445597815cf7289356188e228928f673a402d6` (`LP022 authoritative location repair`, authored and committed July 18, 2026). That commit added LP022 sample records in `gridlyLp022AuthoritativeLocationAudit()` with a community flooding sample containing `canonicalDisplayLocation: "1 mile north of Goodrich"` and an official construction sample containing `canonicalDisplayLocation: "US 59, 1 mile north of Goodrich"`.

The expectation was intended to validate **consumer preservation and prioritization of already-authoritative canonical location fields**, not to validate the community-distance calculation itself. The sample fixture already includes `canonicalDisplayLocation`; it does not include the raw report coordinate or Goodrich anchor needed to prove calculation inside the LP022 resolver. No evidence in the introducing commit establishes that the phrase came from a browser-observed live report. The valid historical reason for the expectation is that the broader road-hazard location pipeline, introduced earlier in `6cdb72bc9fcb75653debc545ca96b82dbaaa76ad` (`Fix V915 recency ranking certification`, July 9, 2026), already contained a resolver that could produce this class of phrase from coordinates.

## Historical function and commit trace

| Capability | Function / path | Commit trace | Finding |
| --- | --- | --- | --- |
| Community anchor registry | `GRIDLY_AWARENESS_AREA_DEFINITIONS`; later `GRIDLY_V905_COMMUNITY_MAP_FOCUS` for package/community focus coordinates | Present in current app; package seed also defines `communityCoordinates` | Goodrich and other communities have trusted point anchors suitable for relative calculation. |
| Distance helper | `haversineDistance()` | Present in current app and tests | Returns mile distances used by community ranking and other geospatial features. |
| Community-distance formatter | `formatGridlyV313RoadHazardDistanceMiles()` | Introduced with V313/V915 history in `6cdb72b` | Rounds under 10 miles to whole miles and pluralizes `mile/miles`. |
| Nearest-community selection + direction | `resolveGridlyV313RoadHazardCommunityDistance(coords)` | Introduced in `6cdb72b` | Ranks all awareness areas by haversine distance and derives `north/south/east/west` from the report-community coordinate delta. |
| Canonical hazard display assembly | `buildGridlyCanonicalRoadHazardDisplayLocation()` | Introduced in `6cdb72b` | Uses prebuilt canonical fields first; otherwise combines road + community-relative text, road only, or community-relative text only. |
| Immediate local report enrichment | `applyGridlyCanonicalRoadHazardDisplayLocation(localHazardEntry, { submittedCoordinate: { lat, lng } })` in the post-insert local path | Introduced in `6cdb72b` | The calculation is still invoked for the immediate local accepted hazard entry after successful Supabase insert. |
| Persisted normalized live-report preservation | `normalizeReports()` preservation of structured canonical fields | Strengthened by `b612f1e` | Live reports preserve canonical fields only if they are present in structured metadata or row fields. |

## Current Gridly data sufficiency

Gridly has sufficient trusted data to calculate a truthful community-relative phrase from an ordinary report coordinate:

- `GRIDLY_AWARENESS_AREA_DEFINITIONS` contains operational point anchors for Liberty, Montgomery, San Jacinto, Chambers, and Jefferson awareness areas.
- `GRIDLY_V905_COMMUNITY_MAP_FOCUS` contains Polk community focus coordinates including `goodrich` at approximately `30.6071, -94.9460`.
- `tools/CountyPromotion/county-promotion-metadata.seed.json` contains Polk `communityCoordinates`, including `Goodrich` at `30.6085, -94.9466`.
- The V313 resolver requires only a report coordinate, a configured community coordinate, `haversineDistance()`, and its formatter. Those inputs are sufficient for an approximate consumer phrase such as `1 mile north of Goodrich`, subject to the known limitation that the current direction algorithm is four-way and delta-based rather than a true bearing/compass-sector calculation.

## Live flooding report path with geographic inputs

1. **Tapped coordinate / submitted coordinate**: captured as `lat,lng`; post-submit debug also records original tap, snap, final placement, and rendered marker coordinates.
2. **Selected road name**: `gridlyBuildRoadHazardSubmissionLocationPayload()` may populate road identity fields when an explicit, cached, or resolver road is accepted; otherwise it returns no road payload.
3. **Community-relative calculation point**: `gridlyBuildRoadHazardDetailLocationMetadata()` and `applyGridlyCanonicalRoadHazardDisplayLocation()` can call `buildGridlyCanonicalRoadHazardDisplayLocation()` with `submittedCoordinate`.
4. **Nearest configured community**: `resolveGridlyV313RoadHazardCommunityDistance()` ranks configured awareness areas by `haversineDistance()`.
5. **Community anchor coordinate**: read from configured awareness/community anchors; Goodrich exists in Polk focus/seed data, while operational active areas exist in `GRIDLY_AWARENESS_AREA_DEFINITIONS`.
6. **Distance**: calculated by `haversineDistance()` and formatted by `formatGridlyV313RoadHazardDistanceMiles()`.
7. **Bearing / direction**: no true bearing function is used by the community-relative resolver; it derives coarse cardinal direction from latitude/longitude deltas.
8. **Generated phrase**: `resolveGridlyV313RoadHazardCommunityDistance()` returns `text`, e.g. `1 mile north of Goodrich` when Goodrich is nearest and the report is roughly one mile north.
9. **Persisted metadata**: the fallback Supabase row path only inserts allowed base report columns; structured canonical fields survive later refresh only if persisted in row/structured metadata or retained in local accepted hazard inventory.
10. **Normalized/canonical/rendered fields**: `normalizeReports()` now preserves canonical fields when present, and LP022 presentation consumers prefer `canonicalDisplayLocation` and related authoritative fields. If the calculated canonical text never reaches persisted structured metadata or the later refresh source record, the consumer resolver cannot render it.

## Regression / disconnection boundary

The best-supported boundary is not removal of the calculation function. The community-relative capability exists in current code and was introduced in `6cdb72b`. The disconnection is an **ownership/persistence/presentation boundary**:

- Last known commit where the calculation capability and immediate local accepted-hazard enrichment existed: `6cdb72bc9fcb75653debc545ca96b82dbaaa76ad`.
- First commit where the LP022 sample expectation appeared: `52445597815cf7289356188e228928f673a402d6`.
- The current normalized live refresh can only preserve canonical community-relative text if the text is present in row fields or structured metadata. Therefore, ordinary refreshed live reports without persisted canonical fields may fall back to road/county/other presentation candidates even though the report coordinate and community data remain available.
- Classification: **ownership/persistence loss or bypass**, not raw data loss and not calculation removal. The underlying coordinate data and community anchors remain available; the calculation is not universally owned by the authoritative community-report adapter at normalization/render time.

## Corrected architecture recommendation

Source-specific adapters remain appropriate, but the Community Location Adapter must be evaluated as owner of both:

1. trusted road-relative location, and
2. calculated community-relative location from report coordinate + trusted community anchors.

The review must not conclude that `Polk County` or any county label is the strongest truthful output solely because `selectedRoadName` is empty. A county label is only the broadest fallback after checking whether a trusted community-relative calculation can be made and preserved.

## Investigation-only audit recommendation

Add a disabled/audit-only diagnostic milestone before production repair. For each sampled live community report, expose side-by-side:

- report id and source stage;
- tapped/submitted/final coordinate;
- selected road name and road resolver source;
- active/selected awareness area and county;
- nearest configured community;
- community anchor coordinate;
- distance to community;
- true bearing if a future bearing helper is added, plus current coarse cardinal direction;
- formatted community-relative location;
- whether `resolveGridlyV313RoadHazardCommunityDistance()` exists;
- whether `buildGridlyCanonicalRoadHazardDisplayLocation()` invoked it;
- whether the resulting text was written to canonical fields;
- whether canonical fields were persisted, normalized, and rendered;
- first stage where the calculated location was lost or bypassed.

## Recommended smallest safe next milestone

Create an audit-only Community Location Adapter trace that runs after report normalization and before presentation selection, without changing rendered output. It should compute the candidate community-relative phrase, compare it to existing canonical fields, and report the first loss stage. Only after that trace proves ownership should a separate production milestone decide whether to persist or render the calculated phrase.

## Merge recommendation

**Do not merge as a production repair.** This addendum is investigation-only documentation for `LP022-AUTHORITATIVE-LOCATION-REPAIR` and should be reviewed as a correction to the architecture finding, not as authorization to change live report rendering.
