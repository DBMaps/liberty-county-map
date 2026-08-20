# LP214 Fredericksburg Alerts publication-to-presentation RCA

## Pre-repair condition table

| Stage | Input | Output | Identity / owner | Filter or guard | Result | Reason |
|---|---:|---:|---|---|---|---|
| Published summary selection | 2 candidate references | 1 summary | current canonical area (`place-4827348`) | `isGridlyCachedAwarenessSummaryForCurrentArea` | PASS | Only a current-area Pulse or microline summary is accepted. |
| Published current-area records | 1 hazard | 1 record | published Fredericksburg summary | lifecycle-active predicate | PASS | The DriveTexas Lane Closure is active. |
| Active-community rows | 1 published record | 0 rows | empty canonical active-state projection | canonical array existence | **FAIL — first divergence** | An empty array is truthy, so the helper returned it before consulting the current-area publication. |
| Active-community count | 0 rows | 0 | active-community row helper | `.length` | FAIL (downstream) | Count correctly reflected the already-diverged row set. |
| Visible active incident count | empty snapshot | `null`/0 | Alerts snapshot | visible rows and active count | FAIL (downstream) | The snapshot had no published row representation. |
| Heading ranking | 1 independently visible road hazard | 1 candidate | road-hazard ranking inputs | severity/TxDOT road-hazard priority | PASS | Ranking selected `Road closed on US 87`; it did not prove DOM publication. |
| Published Alerts sheet | 1 published record | 1 card, no semantic panel heading | published-awareness cache | sheet generation/current-area publication | PARTIAL | The card builder did not publish the ranked candidate into the heading DOM contract. |
| Panel audit | selected candidate 1; DOM rows 0 | rendered heading empty; items empty | live Alerts DOM | panel/heading/item selectors | FAIL (downstream) | Candidate selection and rendered evidence were separate paths. |

## Root cause and repair

The first loss was `getGridlyAlertsSurfaceActiveCommunityReportRows`: it treated an
empty canonical projection as authoritative even while the identity-validated shared
publication contained one current-area record. The statewide repair retains non-empty
canonical priority, then bridges a non-empty current-area shared publication, and only
then accepts canonical empty. Thus a legitimate published record is not forced into
Alerts from raw DriveTexas; it is admitted only after the existing Alerts publication
ownership contract has accepted it.

The published sheet now resolves the same ranked heading from its record set and emits
that value through `data-gridly-alerts-panel-heading`, while cards continue to expose
their titles through the existing alert-row contract.

## UTSA / Northwest classification

The value was not retained prior-community state. It came from
`resolveGridlyV313RoadHazardCommunityDistance`, which ranked every static statewide
awareness-area anchor by distance. For the supplied coordinates, UTSA / Northwest was
the nearest anchor in that incomplete anchor set. It was descriptive fallback metadata
and did not produce the selected US 87 heading, but it had the wrong presentation owner.
The resolver now uses only the current canonical presentation context and omits distance
metadata when that context lacks a usable label or coordinate. A prior selected-area
object therefore cannot own a current canonical Fredericksburg candidate.

## Protected contracts

This change does not alter DriveTexas envelope selection or health semantics, Official
Roadway normalization/publication, rail classification/filtering, roadway geometry,
cameras, place coordinates, county geometry, or service-worker behavior.
