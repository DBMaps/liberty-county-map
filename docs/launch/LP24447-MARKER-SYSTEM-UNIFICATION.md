# LP244.47 — Complete marker system unification

Status: **READY FOR OWNER VISUAL REVIEW** after technical checks. This is not owner visual approval and does not authorize publication or merge.

Starting branch: `LP244.46-hazard-advisory-winter-normalization` at `9c9e082d9c2a8af955a666ef1a2207aa4903867d`. Worktree was clean. Working branch: `LP244.47-marker-system-unification`.

## Repository inventory before artwork changes

`reports/lp24447-marker-inventory.json` was captured before artwork/mapping changes. It contains every baseline runtime asset assignment, normalized condition, consumer label, source, aliases, color, symbol, box/scale, authority handling, asset disposition and marker-construction reference. The table below expands that captured inventory.

The baseline has 14 active PNGs and seven active winter SVGs. Twelve older standalone SVG markers and one system sheet are unwired reference assets. All 34 historical files remain intact. No active mapping or legacy alias was removed.

The shared fallback previously represented blocked, impassable and rail-issue conditions. Fallen trees shared debris; utility work shared downed-wire artwork. Raster padding varied drastically: legacy CSS compensated with 1.26–1.9× enlargement. That compensation existed in both the stylesheet and injected runtime CSS. Crossing inventory used 72–80 px to compensate for its raster artwork. The final vectors need no compensation and use 64 px, including crossing locations.

All point constructors are in `js/app.js`: unified incidents, official roadways, crossings, user location, destination, route endpoints, placement preview and the suppressed awareness label. Other JavaScript files have no independent point-marker asset factory. Non-hazard user-location (30 px), destination (32 px), route endpoints (12/18 px), and placement circle (radius 4) retain their existing appearance and dimensions. The awareness map label remains suppressed because the awareness panel owns that identity. POI/search selection uses the existing destination marker, not another hazard family.

## Visual grammar

`js/gridlyMarkerRegistry.js` is the authoritative condition/alias → file → family → size lookup. Its 31 distinct static assets live in `assets/markers/unified/`. The app's old constant names are compatibility projections of this registry. No SVG is generated at runtime.

Hazard vectors share a 256-unit viewbox, 64 px box, white 8-unit exterior border, dark interior, 8-unit rounded symbol strokes, common padding and a tip at 244/256. Popup anchors follow that tip. The common shadow is 0 2px 3px, black at .32 opacity. Selection uses 1.1× enlargement around the tip and keeps the existing selection z-index. Per-condition enlargement and condition-specific image glow are removed. Existing freshness/count/source metadata remain separate.

Crossing infrastructure uses a related circular location medallion with a small locator tip, not a hazard teardrop. A location is not evidence of a train. Reported delay uses a crossbuck/clock; reported crossing condition uses a crossbuck/caution cue. Roadway issues near crossings retain their road-condition symbols.

| Family | Exterior color | Meaning |
| --- | --- | --- |
| Winter | `#17445f` | Cold-weather roadway condition |
| Water | `#12616b` | Water affecting a road |
| Work | `#8e480f` | Construction / planned / utility work |
| Caution | `#745516` | Obstruction or general road hazard |
| Restriction | `#a3313e` | Official closure / bridge restriction |
| Vehicle | `#604674` | Vehicle incident or delay |
| Response | `#70405b` | Response activity |
| Rail | `#345b60` | Reported crossing condition |
| Infrastructure | `#465661` | Crossing location |
| Information | `#435b72` | Unspecified official travel advisory |

Symbol, not color, carries the primary distinction. No verification/severity badge was invented. Official TX attribution comes from the existing official icon builder.

## Condition distinctions and compatibility

The seven winters remain distinct: crystal; slick road/glint with small uncertainty mark; bridge/crystal; road with conspicuous accumulated snow; mixed frozen precipitation; eye/fog; winter caution. Flooding retains a road entering water and a separate teal family.

Crash has vehicle impact imagery; disabled vehicle has a raised hood; congestion has a vehicle queue. Debris uses scattered angular material, fallen tree a branching trunk. Blocked uses an obstacle across a road; impassable uses a disrupted road and gap; official closure uses no-entry. Construction has a cone, planned work a calendar/cone, utility work a pole/wrench, and downed wire a broken wire/electrical cue. Other subtypes have livestock, interrupted signal and response-beacon symbols. Only genuinely unspecified hazards use generic caution.

Flooding, high water and standing water intentionally share one physical roadway-water illustration while preserving their existing labels. Alias sharing is explicit in `reports/lp24447-marker-mapping.json`. Community `road_closed`, `road_closure` and `closure` are resolved to an observational blocked marker before asset lookup. Official closure remains an authorized status, not a community observation.

Legacy report normalization retains `legacyReportType`; the visual resolver now reads it before broad normalized categories. This preserves such distinctions as fallen tree without rewriting reports or changing the LP244.46 taxonomy. Seven winter aliases and all primary/Other Hazard picker options have explicit coverage.

DriveTexas point presentation keeps closure, work, flood, crash, disabled vehicle, delay, damage, bridge restriction, incident, hazard and unspecified advisory distinctions. Ingestion, provider classification, source authority, eligibility and geometry remain with their existing owners. The official point builder retains its TX badge. Shared physical conditions use shared artwork regardless of source.

## Geometry, cards and behavior boundaries

NWS alert polygons remain polygons. Official line/polygon/road-segment geometry is not converted into point claims. POINT, LINE, POLYGON, ROAD_SEGMENT, PLACE_ONLY, COUNTY_ONLY and UNKNOWN normalization is unchanged.

No changes were made to severity, confidence, authority normalization, lifecycle, Nearby/Area/County/Delays/All eligibility, popup condition labels, KBYG wording, Active Issues lifecycle or awareness context. An existing broader label such as “Debris in Road” still truthfully covers its fallen-tree legacy subtype. The map can now show the more specific retained visual detail. Official generic travel-advisory wording likewise remains governed by its existing card owner.

The synthetic harness uses the real `normalizeReports`, `renderUnifiedIncidents` and official icon builder. The existing renderer can create grouped and raw fallback layers at identical coordinates for these injected fixtures; deduplication is deliberately unchanged. Fixture layer counts are not claimed as production ingestion counts.

## Verification and previews

See `reports/lp24447-marker-test-evidence.json` for final machine-readable results and screenshot hashes. Focused tests cover every registered condition/alias, picker mapping, source-safe closures, unique assets, vector constraints and protected-source equality. LP244.45 context tests include Cleveland → Crosby → Return Home Cleveland → Dayton. LP244.46 normalization and related weather/KBYG/popup/official geometry checks pass.

Browser checks cover all 31 assets in batches at 320/360/390/440 px viewport widths, actual 64 px image bounds and 70.4 px selected bounds. Real Dayton-area urban, rural and Trinity River/water-heavy basemaps show nine simultaneous representative hazards. Light and navy boards and the actual official TX badge are included. All primary and Other Hazard subtype picker choices are exercised without submission.

Two historical source-string tests remain failures at both starting and final source: LP045.1 line 8 (old marker-identity expression), LP045.2 line 23 (old alert-focus expression). The LP045.2 PNG assertion was updated to the registry's construction SVG. These failures are separate from LP244.47 technical checks; neither source-owner behavior was changed to satisfy old strings.

Required output directory: `.artifacts/lp24447-marker-system-review/`:

- `complete-marker-library.png`
- `complete-marker-library-mobile.png`
- `complete-marker-map-density.png`
- `marker-before-after.png`
- `community-vs-official-road-state.png`
- `winter-marker-final.png`

Additional artifacts include navy, urban, rural, water-heavy and 16 mobile map screenshots, plus browser evidence. Artwork is shown at actual 64 px scale; the before/after board keeps old/new boxes at 64 px to reveal original raster-padding differences. Screenshots are ignored local artifacts; tracked tooling reproduces them with `node tools/lp24447/preview.mjs`.

## Performance and noninterference

Registry lookups use frozen object dictionaries and a bounded token normalization. Static SVGs are small and browser-cacheable. Existing render-signature/layer reconciliation and icon ownership remain in place; no frame callback, runtime SVG generator or additional icon rebuild loop was introduced. The vector authoring script runs offline only.

The browser uses disposable local storage, blocked service workers, synthetic fixtures, locally fulfilled dependencies/weather responses, and an allowlist for read-only public map tiles. Reporting is never activated or submitted. No Supabase/backend/schema/moderation/retention/notification/native/Route Watch/Around Me/public-site/Dispatch or deployed production state changes occurred. No push, merge or deploy is authorized here.

Remaining gate: owner reviews the complete visual library before any branch publication or merge.

## Captured baseline mapping table

| Canonical / category | Consumer label | Sources | Asset | Aliases | Color / symbol | Size | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CONSTRUCTION / construction | Construction | community, official when supported | assets/markers/png/construction-zone.png | construction, road_work | black with amber ring; construction zone | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| CRASH_SCENE / crash | Crash / Wreck | community, official when supported | assets/markers/png/crash-on-road.png | crash, wreck, crash_scene, crash_incident | black with red ring; crash on road | 64px box; artwork scale 1.52 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| DEBRIS / debris | Debris In Road | community, official when supported | assets/markers/png/debris-in-road.png | debris, fallen_tree, debris_in_road | black with amber ring; debris in road | 64px box; artwork scale 1.73 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| DISABLED_VEHICLE / disabled_vehicle | Disabled Vehicle | community, official when supported | assets/markers/png/disabled-vehicle.png | disabled_vehicle | black with amber ring; disabled vehicle | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| DOWNED_POWER_LINE / downed_power_line | Downed Power Line | community, official when supported | assets/markers/png/downed-power-line.png |  | black with amber ring; downed power line | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| EMERGENCY_RESPONSE_ACTIVITY / emergency_response_activity | Emergency Response Activity | community, official when supported | assets/markers/png/emergency-response.png |  | black with red ring; emergency response | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| EMERGENCY_RESPONSE_IMPACT / emergency_response_impact | emergency response impact | community, official when supported | assets/markers/png/emergency-response.png |  | black with red ring; emergency response | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| DEBRIS / fallen_tree | fallen tree | community, official when supported | assets/markers/png/debris-in-road.png | debris, fallen_tree, debris_in_road | black with amber ring; debris in road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| FLOODING / flooding | Flooding | community, official when supported | assets/markers/png/water-over-road.png | flooding, flood | black/navy with blue ring; water over road | 64px box; artwork scale 1.4 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| ICE / ice | Ice | community, official when supported | assets/markers/png/icy-road.svg | ice, icy, icy_road, icy_roads | navy #17445f / pale blue; icy road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| BLACK_ICE_SUSPECTED / black_ice_suspected | Possible black ice | community, official when supported | assets/markers/png/black-ice-suspected.svg | black_ice_suspected, black_ice, possible_black_ice | navy #17445f / pale blue; black ice suspected | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| BRIDGE_OVERPASS_ICING / bridge_overpass_icing | Bridge / overpass icing | community, official when supported | assets/markers/png/bridge-overpass-icing.svg | bridge_overpass_icing, bridge_icing, overpass_icing | navy #17445f / pale blue; bridge overpass icing | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| SNOW_COVERED_ROAD / snow_covered_road | Snow-covered road | community, official when supported | assets/markers/png/snow-covered-road.svg | snow_covered_road, snow_on_road | navy #17445f / pale blue; snow covered road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| SLEET_FREEZING_RAIN / sleet_freezing_rain | Sleet / freezing rain | community, official when supported | assets/markers/png/sleet-freezing-rain.svg | sleet_freezing_rain, sleet, freezing_rain | navy #17445f / pale blue; sleet freezing rain | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| REDUCED_VISIBILITY / reduced_visibility | Reduced visibility | community, official when supported | assets/markers/png/reduced-visibility.svg | reduced_visibility, low_visibility | navy #17445f / pale blue; reduced visibility | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| WINTER_ROAD_HAZARD / winter_road_hazard | Other winter road hazard | community, official when supported | assets/markers/png/winter-road.svg | winter_road_hazard, winter_hazard | navy #17445f / pale blue; winter road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| ROAD_BLOCKED / road_blocked | Road appears blocked | community, official when supported | assets/markers/png/other-hazard.png | road_blocked, road_closed, road_closure, blocked_road, blocked_roadway | black with amber ring; other hazard | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| ROAD_IMPASSABLE / road_impassable | Road appears impassable | community, official when supported | assets/markers/png/other-hazard.png | road_impassable, impassable, winter_impassable | black with amber ring; other hazard | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| HIGH_WATER / high_water | High water reported | community, official when supported | assets/markers/png/water-over-road.png | high_water, standing_water, water_over_road | black/navy with blue ring; water over road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| LIVESTOCK_ON_ROAD / livestock_on_road | Livestock on Road | community, official when supported | assets/markers/png/livestock-on-road.png |  | black with amber ring; livestock on road | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| OTHER_ROAD_HAZARD / other_hazard | Other Hazard | community, official when supported | assets/markers/png/other-hazard.png | road_hazard, other, other_hazard, hazard_cleared | black with amber ring; other hazard | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| OTHER_ROAD_HAZARD / other | Other | community, official when supported | assets/markers/png/other-hazard.png | other_hazard, road_hazard, other | black with amber ring; other hazard | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| CROSSING_INFRASTRUCTURE / crossing_infrastructure | crossing infrastructure | crossing inventory | assets/markers/png/rail-crossing.png |  | gray/white; rail crossing | 72/78 desktop;76/80 portrait | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| RAIL / rail | rail | crossing inventory | assets/markers/png/rail-crossing.png |  | gray/white; rail crossing | 72/78 desktop;76/80 portrait | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| RAIL_CROSSING_CONDITION / rail_blockage_delay | Train Blocking Crossing | community, official when supported | assets/markers/png/train-front.png | blocked, heavy, delayed, delay, blocked_crossing, crossing_blocked, train_blocking_crossing, rail_blockage_delay, rail_blockage, rail_blocked, rail_delay, rail_issue | black with amber ring; train front | 64px box; artwork scale 1.26 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| RAIL_CROSSING_INFRASTRUCTURE / rail_crossing_infrastructure | rail crossing infrastructure | crossing inventory | assets/markers/png/rail-crossing.png |  | gray/white; rail crossing | 72/78 desktop;76/80 portrait | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| RAIL_CROSSING_CONDITION / rail_issue | Rail Issue | community, official when supported | assets/markers/png/other-hazard.png | rail_issue, blocked, heavy, delayed, delay, blocked_crossing, crossing_blocked, train_blocking_crossing, rail_blockage_delay, rail_blockage, rail_blocked, rail_delay | black with amber ring; other hazard | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| ROAD_BLOCKED / road_closed | Road appears blocked | community, official when supported | assets/markers/png/road-closed.png | road_closed, road_blocked, road_closure, blocked_road, blocked_roadway | black with red ring; road closed | 64px box; artwork scale 1.48 | Community normalized ROAD_BLOCKED overrides closure art; official closure separate | active mapping; aliases retained |
| SIGNAL_OUTAGE / signal_outage | signal outage | community, official when supported | assets/markers/png/traffic-signal-issue.png |  | black with amber ring; traffic signal issue | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| HIGH_WATER / standing_water | standing water | community, official when supported | assets/markers/png/water-over-road.png | high_water, standing_water, water_over_road | black/navy with blue ring; water over road | 64px box; artwork scale 1.4 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| TRAFFIC_BACKUP / traffic_backup | Traffic Backup / Heavy Delay | community, official when supported | assets/markers/png/traffic-backup-heavy-delay.png | traffic_backup, heavy_traffic, traffic_delay | black with amber ring; traffic backup heavy delay | 64px box; artwork scale 1.9 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| TRAFFIC_SIGNAL_ISSUE / traffic_signal_issue | Traffic Signal Issue | community, official when supported | assets/markers/png/traffic-signal-issue.png |  | black with amber ring; traffic signal issue | 64px box; artwork scale 1.83 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |
| TXDOT_CLOSURE / txdot_closure | txdot closure | DriveTexas | assets/markers/png/road-closed.png |  | black with red ring; road closed | 64px box; artwork scale 1 | official source badge and attributed popup | active mapping; aliases retained |
| TXDOT_CONSTRUCTION / txdot_construction | txdot construction | DriveTexas | assets/markers/png/construction-zone.png |  | black with amber ring; construction zone | 64px box; artwork scale 1 | official source badge and attributed popup | active mapping; aliases retained |
| TXDOT_DAMAGE / txdot_damage | txdot damage | DriveTexas | assets/markers/png/debris-in-road.png |  | black with amber ring; debris in road | 64px box; artwork scale 1 | official source badge and attributed popup | active mapping; aliases retained |
| TXDOT_FLOODING / txdot_flooding | txdot flooding | DriveTexas | assets/markers/png/water-over-road.png |  | black/navy with blue ring; water over road | 64px box; artwork scale 1 | official source badge and attributed popup | active mapping; aliases retained |
| TXDOT_OTHER / txdot_other | txdot other | DriveTexas | assets/markers/png/other-hazard.png |  | black with amber ring; other hazard | 64px box; artwork scale 1 | official source badge and attributed popup | active mapping; aliases retained |
| UTILITY_WORK / utility_work | utility work | community, official when supported | assets/markers/png/downed-power-line.png |  | black with amber ring; downed power line | 64px box; artwork scale 1 | Source and lifecycle handled separately from artwork | active mapping; aliases retained |

## Final mapping table

| Condition / internal ID | Label | Asset | Family | Symbol |
| --- | --- | --- | --- | --- |
| ice | Ice / Icy Road | icy-road.svg | winter | crystal |
| black_ice_suspected | Possible Black Ice | black-ice-suspected.svg | winter | slick road, glint and small uncertainty cue |
| bridge_overpass_icing | Bridge / Overpass Icing | bridge-overpass-icing.svg | winter | bridge and crystal |
| snow_covered_road | Snow-Covered Road | snow-covered-road.svg | winter | road with accumulated snowbanks |
| sleet_freezing_rain | Sleet / Freezing Rain | sleet-freezing-rain.svg | winter | cloud, rain and ice pellets |
| reduced_visibility | Reduced Visibility | reduced-visibility.svg | winter | eye and fog |
| winter_road_hazard | Other Winter Road Hazard | winter-road-hazard.svg | winter | caution triangle and crystal |
| flooding | Flooding / High Water | flooding-high-water.svg | water | road entering water |
| crash | Crash / Wreck | crash-wreck.svg | vehicle | two vehicles and impact burst |
| disabled_vehicle | Disabled Vehicle | disabled-vehicle.svg | vehicle | vehicle with raised hood |
| debris | Debris in Road | debris-road.svg | caution | scattered angular debris on road |
| fallen_tree | Fallen Tree | fallen-tree.svg | caution | fallen branching trunk |
| road_blocked | Road appears blocked | road-blocked.svg | caution | obstacle across road |
| road_impassable | Road appears impassable | road-impassable.svg | caution | broken roadway and gap |
| construction | Construction | construction.svg | work | work cone |
| planned_work | Planned Work | planned-work.svg | work | calendar and work cone |
| traffic_backup | Traffic Backup / Heavy Delay | traffic-delay.svg | vehicle | queue of vehicles |
| other_hazard | Other Hazard | other-road-hazard.svg | caution | general caution triangle |
| road_closed | Official Road Closed | road-closed-official.svg | restriction | no entry across road |
| downed_power_line | Downed Power Line | downed-power-line.svg | caution | broken wire and lightning |
| utility_work | Utility Work | utility-work.svg | work | utility pole and wrench |
| emergency_response_activity | Emergency Response Activity | emergency-response.svg | response | response beacon |
| livestock_on_road | Livestock on Road | livestock-road.svg | caution | livestock silhouette |
| traffic_signal_issue | Traffic Signal Issue | traffic-signal-issue.svg | caution | signal with interruption slash |
| rail_blockage_delay | Reported Crossing Delay | crossing-delay.svg | rail | crossbuck and delay clock |
| rail_issue | Reported Crossing Condition | crossing-condition.svg | rail | crossbuck and caution cue |
| crossing_infrastructure | Crossing Location | crossing-location.svg | infrastructure | crossbuck location medallion |
| txdot_damage | Road Damage | road-damage.svg | caution | road surface crack |
| txdot_bridge_restriction | Bridge Restriction | bridge-restriction.svg | restriction | bridge and restricted opening |
| txdot_incident | Roadway Incident | roadway-incident.svg | vehicle | road and incident burst |
| txdot_other | Travel Advisory | travel-advisory.svg | information | information symbol |
