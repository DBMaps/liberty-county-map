# LP214 Statewide Alert Semantic Classification and Source Ownership Audit

## Certification scope and finding

This audit applies one source/category contract to all 254 counties, 1,859 canonical communities, 2,058 memberships, and 163 multi-county communities. It contains no Dallas or community-specific mapping. The Dallas card was misclassified: an official DriveTexas bridge/construction record carried prose telling motorists to use another **crossing**, and the legacy `isGridlyAlertRailOrCrossingRelated` fallback treated that word as rail evidence when `Bridge Restriction` was not recognized as an explicit road-hazard category. `buildAlertTitle`, `buildSpecificAlertTitle`, and `normalizeGridlyAlertCardTitleCandidate` then selected crossing presentation copy. The body continued to use the official roadway description, producing the observed contradiction.

The repair makes classification fail closed. Provider/source ownership and explicit normalized category are evaluated before prose. Proximity, geometry, a crossing identifier on a non-crossing report, and the words “crossing,” “bridge,” “closed,” or “blocked” are not rail-blockage evidence.

## Complete production source inventory

| Source | Production entry point | Normalized record / Alert eligibility | Title mapping | Lifecycle owner | Ownership |
|---|---|---|---|---|---|
| Community hazard reports (closure, flooding, crash, construction, disabled vehicle, traffic and other hazards) | shared reports → `activeReports`/`activeHazards` → canonical active community state → `getAlertsSurfaceSnapshot` | Active, geographically owned report; submitted category governs | Submitted road category, otherwise `Community Report` | Community report lifecycle helpers and canonical active-state filter | `COMMUNITY` |
| Crossing/community rail reports | crossing submission → `activeReports` → canonical active community state | Active crossing-owned record with explicit blockage category | `Crossing Blocked` or `Train Blocking Crossing` | Crossing report lifecycle / cleared suppression | `CROSSING` |
| DriveTexas official roadway conditions (road closure, lane closure, bridge restriction, construction, crash, flooding/advisory) | `gridlyDriveTexasConnector` (provider fallback) → `getGridlyOfficialSituationNormalizedRecords` → `buildGridlyOfficialSituationAlert` → `mergeGridlyOfficialSituationAlerts` | Consumer-visible official record in selected awareness geography | Exact roadway taxonomy; unknown category is `Travel Advisory` | DriveTexas authority/consumer selection and official freshness | `OFFICIAL_ROADWAY` |
| Travel-impacting NWS/weather | weather connector/provider → `isGridlyTravelImpactingWeatherSituation` → official situation merge | Only the existing travel-impact filter; no ingestion change | `Weather Alert` | Weather connector/provider | `WEATHER` |
| Legacy TxDOT path | DriveTexas provider fallback in `getGridlyOfficialSituationNormalizedRecords` | Same official category contract | Same roadway taxonomy | Provider/official freshness | `OFFICIAL_ROADWAY` |
| Retained records | Existing provider/canonical record with retention disclosure | Eligible only while lifecycle remains active; retention fields are preserved | Classification remains source/category stable | The retaining source; never the title mapper | Original ownership |
| Cleared/expired/removed records | Canonical cleared suppression and semantic lifecycle check | Not eligible as an active card | No active title | Original source lifecycle | Original ownership |
| Historical sidecars | Canonical active filter | Not Alert eligible | None | Historical intelligence owner | Original ownership |

No separate bridge, lane, crash, construction, or roadway-closure feed was found: these are normalized categories of DriveTexas or community records. Weather is already connected to Alerts, but this phase neither expands nor changes Weather/NWS ingestion.

## Consumer taxonomy and governed evidence

| Classification | Required evidence | Prohibited inference |
|---|---|---|
| Crossing Blocked / Train Blocking Crossing | `CROSSING` ownership **and** explicit `crossing_blocked`, `blocked_crossing`, `rail_crossing_blocked`, `train_blocking_crossing`, `rail_blockage`, or governed delay equivalent | Road/bridge/lane category, prose keywords, proximity or geometry |
| Road Closed | Explicit official or submitted road-closure category | Nearby rail feature or word “crossing” |
| Lane Closure | Explicit lane/shoulder closure category | Generic closed/blocked prose |
| Bridge Restriction | Explicit bridge closure/restriction or governed weight/height restriction category | Word “bridge” alone in unrelated prose |
| Construction | Explicit construction/work-zone/road-work/maintenance category | Detour prose alone |
| Crash | Explicit crash/collision/wreck/accident category | Delay alone |
| Flooding | Explicit flood/high-water/standing-water category | Weather prose without the category |
| Weather Alert | Existing travel-impacting weather provider record | Community or roadway prose |
| Community Report | Active community-owned report without a governed specialized category | Manufacture of official or crossing ownership |
| Travel Advisory | Official roadway record whose category is not in the governed roadway taxonomy | Crossing classification fallback |

## Ownership, consistency, deduplication, and Alerts scope

Source ownership is immutable across presentation: DriveTexas is official roadway, crossing reports are crossing/rail awareness, community submissions remain community, and NWS/weather remains weather. Correlated records retain separate semantic keys because deduplication now includes ownership and classification; a roadway closure and independently evidenced crossing blockage may therefore coexist.

The deterministic consistency check rejects a crossing title without active crossing-owned blockage evidence and rejects active crossing blockage evidence presented under a non-crossing title. It also rejects cleared records as active presentations. Body prose remains source-owned; it is never used to upgrade a roadway record into crossing intelligence.

The Alerts count is the number of active, geographically eligible, deduplicated presentation records in the Alerts surface—not the shared Location Context count. Existing product behavior includes consumer-visible DriveTexas and travel-impacting weather plus active community/crossing reports. Historical/cleared sidecars are excluded. This audit does not force all shared-awareness issues into Alerts and does not change the independently authoritative Location Context count.

## Owner browser retest

1. Select Dallas (`place-4819000`) and wait for the certified DriveTexas count of 8.
2. Open **Alerts** without changing community or route state.
3. Inspect each official card: source must read **Official Roadways** and title must match its normalized DriveTexas category (`Road Closed`, `Lane Closure`, `Bridge Restriction`, `Construction`, `Crash`, or `Travel Advisory`).
4. Confirm the IH-30 construction/bridge-detour card is **not** titled `Crossing Blocked`.
5. If a separately governed active crossing report exists, confirm it remains a distinct `Crossing Blocked`/`Train Blocking Crossing` card.
6. Clear/expire that crossing report and reopen Alerts; confirm its active crossing card disappears.
7. Switch Dallas → another community → Dallas and refresh the source; confirm no stale card leaks and titles remain stable.

Protected confirmation: no DriveTexas connector/provider, LP039 geometry/eligibility, canonical identity, roadway/crossing package, route runtime, or Weather/NWS ingestion code was modified.
