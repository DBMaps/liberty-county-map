# LP035 — Houston Awareness Regionalization

## Quick summary

LP035 audited the Harris/Houston ownership model and defines a safe Houston regionalization model, but does **not** activate region selection in production. The existing selector and filtering stack use a single community/awareness-area value, so a safe three-level `Harris County → Houston → Houston Region` rollout requires a focused LP035.1 implementation milestone rather than a broad selector rewrite in this investigation task.

## Current Houston ownership model

| Surface | Current Houston ownership |
| --- | --- |
| `GRIDLY_COUNTY_REGISTRY` | `harris-tx` uses `defaultCity: "Houston"` and includes `"Houston"` in `defaultAwarenessAreas`, so Houston is both the default city identity and a selectable awareness community. |
| County/community configuration | Harris County is operational, production-enabled, selectable, and Harris-owned. Its configured awareness list is a flat county/community list. |
| Awareness-area registry | Houston exists as a Harris awareness-area definition with a city-center seed, radius-style filtering, and startup zoom. |
| Community selectors | Selectors consume awareness-area definitions and store a single selected community string; no separate subregion state is available. |
| Hierarchical county/community selection | County and community hierarchy exists, but not a third region level. |
| Active county state | Harris County is tracked by county id (`harris-tx`). |
| Active community state | Houston is represented by the literal display/storage value `Houston`. |
| Awareness mode | Houston acts as an awareness area, not a parent with children. |
| Report submission ownership | Reports can carry county/community ownership; Houston is currently a broad community/locality label. |
| Normalized community reports | Existing reports with `community: "Houston"` remain broad parent-city records. |
| DriveTexas incident filtering | Official records are filtered against the active awareness area by coordinate/radius and text fallback; Houston is a broad city-center awareness area. |
| Alerts filtering | Alerts use the selected awareness/county context and do not have Houston region metadata. |
| Crossing filtering | Crossing consumers are county/awareness-area aware but do not have Houston subregion ownership. |
| Community Pulse / Travel Brief / Know Before You Go | These surfaces read selected county/community awareness context; they do not have separate Houston region state. |
| Saved preferences / onboarding / setup | Existing saved values can include `Houston` as the selected awareness/home-town value. |
| Map centering and zoom | Houston has a city-center seed and startup zoom; region-specific bounds are absent. |
| County switching | County switching preserves a single active county plus selected awareness/community fallback. |
| URL/local storage persistence | Persistence is community-string compatible; region ID persistence is not present. |

## Every current literal `Houston` semantic reference audited

- `harris-tx.defaultCity` makes Houston the default city identity for Harris County.
- `harris-tx.defaultAwarenessAreas` makes Houston a selectable Harris awareness community.
- Road-direction context uses Houston as a directional destination label for selected routes; this is not awareness ownership.
- DriveTexas fixture/audit data uses Houston as a TxDOT district string for Montgomery examples; this is provider metadata, not Harris/Houston locality ownership.
- Harris community coverage audit uses Houston as a map seed and support record.
- Local destination/search seeds use Houston as a city/locality label.
- Tests use Houston in search/destination containment and directional guidance assertions.

## Final recommended Houston region list

| ID | Display label | Included areas | Excluded communities | Map seed | Geometry source/strategy | Consumer rationale |
| --- | --- | --- | --- | --- | --- | --- |
| `houston-downtown-midtown` | Downtown / Midtown | Downtown, Midtown, EaDo west edge, Fourth Ward | West University Place, Bellaire | 29.7532, -95.3670 | City Super Neighborhood and management district polygon synthesis | Central civic/event and commuter core. |
| `houston-heights-near-northside` | Heights / Near Northside | Heights, Greater Heights, Near Northside, Independence Heights | North Houston, Aldine | 29.7989, -95.3980 | Super Neighborhood polygons clipped against separately owned communities | Common inner-north consumer label. |
| `houston-montrose-museum` | Montrose / Museum District | Montrose, Museum District, Neartown, Upper Kirby east edge | West University Place | 29.7372, -95.3970 | Super Neighborhood and district polygons | Central-west events, nightlife, museum, and arterial relevance. |
| `houston-med-center-rice` | Medical Center / Rice | Texas Medical Center, Rice Village, Braeswood Place, NRG north edge | West University Place, Bellaire, Southside Place | 29.7079, -95.4010 | TMC district plus Super Neighborhood boundaries | Major medical/university/event destination. |
| `houston-uptown-galleria` | Uptown / Galleria | Uptown, Galleria, Tanglewood, Greenway west edge | Bellaire, West University Place | 29.7390, -95.4636 | Uptown management district plus adjacent Super Neighborhood boundaries | High-recognition shopping and employment district. |
| `houston-memorial` | Memorial | Memorial, Memorial Villages corridor, Bunker Hill area, Piney Point area | Jersey Village, Spring Branch | 29.7700, -95.5450 | Memorial-area polygons with enclave decisions documented | I-10/Memorial Drive west Houston awareness. |
| `houston-spring-branch` | Spring Branch | Spring Branch East/Central/North/West | Jersey Village, Aldine, North Houston | 29.8044, -95.5200 | Spring Branch Super Neighborhood group | Recognizable area between I-10, US 290, and Beltway 8. |
| `houston-energy-corridor` | Energy Corridor | Energy Corridor, west Memorial edge, Addicks frontage | Katy, Cypress | 29.7845, -95.6471 | Energy Corridor management district plus Houston-owned frontage | Major I-10 west employment corridor distinct from Katy. |
| `houston-westchase-west-houston` | Westchase / West Houston | Westchase, Briar Forest, north Alief, Westpark corridor | Katy, Bellaire, Jersey Village | 29.7280, -95.5560 | Westchase district and Super Neighborhood boundaries | West-side commute/activity area. |
| `houston-northwest` | Northwest Houston | Fairbanks, Inwood, Acres Homes west edge, US 290 inside Beltway | Cypress, Jersey Village, Aldine, North Houston | 29.8730, -95.5140 | Super Neighborhood groups clipped against separate communities | Broad northwest Houston without absorbing Cypress/Jersey Village. |
| `houston-north` | North Houston / Greenspoint | Greenspoint, Greater Greenspoint, Northline, Airline corridor | Aldine, North Houston, Spring, Humble | 29.9445, -95.4080 | Greater Greenspoint/Northside boundaries with separate-community precedence | Separates I-45/Greenspoint from inner and far-north areas. |
| `houston-northeast` | Northeast Houston | Kashmere Gardens, Trinity/Houston Gardens, Settegast, Northshore west edge | Humble, Atascocita, Kingwood, Sheldon, Channelview, Jacinto City, Galena Park | 29.8290, -95.2720 | Northeast Super Neighborhood groups with ship-channel exclusions | Prevents northeast Houston leakage into separately owned communities. |
| `houston-east-end` | East End | Second Ward, Eastwood, Magnolia Park, Lawndale/Wayside | Jacinto City, Galena Park, Pasadena, South Houston | 29.7355, -95.3120 | Greater East End district and Super Neighborhood boundaries | Recognizable inner-east Houston area. |
| `houston-southeast-hobby` | Southeast Houston / Hobby | Hobby Airport, Gulfgate, Park Place, Sunnyside east edge | Pasadena, South Houston, Deer Park, Webster, Clear Lake | 29.6454, -95.2789 | Hobby-area Super Neighborhood and airport context | Airport/Gulf Freeway region distinct from Pasadena and Clear Lake. |
| `houston-southwest` | Southwest Houston | Sharpstown, Meyerland, Gulfton, Fondren Southwest, Brays Oaks | Bellaire, West University Place, Stafford, Missouri City | 29.6760, -95.5170 | Southwest Super Neighborhood groups clipped to Harris/Houston ownership | Large recognized southwest Houston consumer area. |

## Separately owned Harris community decisions

Pasadena, Baytown, Humble, Katy, Cypress, Spring, Tomball, Channelview, Deer Park, La Porte, Crosby, Atascocita, Kingwood, Sheldon, Aldine, North Houston, Jersey Village, Bellaire, South Houston, Jacinto City, Galena Park, Webster, Seabrook, Clear Lake, and West University Place remain separately owned Harris awareness communities. Houston regions must not claim these labels as primary owners. Kingwood and Clear Lake remain separate entries rather than Houston region labels in LP035 to avoid ambiguous ownership.

## Selector UX recommendation

Use the smallest compatible follow-up interaction: keep `Harris County → Houston` in the existing selector and, only after Houston is selected, open/show a secondary Houston Region sheet with `Houston-wide` plus the 15 region choices. Do not flatten all regions into the Harris city list.

## Geographic boundary strategy

LP035.1 should add simplified, reviewed polygons derived from City of Houston Super Neighborhood boundaries and relevant management district boundaries, clipped against separately owned Harris communities. Coordinate-to-region assignment should occur once during normalization with deterministic priority and cached results.

## Backward compatibility strategy

Existing `Houston` preferences remain valid and resolve to Houston-wide parent mode. Current location may suggest a region, but must not silently rewrite a saved `Houston` preference. Historical reports labeled `Houston` remain visible through Houston-wide fallback. Supabase report records must not be rewritten.

## Community report ownership strategy

Future Houston-region reports should preserve `countyId`, `parentCommunity`, `awarenessRegionId`, `awarenessRegionLabel`, coordinate, canonical road context, and consumer location. Road/intersection context must outrank the broad region label in consumer copy.

## DriveTexas / official incident ownership strategy

Assign region ownership at normalization/awareness boundary using coordinate-in-polygon when coordinates exist. Provider city/district text remains evidence, not the only owner. One incident should resolve to one region using deterministic geometry priority when boundaries touch.

## Awareness and consumer filtering strategy

Required hierarchy: Harris County shows all Harris County conditions; Houston shows Houston-owned conditions; Houston Region shows only region-owned or spatially relevant Houston conditions. Separately owned communities must not leak into Houston regions just because they share Harris County.

## Performance considerations

Do not scan all polygons during render. Preload bounded geometry, cache coordinate assignment, normalize once per record/update, and preserve LP016, LP031, LP032, and LP034 protections.

## Exact architecture risks

1. Single community-string state cannot safely represent county, parent city, and region simultaneously.
2. Existing filtering functions do not carry `awarenessRegionId`.
3. Map centering has seeds but not region bounds.
4. DriveTexas filtering uses active awareness area radius/text fallback rather than region polygons.
5. Report presentation must avoid exposing internal IDs or letting region labels outrank road context.

## Implementation recommendation

LP035 should merge as investigation/model readiness plus a passive browser audit. LP035.1 should implement region state, selector sheet, polygon asset, normalized ownership metadata, and filtering tests.

## Exact recommended next milestone

**LP035.1 — Houston Region State, Geometry, and Filtering Activation**: add a third-level Houston region state; add reviewed polygon asset; implement cached coordinate ownership; update report/official/alert/crossing/awareness filters; add mobile Houston region sheet; certify browser behavior.

## Browser validation

Run `window.gridlyLp035HoustonRegionalizationAudit?.()` after app load. Expected LP035 status is `investigation_complete_lp035_1_required`, with Houston parent/fallback compatibility true and region filtering booleans false until LP035.1.
