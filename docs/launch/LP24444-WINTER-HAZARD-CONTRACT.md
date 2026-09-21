# LP244.44 — Complete winter minimum

Contract `LP24444.v1`; all eight concepts are MUST HAVE. This supersedes any LP244.43 proposal to launch only an ice correction and defer the other winter concepts. No categories, icons or code change in this planning commit. [Machine contract](../../reports/lp24444-launch-contracts.json) owns exact internal IDs; [normalization](LP24444-HAZARD-NORMALIZATION-CONTRACT.md) owns authority and impact.

## WIN-01 — One model, eight truthful concepts

| Required concept | Internal condition / subtype / observedPassability | Consumer/community label | Official form when source actually supports it | Marker family |
|---|---|---|---|---|
| ICE / ICY ROAD | ICE / GENERAL | Ice reported | Icy roadway — {roadway source} | Distinct ice crystal |
| BLACK ICE SUSPECTED | ICE / SUSPECTED_BLACK_ICE | Possible black ice reported | Possible black ice — {source}; keep suspected qualifier unless source verifies | Ice with uncertainty treatment |
| BRIDGE / OVERPASS ICING | ICE / BRIDGE_OVERPASS | Bridge/overpass icing reported | Bridge/overpass icing — {roadway source} | Ice with bridge subtype in detail |
| SNOW-COVERED ROAD | WINTER_ROAD_CONDITION / SNOW_COVER | Snow-covered road reported | Snow-covered roadway — {roadway source} | Winter road/snow |
| SLEET / FREEZING RAIN | WINTER_PRECIPITATION / SLEET_OR_FREEZING_RAIN | Sleet/freezing rain reported | Preserve official NWS event name and issuer | Winter precipitation |
| REDUCED VISIBILITY | REDUCED_VISIBILITY / WINTER | Reduced visibility reported | Reduced visibility — {source}; preserve official warning name | Visibility |
| WINTER ROAD HAZARD | WINTER_ROAD_CONDITION / UNSPECIFIED | Winter road hazard reported | Winter road condition — {roadway source} | Winter road |
| ROAD IMPASSABLE DUE TO WINTER CONDITIONS | WINTER_ROAD_CONDITION / UNSPECIFIED / IMPASSABLE | Road appears impassable; winter conditions reported | Impassable due to winter conditions — {authorized roadway source} | Cause marker + impact treatment |

For a known cause, impassability attaches to ICE or SNOW_COVER rather than creating a duplicate event/category. Official authorized IMPASSABLE/ROAD_CLOSED advisory is independent from community observedPassability. A winter weather warning becomes WEATHER_EVENT with original product name unless there is separate evidence of an actual road condition; it must not fabricate icy pavement. Severity is assigned from supported impact, not solely the selected winter concept.

KBYG shows condition, qualification (“reported”, “possible”), source/time, authorized advisory or observed impact and the active context. Every row above needs a readable label and accessible icon description in Home, Search, Around Me and Route Watch. No eight-item proliferation in the primary picker is required: a compact Winter/Ice entry and governed subtype follow-up may satisfy coverage, but LP244.46 must demonstrate creation, reading, old-client compatibility and accurate projection of every concept. Saved/pending legacy ice records must continue to work.

## WIN-02 — Marker/display correction

LP244.43 found `ice` maps to water in production marker handling (`js/app.js:12311`), primary picker omission (`10252`) and display omission (`106668`) despite `HAZARD_TYPES` ice (`10185`). LP244.46 must correct all surfaces together through the normalized adapter. Ice cannot retain a water droplet as its sole meaning. Use the existing vector/icon system: distinct ice marker plus winter-road, winter-precipitation and visibility family variants; no raster asset dependency or icon implementation now.

Severity uses consistent shape/border/text treatment in addition to color; high contrast and selected/clustered/map/list states must remain legible. Official/community distinction uses explicit source label/badge and accessible text; never use an official-looking badge for highly confirmed community reports. Bridge and suspected subtypes can live in detail/badges without eight separate silhouettes. At small map sizes preserve cause first, authority in accessible/detail projection. “Impasse”/closure styling cannot silently turn observational impassability into an authorized closure.

## WIN-03 — Source priority and delivery

Priority is domain-specific: NWS is authoritative for its weather alerts; official roadway feed for its roadway condition/closure; community for its attributed observations; organization/Dispatch information is private unless current capability expressly authorizes public projection. Do not globally overwrite a local road observation with a regional weather feed, or promote a report to official because the feed agrees. Keep distinct event/source identities; cross-source canonical merging requires proven linkage, not similar wording.

Each winter concept is eligible for in-app awareness when active, fresh, relevant and attributed. None automatically qualifies for HIGH_AWARENESS merely by name. Push requires the opted-in significant-hazard/severe-weather category plus HIGH/SEVERE supported impact or authorized qualifying advisory, source freshness, adequate confidence and relevant Home geometry or DIRECT_CORRIDOR. A lone suspected black-ice report remains qualified in-app/MEDIUM relevance; precipitation alone does not assert impassable road. Routine opted-in delivery may carry lower-impact qualified updates under batching/quiet-hours rules.

Road and crossing freshness limits and point/line/polygon/road linkage come from [route relevance](LP24444-ROUTE-WATCH-RELEVANCE-CONTRACT.md). For a precise bridge icing report, verify the bridge segment on the route; proximity to a different overpass cannot imply on-route impact. Background text says “Ice reported along your trip corridor” only if directly relevant; near-only says “Reported near your trip corridor”. No frozen-lake/off-road regional point becomes a road alert through radius alone. Numeric ahead requires the separate foreground progress gates.

## WIN-04 — Acceptance

Create one fixture per row with legacy/raw input, normalized output, marker family, KBYG copy, source badge, authority, relevance and expected send/suppress result. Add unknown severity, obsolete report, unsupported official closure claim, duplicate cause/impassability, bridge vs parallel road, NWS polygon hole and stale source cases. Run all eight through portrait Android and iPhone on the final candidates, including a real native winter notification and tap to fresh/expired detail. Emulator images or a JSON fixture alone cannot certify consumer presentation or delivery. No winter tests have been executed by this documentation phase.
