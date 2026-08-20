# Statewide live certification cohort v1

## Decision boundary

This is an **audit-only cohort design**. It makes no production change and does not claim that representative testing directly live-certifies all 1,859 communities. The confidence labels remain separate: **REPOSITORY_CERTIFIED** covers all 1,859 checked-in contracts; **ARCHITECTURE_LIVE_CERTIFIED** is available only after every material vector passes live; **DIRECTLY_LIVE_CERTIFIED** applies only to the communities actually observed.

## Six unresolved live-browser classes

### `DRIVETEXAS_LIVE_BROWSER_REQUIRED`

- **Description:** DriveTexas provider lifecycle, governed source-health envelope, current-area records, and consumer publication counts
- **Production owner:** DriveTexas provider/runtime
- **Why repository evidence cannot close it:** Static contracts cannot execute configured network requests or observe terminal source health and current-area publication.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** Observe request lifecycle, terminal health, current-area IDs/count, consumer-envelope count, and active county/community ownership.
- **Pass condition:** A successful current fetch is explicitly HEALTHY_WITH_DATA or governed HEALTHY_EMPTY; identities/counts and current ownership converge.
- **Fail condition:** Timeout, unavailable/failed/stale state represented as healthy empty; absent envelope; mismatched counts; or stale ownership.

### `OFFICIAL_ROADWAY_LIVE_BROWSER_REQUIRED`

- **Description:** Official Roadway consumer presentation and marker publication
- **Production owner:** Official Roadway consumer/map publication
- **Why repository evidence cannot close it:** The repository proves wiring and eligibility, not the live DriveTexas result or rendered Leaflet marker set.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** Observe source, eligible, published/rendered counts and stable marker identities for the current area.
- **Pass condition:** Counts reconcile and every published map-owned record resolves to the existing exact marker identity.
- **Fail condition:** Count/identity divergence, duplicate marker, missing marker, or previous-area publication remains.

### `ALERTS_LIVE_BROWSER_REQUIRED`

- **Description:** Alerts active-row publication and rendered presentation
- **Production owner:** Alerts consumer/presentation
- **Why repository evidence cannot close it:** Repository policy cannot establish current live records or attached heading/card DOM.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** Observe eligible active IDs, displayed IDs, empty reason, heading attachment, card attachment, and ownership.
- **Pass condition:** Nonzero IDs/counts match exactly, or zero is accompanied by a legitimate governed empty reason; DOM is attached and current-owned.
- **Fail condition:** Silent/mislabelled zero, count/ID mismatch, detached presentation, cleared record, or stale card.

### `RAIL_LIVE_BROWSER_REQUIRED`

- **Description:** Rail viewport, Leaflet marker, and DOM identity parity
- **Production owner:** Rail consumer/rendering
- **Why repository evidence cannot close it:** A manifest and governed count cannot prove runtime hydration, viewport policy, Leaflet layers, or attached DOM.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** Observe source county, inventory count, awareness/policy-visible IDs, Leaflet IDs, and DOM IDs.
- **Pass condition:** ACTIVE_EMPTY has zero runtime inventory; ACTIVE_POSITIVE hydrates current county and policy-visible, Leaflet, and DOM ID sets are exactly equal.
- **Fail condition:** Unexpected nonzero empty state, missing positive inventory, source mismatch, or any ID-set difference.

### `SHOW_ON_MAP_LIVE_BROWSER_REQUIRED`

- **Description:** Alerts Show on map presentation and focus behavior
- **Production owner:** Alerts-to-map interaction
- **Why repository evidence cannot close it:** Static publication contracts cannot click the action, know initial viewport visibility, or observe focus of an existing marker.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** For an exact map-owned alert marker, observe action exposure and focus both offscreen and already-visible cases; record a legitimate no-target state only if encountered.
- **Pass condition:** Action focuses the existing exact marker without duplication; already-visible behavior remains stable; no-target records do not expose a false action.
- **Fail condition:** Hidden action for valid target, wrong/new duplicate marker, failed focus, disruptive visible-marker behavior, or false action for no target.

### `STALE_OWNERSHIP_LIVE_BROWSER_REQUIRED`

- **Description:** Stale previous-community and previous-county cleanup across transitions
- **Production owner:** Shared active-context and all consumers
- **Why repository evidence cannot close it:** Repository snapshots do not execute transitions or prove disposal of prior runtime/DOM state.
- **Communities affected:** 1859
- **Counties affected:** 254
- **Required live observation:** After every transition observe selected canonical community, active county, roadway/rail source counties, and absence of predecessor DriveTexas, rail, awareness, and alert identities.
- **Pass condition:** All current identities/sources converge and every predecessor-owned record, marker, and card is absent.
- **Fail condition:** Any convergence mismatch or any predecessor-owned state survives settlement.

## State-vector inventory

The material vector is `(identity, roadway state, roadway loader, rail state)`. DriveTexas, Alerts, Official Roadway, and Show on map repository contracts are invariant over all rows; their data/empty, target/no-target, and viewport outcomes are live and therefore are not falsely promoted into repository-known vector dimensions. Exact counts are payload magnitudes, not distinct loader paths.

| Vector | Identity | Roadway | Loader | Rail | Communities | Counties | First candidates |
|---|---|---|---|---|---:|---:|---|
| SV-01 | SINGLE_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | generic | ACTIVE_EMPTY | 5 | 1 | Chester / tyler-tx, Colmesneil / tyler-tx, Ivanhoe / tyler-tx, Warren / tyler-tx, Woodville / tyler-tx |
| SV-02 | SINGLE_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | generic | ACTIVE_POSITIVE | 181 | 22 | Alamo Beach / calhoun-tx, Alvin / brazoria-tx, Anahuac / chambers-tx, Anderson / grimes-tx, Angleton / brazoria-tx |
| SV-03 | SINGLE_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | partitioned | ACTIVE_POSITIVE | 197 | 7 | Abram / hidalgo-tx, Addison / dallas-tx, Alamo / hidalgo-tx, Alamo Heights / bexar-tx, Allen / collin-tx |
| SV-04 | SINGLE_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | single | ACTIVE_POSITIVE | 29 | 2 | Ames / liberty-tx, Conroe / montgomery-tx, Cut and Shoot / montgomery-tx, Daisetta / liberty-tx, Dayton / liberty-tx |
| SV-05 | SINGLE_COUNTY_PLACE | ROADWAY_WITH_DATA | generic | ACTIVE_EMPTY | 140 | 51 | Airport Road Addition / brooks-tx, Albany / shackelford-tx, Allison / wheeler-tx, Amaya / zavala-tx, Andrews / andrews-tx |
| SV-06 | SINGLE_COUNTY_PLACE | ROADWAY_WITH_DATA | generic | ACTIVE_POSITIVE | 1109 | 168 | Abbott / hill-tx, Acala / hudspeth-tx, Adrian / oldham-tx, Agua Dulce / el-paso-tx, Agua Dulce / nueces-tx |
| SV-07 | SINGLE_COUNTY_PLACE | ROADWAY_WITH_DATA | partitioned | ACTIVE_POSITIVE | 30 | 1 | Aldine / harris-tx, Atascocita / harris-tx, Barrett / harris-tx, Bellaire / harris-tx, Bunker Hill Village / harris-tx |
| SV-08 | SINGLE_COUNTY_PLACE | ROADWAY_WITH_DATA | single | ACTIVE_POSITIVE | 5 | 1 | Cape Royale / san-jacinto-tx, Coldspring / san-jacinto-tx, Oakhurst / san-jacinto-tx, Point Blank / san-jacinto-tx, Shepherd / san-jacinto-tx |
| SV-09 | MULTI_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | generic | ACTIVE_POSITIVE | 19 | 14 | Baytown / chambers-tx, Cinco Ranch / fort-bend-tx, Friendswood / galveston-tx, Houston / fort-bend-tx, Katy / fort-bend-tx |
| SV-10 | MULTI_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | partitioned | ACTIVE_POSITIVE | 48 | 21 | Carrollton / collin-tx, Cedar Hill / dallas-tx, Cedar Park / travis-tx, Celina / collin-tx, Cibolo / bexar-tx |
| SV-11 | MULTI_COUNTY_PLACE | ROADWAY_EXPECTED_EMPTY | single | ACTIVE_POSITIVE | 2 | 4 | Big Thicket Lake Estates / liberty-tx, Cleveland / liberty-tx |
| SV-12 | MULTI_COUNTY_PLACE | ROADWAY_WITH_DATA | generic | ACTIVE_EMPTY | 10 | 17 | Abilene / jones-tx, Ackerly / dawson-tx, Alba / rains-tx, Blackwell / coke-tx, Lake Medina Shores / bandera-tx |
| SV-13 | MULTI_COUNTY_PLACE | ROADWAY_WITH_DATA | generic | ACTIVE_POSITIVE | 81 | 88 | Abernathy / hale-tx, Amarillo / potter-tx, Aransas Pass / aransas-tx, Austin / bastrop-tx, Azle / parker-tx |
| SV-14 | MULTI_COUNTY_PLACE | ROADWAY_WITH_DATA | partitioned | ACTIVE_POSITIVE | 3 | 3 | The Woodlands / harris-tx, Tomball / harris-tx, Waller / harris-tx |

The JSON lists **every** candidate representative for every vector, including governed memberships. The fourteen observed combinations are the complete cross-product subset actually present; absent combinations are not manufactured.

## Deterministic minimum and geography

Exact set cover requires at least one community per mutually exclusive vector, so the architectural lower bound and optimum are both **14**. Fredericksburg is pinned to its vector to reuse owner evidence. Candidate ties then add an uncovered required region where possible and break by canonical key. The chosen representatives also cover all eight required regions, so the geographically augmented cohort remains **14 total**.

| Seq | Region | County | Community | Vector | Existing evidence |
|---:|---|---|---|---|---|
| 1 | East Texas | tyler-tx | Chester | SV-01 | no |
| 2 | Gulf Coast | chambers-tx | Anahuac | SV-02 | no |
| 3 | North Texas | dallas-tx | Addison | SV-03 | no |
| 4 | East Texas | liberty-tx | Ames | SV-04 | no |
| 5 | Central Texas | gillespie-tx | Fredericksburg | SV-05 | yes |
| 6 | Border | hudspeth-tx | Acala | SV-06 | no |
| 7 | Gulf Coast | harris-tx | Aldine | SV-07 | no |
| 8 | East Texas | san-jacinto-tx | Cape Royale | SV-08 | no |
| 9 | Gulf Coast | chambers-tx | Baytown | SV-09 | no |
| 10 | South Texas | bexar-tx | Cibolo | SV-10 | no |
| 11 | East Texas | liberty-tx | Big Thicket Lake Estates | SV-11 | no |
| 12 | West Texas | jones-tx | Abilene | SV-12 | no |
| 13 | Panhandle | potter-tx | Amarillo | SV-13 | no |
| 14 | Gulf Coast | harris-tx | The Woodlands | SV-14 | no |

## Required controls and truthful statuses

| Control | Design status |
|---|---|
| single-county canonical PLACE | `COVERED` |
| multi-county canonical PLACE | `COVERED` |
| roadway with data | `COVERED` |
| roadway expected empty | `COVERED` |
| every actual roadway loader architecture | `COVERED` |
| rail ACTIVE_POSITIVE | `COVERED` |
| rail ACTIVE_EMPTY | `COVERED` |
| DriveTexas HEALTHY_WITH_DATA live case | `ALREADY_DIRECTLY_LIVE_CERTIFIED` |
| DriveTexas HEALTHY_EMPTY live case | `LIVE_OUTCOME_TO_DISCOVER` |
| DriveTexas source-failure disclosure | `SAFE_REPRODUCTION_NOT_AVAILABLE_NO_PRODUCTION_MUTATION` |
| Alerts nonzero publication | `ALREADY_DIRECTLY_LIVE_CERTIFIED` |
| Alerts legitimate zero | `LIVE_OUTCOME_TO_DISCOVER` |
| Official Roadway nonzero marker publication | `ALREADY_DIRECTLY_LIVE_CERTIFIED` |
| exact alert → existing marker identity | `ALREADY_DIRECTLY_LIVE_CERTIFIED` |
| Show on map for an offscreen marker | `ALREADY_DIRECTLY_LIVE_CERTIFIED` |
| Show on map when marker is already visible | `LIVE_OUTCOME_TO_DISCOVER` |
| alert with no map target | `STATE_NOT_PRESENT_IN_CERTIFIED_POPULATION` |
| stale previous-community cleanup | `COVERED_BY_TRANSITIONS` |
| community-to-community transition | `COVERED_BY_TRANSITIONS` |
| county-to-county transition | `COVERED_BY_TRANSITIONS` |
| multi-county PLACE transition | `COVERED_BY_TRANSITIONS` |
| current active county convergence | `COVERED_BY_EACH_NEW_RUN` |
| current canonical community convergence | `COVERED_BY_EACH_NEW_RUN` |
| roadway source county convergence | `COVERED_BY_EACH_NEW_RUN` |
| rail source county convergence | `COVERED_BY_EACH_NEW_RUN` |

`LIVE_OUTCOME_TO_DISCOVER` means the repository cannot promise which selected area will have that transient live result. It must be recorded when encountered and must not be inferred. Source failure has no safe design-time reproduction without mutation. A no-map-target alert is reported exactly as `STATE_NOT_PRESENT_IN_CERTIFIED_POPULATION` because the certified repository does not identify one.

## Fredericksburg existing live control

Fredericksburg (`place-4827348`, Gillespie) closes: single-county identity; `ROADWAY_WITH_DATA`; generic loader; rail `ACTIVE_EMPTY`/0; DriveTexas `HEALTHY_WITH_DATA` with current-area and envelope count 1; Alerts nonzero publication and attached heading/card; Official Roadway source/eligible/rendered count 1; exact existing Leaflet marker identity; initially offscreen marker; and Show on map exposure/focus. It requires **no duplicate test**. Its transition into the following cohort row still supplies new cleanup evidence and does not repeat the Fredericksburg interaction.

## Owner itinerary and assertions

The JSON is authoritative and the CSV is a flat transport form. Each row carries all required identity, vector, observation, transition, action, pass/failure, effort, and prior-evidence fields. The sequence deliberately includes single→single, single→multi, multi→single, county changes, and multi-county ownership. After settlement, every new row must converge canonical community, active county, roadway source county, and rail source county, and must contain no predecessor-owned DriveTexas IDs, rail markers, awareness IDs, or alert cards.

## Harness assessment

**LP215 HARNESS REUSABLE = NO (not unchanged).** Its core observation strategy is reusable, but the browser helper hardcodes the LP215 report URL, 254-row validation/completion, LP215 row names, and automatic workflow.

**AUDIT-ONLY HARNESS CHANGE REQUIRED = YES.** The smallest future change is an audit-only fork/wrapper that loads this cohort JSON, maps cohort fields into the existing snapshots, replaces hardcoded 254 values with `itinerary.length`, and adds pause/result fields for manual Show on map controls. Preserve the existing highest-level production selection action, terminal health classification, settlement waits, checkpoint/resume, exact stable-ID parity, stale cleanup, and one-export behavior. Do not alter production.

Preferred future owner flow: open Gridly once; open DevTools once; paste one bootstrap; let the harness run the cohort and checkpoint; interact only on flagged map controls; export one JSON result.

## Coverage estimate

- **TOTAL COMMUNITIES = 1859**
- **TOTAL COUNTIES = 254**
- **DISTINCT STATE VECTORS = 14**
- **MINIMUM ARCHITECTURAL COHORT = 14**
- **GEOGRAPHICALLY AUGMENTED COHORT = 14**
- **COMMUNITIES ALREADY COVERED BY FREDERICKSBURG = 1**
- **ADDITIONAL OWNER TEST COMMUNITIES = 13**
- **PERCENT OF COMMUNITIES REPRESENTED BY EQUIVALENT STATE VECTOR = 100.0%**
- **PERCENT OF COUNTIES REPRESENTED BY EQUIVALENT STATE VECTOR = 100.0%**
- **UNIQUE STATES REQUIRING DIRECT LIVE TEST = 13**
- **ESTIMATED OWNER TIME = 45–70 minutes**

The 100% figures mean every certified community/county belongs to a represented equivalent repository vector—not that every one was directly observed. A successful run establishes architecture-level evidence for all vectors and direct evidence only for the 14 itinerary communities (with Fredericksburg already recorded at design time).

## Stop point

Cohort design is complete and ready for a later owner cohort-harness implementation. No browser harness or production repair is implemented here.
