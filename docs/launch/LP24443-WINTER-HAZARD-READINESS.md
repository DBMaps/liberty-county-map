# LP244.43 — Winter hazard readiness

Baseline `647c85a30d042a90276c3915ba92538df78ddf1c`; audit/design only. Covers parts 24–28 and winter launch gates. Winter is a **PARTIAL FOUNDATION**, not an absent source or a completed consumer feature.

## Current facts

1. `js/app.js:10185` defines ice with high severity and “icy roadway conditions” detail. Shared retrieval/cleanup includes ice (`GRIDLY_CORE_ROAD_HAZARD_CLEANUP_TYPES`, 58531). It can survive backend retrieval; this is not merely a proposed category.
2. `ROAD_HAZARD_TYPE_OPTIONS` (10251) omits ice. `gridlyConditionDisplayLabel.js:12` community label registry also omits ice. `GRIDLY_PRODUCTION_MARKER_CATEGORY_ASSETS` (12310) aliases ice to water-over-road.png. The metadata ice-cube glyph is not proof of the production PNG icon.
3. `buildRouteHazardAssessment` (62124) has explicit weights for crash/flooding/closure/etc. but no explicit ice weight in its local map. Generic fallback is not winter impact certification. Display set `ROAD_HAZARD_DISPLAY_CATEGORIES` (106668) omits ice; audit every filter surface before adding a picker option.
4. `js/gridlyWeatherProvider.js:54` maps winter/ice storm/snow/sleet/freeze/blizzard to broad “Winter Weather”; raw event is retained (216) and preferred by `gridlyConditionDisplayLabel`. Freezing rain alone is not explicitly in that regex. Retaining source event means some winter warnings can still display correctly without dedicated road condition normalization.
5. DriveTexas categories (`gridlyDriveTexasProvider.js:9`) do not contain dedicated ice/snow classes. Source description may contain winter terms, but generic category pattern matches do not guarantee distinction between icing, bridge restriction and closure. Existing connector/readiness docs about supported winter events are not source-coverage or live-road-truth certification.
6. Full NWS polygons are not preserved in the normalized weather object (only geometry type and affectedZones); current NWS selected-point fetch cannot discover every hazard along an entire route. No standalone winter-specific test suite or expanded winter enum was identified in the recorded tracked-file search. Matches in historic audits/fixtures are not runtime capabilities.

## Candidate launch set

Use compact base conditions and subtypes; avoid eight independent overlapping categories. Preserve official weather event names in their own source family.

| Requested concept | Proposed representation | Community text | Qualification / relevance |
|---|---|---|---|
| Ice / icy road | ICE, subtype general | “Ice reported” | Point observation; expiry and impact confidence |
| Black ice suspected | ICE, subtype suspected_black_ice, uncertainty suspected | “Possible black ice reported” | Cannot label invisible ice confirmed merely from temperature |
| Bridge / overpass icing | ICE, subtype bridge_overpass | “Bridge/overpass icing reported” | Structure/road evidence required; no all-bridge claim |
| Snow-covered road | WINTER_ROAD_CONDITION, subtype snow_cover | “Snow-covered road reported” | Observed roadway, not inferred from regional snow warning |
| Sleet / freezing rain | WINTER_PRECIPITATION, subtype sleet/freezing_rain | “Sleet/freezing rain reported” | Official event remains distinct; precipitation ≠ impassability |
| Reduced visibility | REDUCED_VISIBILITY, cause winter/fog/dust/smoke/unknown | “Reduced visibility reported” | Reuse across seasons, no duplicate winter-only visibility condition |
| Winter road hazard | WINTER_ROAD_CONDITION, subtype unspecified | “Winter road condition reported” | Escape hatch, avoid duplicating known ICE |
| Road impassable due to winter | ICE or WINTER_ROAD_CONDITION + impact/advisory | “Road appears impassable; winter conditions reported” | Official IMPASSABLE/ROAD_CLOSED only with authorized source |

Product decision: launch with ICE plus bridge/possible-black-ice qualifiers and generic winter-road observation, or include snow/precipitation/visibility in the initial validated registry. Do not expose multiple overlapping reports for the same source event. Cold/freeze warning may indicate risk without observed roadway ice; never generate a road closure or black-ice condition from a weather forecast alone.

## Authority and projection policy

Community observation, official weather warning, official roadway condition and Dispatch operational condition are four different provenance classes. Examples: “Ice reported” versus “NWS Ice Storm Warning” versus “[Road authority] reports roadway icing” versus an authorized published closure. An official weather alert is not a road authority instruction. Private Dispatch passability/response notes require explicit public projection and expiration before consumer output. No Dispatch source was connected or changed by this audit.

Carry condition, subtype, severity, advisory, source/issuer, confidence/uncertainty, event ID, observation/expiry, geometry kind and resolution. Legacy ice maps to ICE/general without inventing advisory; legacy road_closed has no reliable winter cause unless source metadata supports it. Do not backfill winter cause using season or county.

## Weather/road/crossing targeting

For an official alert polygon, intersect the **remaining real road corridor**, including polygon holes and MultiPolygon pieces. Use official zone polygon only when direct geometry is absent and identify zone-level uncertainty. County-only information can support a named-area notice, not “black ice 6.2 miles ahead.” Current point-based NWS query can support its selected point only. Route discovery needs a server-side official alert catalog or bounded equivalent acquisition before push.

DriveTexas line geometries should use full overlap/intersection; representative midpoint is marker compatibility. Road points require conservative lateral matching and travel-connected road evidence. A crossing located on the route is infrastructure; notify only on timely reported crossing condition, not train presence or every winter advisory in its county.

## Launch gate and required future tests

Before winter claims: expose a truth-safe observation path, align shared retrieval/clear behavior and filters, supply a distinct ice marker, normalize winter cause independently of closure, preserve provider event text, validate expiry and authority, and certify portrait reporting/readability on Android and iPhone.

Test legacy ice fetch → map → KBYG → clear → reload; all aliases; ambiguous source text “bridge closed due to ice”; “freezing rain” without word winter; official Winter Storm Watch vs Warning; weather polygon hole/route intersection; parallel roads; coarse or stale GPS; unconfirmed black ice; no authority promotion; event dedupe Home+Route; expiry/offline suppression; source withdrawal. Static fixture success is not proof of live source winter coverage. Stage controlled fixtures in nonproduction; no winter event fabricated into production.

Winter readiness remains launch-important given the owner's requirement. The minimum ICE/authority/expiry path should be certified before shipping winter-aware claims, and broader subtypes can follow only if that leaves a truthful generic observation path and owner-approved scope. No implicit downgrade to post-launch.
