# V327 — DriveTexas Vocabulary Fixture Review

## Executive Summary

V327 validates the V326 DriveTexas shadow normalizer against representative DriveTexas-style roadway event vocabulary using fixture records only. No DriveTexas API calls, live ingestion, alerts, markers, routing, map changes, UI changes, production behavior, external dependencies, or Travel Confidence implementation were added.

The V326 canonical taxonomy is sufficient for the reviewed fixture vocabulary. Fifteen of sixteen representative phrases classify into an existing canonical type. One phrase, `Roadway Obstruction`, intentionally falls back to `other_official` because V326 does not yet include a dedicated obstruction/debris canonical type.

Primary outcome: the taxonomy can proceed to the next shadow milestone if precedence rules are made explicit before live integration.

## Fixture Inventory

The fixture set is intentionally text-only and representative of DriveTexas-style public roadway condition language:

| # | Fixture raw source text | Review purpose |
|---:|---|---|
| 1 | Road Closed | Generic full closure baseline. |
| 2 | Road Closed Due To Flooding | Combined closure and flood cause. |
| 3 | High Water Reported | Water-related caution without explicit closure. |
| 4 | Flooded Roadway | Direct roadway flooding phrase. |
| 5 | Flooding On Roadway | Alternate flood wording. |
| 6 | Travel Advisory | Advisory baseline. |
| 7 | Use Alternate Route | Detour-adjacent advisory/action phrase. |
| 8 | Lane Closure | Partial restriction baseline. |
| 9 | Right Lane Closed | Directional lane restriction. |
| 10 | Left Lane Closed | Directional lane restriction. |
| 11 | Construction Closure | Work-zone closure ambiguity. |
| 12 | Crash Blocking Lanes | Crash with lane impact. |
| 13 | Disabled Vehicle | Short-lived incident baseline. |
| 14 | Bridge Closure | Structure-specific closure. |
| 15 | Detour In Effect | Explicit detour phrase. |
| 16 | Roadway Obstruction | Potential hazard vocabulary gap. |

## Classification Results

| Raw source text | Normalized Gridly type | Confidence | Flood related | Trust label | Lifecycle class | Travel Confidence impact | Reason |
|---|---|---|---:|---|---|---|---|
| Road Closed | `road_closed` | High | false | Official Source | closure | Severe | Generic road-closed language is a strong official passability signal. |
| Road Closed Due To Flooding | `road_closed` | High | true | Official Source | flood_closure | Severe | Closure and flooding both appear; preserve full-closure semantics while retaining flood relationship. |
| High Water Reported | `high_water` | High | true | Official Source | flood | High | High-water wording is a flood-related fast-changing roadway condition. |
| Flooded Roadway | `flooded_roadway` | High | true | Official Source | flood | High | Direct flooded-roadway language maps cleanly to flood awareness. |
| Flooding On Roadway | `flooded_roadway` | High | true | Official Source | flood | High | Alternate flooding-on-roadway wording still describes water affecting the roadway. |
| Travel Advisory | `travel_advisory` | Medium | false | Official Source | advisory | Moderate | Advisory wording provides official caution context but does not prove closure. |
| Use Alternate Route | `detour` | Medium | false | Official Source | detour | Moderate | Alternate-route wording should be treated as detour context, not Gridly route guidance. |
| Lane Closure | `lane_closure` | High | false | Official Source | lane_restriction | Moderate | Lane closure reduces capacity without implying full roadway closure. |
| Right Lane Closed | `lane_closure` | High | false | Official Source | lane_restriction | Moderate | A named lane is closed, so the partial restriction outranks generic closure semantics. |
| Left Lane Closed | `lane_closure` | High | false | Official Source | lane_restriction | Moderate | A named lane is closed, so the partial restriction outranks generic closure semantics. |
| Construction Closure | `construction` | Medium | false | Official Source | planned_work | Moderate | Work-zone language should remain planned work unless source fields prove full road closure. |
| Crash Blocking Lanes | `crash` | High | false | Official Source | short_lived | Moderate | Crash is the primary event; lane blocking is impact context. |
| Disabled Vehicle | `disabled_vehicle` | High | false | Official Source | short_lived | Low | Disabled vehicles are localized and usually short-lived. |
| Bridge Closure | `bridge_closure` | High | false | Official Source | closure | Severe | Bridge-specific closure is network-critical and should outrank generic road closure. |
| Detour In Effect | `detour` | Medium | false | Official Source | detour | Moderate | Explicit detour language is context and must not become turn-by-turn routing. |
| Roadway Obstruction | `other_official` | Low | false | Official Source | review_required | None | V326 has no obstruction/debris type; preserve as official evidence for taxonomy review. |

## Ambiguous Cases

| Fixture | Ambiguity | Recommended handling |
|---|---|---|
| Construction Closure | Could mean a construction event, a full closure caused by construction, or a work-zone restriction. | Keep `construction` in fixture mode. Promote to `road_closed` only if future source fields explicitly indicate full road closure. |
| Use Alternate Route | Could be an advisory phrase or detour phrase. | Map to `detour` as official context. Do not produce routing instructions. |
| Travel Advisory | May be generic caution or may include hazard-specific details in description. | Keep `travel_advisory` unless flood, closure, crash, lane, or detour terms are present with stronger precedence. |
| Crash Blocking Lanes | Contains both crash and lane-impact language. | Map primary type to `crash`; preserve lane impact as future context if source fields support it. |
| Right/Left Lane Closed | Contains the word `closed` but not a full roadway closure. | Map to `lane_closure`; lane-specific language outranks generic closure. |
| Roadway Obstruction | Could mean debris, stalled object, damage, or another official hazard. | Keep `other_official` until observed source vocabulary justifies `road_obstruction` or `road_hazard`. |

## Conflict Resolution Recommendations

### Road Closed vs Road Closed Due To Flooding

`Road Closed Due To Flooding` should normalize to `road_closed` with `floodRelated: true`, lifecycle `flood_closure`, and Severe Travel Confidence impact. Full closure semantics are the user-critical state; flood context explains cause and lifecycle sensitivity.

### High Water vs Flooded Roadway

`High Water` should remain distinct from `Flooded Roadway`. High water is often cautionary or near-roadway water evidence, while flooded roadway implies water affecting the road surface. Both remain flood-related and High impact, but `flooded_roadway` should outrank `high_water` if both appear.

### Travel Advisory vs Detour

`Detour` and `Use Alternate Route` should outrank generic `travel_advisory` when alternate-route language is explicit. The output must remain context-only and must not become routing behavior.

### Construction Closure vs Road Closed

Fixture wording alone is insufficient to decide whether `Construction Closure` means full road closure. In V327 fixture mode, classify as `construction`. In future source-field integration, full-closure status fields should promote it to `road_closed` with construction context.

### Lane Closed vs Road Closed

Named lane closure phrases should map to `lane_closure`, not `road_closed`. Lane-specific closure means reduced capacity unless the source also says all lanes or the road is closed.

## Precedence Recommendations

Recommended matching precedence before live integration:

1. **Flood closure combination** — if closure language and flood/high-water/water-over-road language both appear, output `road_closed`, set `floodRelated: true`, use lifecycle `flood_closure`, and assign Severe impact.
2. **Bridge closure** — bridge-specific closure outranks generic road closure because structure closures are network-critical.
3. **Lane closure** — lane-specific closure outranks generic closure when the source names lanes rather than the entire roadway.
4. **Flooded roadway** — flooded-roadway/water-over-road/flooding-on-roadway outranks generic high-water wording.
5. **High water** — map high-water-only phrases to `high_water`.
6. **Crash** — crash terms should define the primary type; lane-blocking details become impact context.
7. **Disabled vehicle** — disabled/stalled vehicle terms remain localized short-lived incidents.
8. **Detour / alternate route** — detour and alternate-route wording maps to `detour` as context only.
9. **Construction / maintenance / work zone** — planned-work language maps to `construction` unless explicit source fields prove full closure.
10. **Travel advisory** — generic advisory is lower precedence than specific hazards.
11. **Other official** — unmapped official vocabulary is preserved for review.

## Taxonomy Review

The current V326 canonical taxonomy under review is sufficient for the fixture set:

- `road_closed`
- `flooded_roadway`
- `high_water`
- `travel_advisory`
- `construction`
- `crash`
- `disabled_vehicle`
- `lane_closure`
- `detour`
- `bridge_closure`
- `other_official`

No required taxonomy addition is needed before the next shadow milestone. The only gap is `Roadway Obstruction`, which safely maps to `other_official` during fixture review.

## Recommended Refinements

1. Add explicit fixture-review output to `window.gridlyDriveTexasShadowNormalizerAudit?.()` with counts for fixture count, successful mappings, ambiguous mappings, conflicting mappings, recommended taxonomy changes, and recommended precedence rules.
2. Keep `road_closed` as the normalized type for flood closures, but require `floodRelated: true` and `lifecycleClass: flood_closure`.
3. Treat `Bridge Closure` as `bridge_closure`, including the noun form `closure`, not only `closed`.
4. Treat `Use Alternate Route` as `detour` context, never as routing.
5. Keep obstruction vocabulary in `other_official` until live or sanctioned sample data shows stable recurring labels.
6. Consider a future `road_obstruction` or broader `road_hazard` canonical type only if obstruction/debris/damage appears frequently enough in observed source records.

## Future Integration Notes

- Continue avoiding live DriveTexas calls until API terms, key handling, attribution, caching, rate limits, and display requirements are reviewed.
- Preserve raw source text and source fields when live integration is eventually prototyped, because precedence decisions depend on whether closure, lane, detour, construction, and flood terms are independent fields or free-text descriptions.
- Keep official-source evidence additive with community reports; do not allow official absence to imply that a roadway is clear.
- Treat Travel Confidence as a future consumer of normalized evidence, not as part of this fixture milestone.
- Run lifecycle simulation fixtures next so stale, cleared, reopened, end-time, and source-removal behavior can be reviewed without production ingestion.

## Audit Extension Contract

`window.gridlyDriveTexasShadowNormalizerAudit?.()` should include:

- `fixtureReview`
- `fixtureCount`
- `successfulMappings`
- `ambiguousMappings`
- `conflictingMappings`
- `recommendedTaxonomyChanges`
- `recommendedPrecedenceRules`

Expected V327 fixture counts:

| Audit field | Expected value |
|---|---:|
| `fixtureCount` | 16 |
| `successfulMappings` | 15 |
| `ambiguousMappings` | 7 |
| `conflictingMappings.length` | 5 |

## Non-Goals Confirmed

V327 did not connect to DriveTexas, ingest live data, build alerts, build markers, build UI, build routing, build flood layers, implement Travel Confidence, add external dependencies, or change production map behavior.

## Recommended Next Milestone

**V328 — DriveTexas Lifecycle Simulation Fixtures.** Use static fixture timelines only to test active, stale, cleared, reopened, expired, source-removed, scheduled construction, short-lived crash, disabled vehicle, detour-inheritance, and flood-closure lifecycle behavior before any live integration.
