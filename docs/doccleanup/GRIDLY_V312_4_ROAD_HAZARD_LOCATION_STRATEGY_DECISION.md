# Gridly V312.4 — Road Hazard Location Strategy Decision

## 1. Executive Summary

V312.4 is a decision document only. It does not change production code, formatter output, candidate builders, alert cards, popups, awareness headlines, location descriptions, scoring, crossing behavior, review overrides, Route Watch, Active Route Context, data sync, or any user-facing behavior.

The final strategy is evidence-first selection. Tier availability is not enough. A candidate may only win when the audit can explain why the phrase is truthful, useful, and not overclaiming precision.

The final road-hazard location hierarchy remains:

1. **Tier 1 — Verified Intersection**
2. **Tier 2 — Crossing Landmark**
3. **Tier 3 — Community-Distance Reference**
4. **Tier 4 — Nearest-Road Fallback**

The key V312.4 decision is that the hierarchy is gated by evidence, not by string availability. `Road Closed on US 90 at Sawmill Road` requires explicit or geometry-supported intersection evidence. A coordinate nearest-road lookup, including `coordinate.resolveNearestRoadName`, is proximity evidence only and must not be treated as proof of a cross street.

When Tier 1 is unsupported and Tier 2 is unavailable, Tier 3 and Tier 4 should be selected by context:

- Tier 3 should usually win on major corridors such as **US 90**, **US 59**, **FM 1960**, **FM 1409**, and **TX 321** when a reliable community anchor gives better traveler awareness than a weak nearby-road name.
- Tier 4 should usually win on neighborhood-scale roads such as **Young Street**, **Cleveland Street**, **Colbert Street**, and **Winfree Street** when a close local road gives better block-level awareness than a broad community-distance phrase.

The final recommendation is to proceed to a future shadow-mode or production-readiness milestone only if implementation preserves these evidence gates and adds diagnostics that make each selected tier auditable.

## 2. Final Location Strategy

### Strategy principle

Road-hazard location text should answer the consumer question: **Where is the issue in a way I can understand before I go?** The answer should use plain awareness language and should not sound more certain than the underlying evidence supports.

### Tier 1 — Verified Intersection

Tier 1 may produce wording like:

- `Road Closed on US 90 at Sawmill Road`
- `Crash on Cleveland Street at Young Street`

Tier 1 is allowed only when the system has reliable evidence that the hazard is at or extremely near a real intersection between the primary road and the reference road.

Required evidence must include at least one of the following:

- An explicit cross-street or intersection field from a trusted incident source.
- Source semantics that clearly identify the reference as a cross street, not just a nearby road.
- Verified road geometry showing that the primary road and reference road intersect at or very near the hazard coordinate.
- A reviewed, human-confirmed intersection landmark that has been approved for road-hazard location wording.
- Resolver metadata that explicitly says the coordinate is at an intersection, paired with a strict distance threshold.

Disallowed evidence includes:

- A nearest-road name returned from `coordinate.resolveNearestRoadName` by itself.
- A pair of nearby road names with no physical intersection confirmation.
- A parsed road name from free text that lacks cross-street semantics.
- A crossing name used as a proxy for a road intersection.
- A road that is merely closest by distance but may be parallel, inaccessible, private, or unrelated.

### Tier 2 — Crossing Landmark

Tier 2 may produce wording like:

- `Road Closed on US 90 near the Waco Street crossing`

Tier 2 is allowed when a road hazard is best oriented by a known crossing landmark, while still remaining a road-hazard description. It must not turn the road hazard into a crossing incident.

Requirements for a phrase such as `near the Waco Street crossing`:

- The crossing must be reviewed, trusted, or otherwise available from the crossing landmark system with adequate provenance.
- The road hazard coordinate must be within a conservative proximity threshold that makes the crossing a meaningful landmark.
- The crossing must be recognizable enough to help users distinguish the affected segment.
- The wording must use landmark language such as `near the {crossingName} crossing`, not false intersection language such as `at {crossingName}`.
- The selected crossing must be more useful than both a community-distance phrase and a generic nearest-road fallback.

Tier 2 must not be selected from generic proximity alone. A nearby rail line, a text match, or an unresolved crossing-like road name is not enough unless it maps to a trusted crossing landmark.

### Tier 3 — Community-Distance Reference

Tier 3 may produce wording like:

- `Road Closed on US 90, 1 mile west of Dayton`
- `Flooding on US 59, 2 miles north of Cleveland`
- `Disabled Vehicle on FM 1409, 3 miles south of Dayton`

Tier 3 should win when a community-distance phrase gives the clearest awareness location without implying a false intersection.

Tier 3 is especially useful on major corridors because users often understand the road and nearby community before they understand minor local road names. On **US 90**, **US 59**, **FM 1960**, **FM 1409**, and **TX 321**, a phrase like `west of Dayton`, `north of Cleveland`, or `east of Liberty` can quickly distinguish the affected segment of a long route.

Tier 3 should win when:

- Tier 1 lacks verified intersection evidence.
- Tier 2 lacks a reviewed, nearby, meaningful crossing landmark.
- The primary road is a highway, FM road, state route, long county route, or other major corridor.
- The community anchor is reliable, recognizable, and not too far from the hazard.
- The distance and direction can be generated conservatively.
- The nearest-road reference is weak, obscure, private, minor, inaccessible, proximity-only, or less useful to travelers.

Tier 3 should not win when the phrase is too broad for the consumer need, such as inside a dense town grid where a nearby local road would better describe the block.

### Tier 4 — Nearest-Road Fallback

Tier 4 may produce wording like:

- `Road Closed on Young Street near Cleveland Street`
- `Crash on Colbert Street near Winfree Street`
- `Road Hazard near Young Street`

Tier 4 should win when the safest useful phrase is a nearby-road reference and the evidence does not support Tier 1, Tier 2, or Tier 3.

Tier 4 is especially useful on neighborhood-scale roads because local users usually need the block, access point, or nearby street rather than a broad distance from a community. For **Young Street**, **Cleveland Street**, **Colbert Street**, and **Winfree Street**, a close local road reference usually provides clearer consumer awareness than `1 mile west of Dayton` or another community-distance phrase.

Tier 4 should win when:

- Tier 1 is unsupported.
- Tier 2 is unavailable or not meaningful.
- Tier 3 is unavailable, unreliable, or too broad.
- The primary road is local, neighborhood-scale, town-grid, or short-segment.
- The reference road is distinct, close, and more useful than a community anchor.
- The phrase remains proximity-based and does not use `at` semantics.

Tier 4 is a fallback, not a downgrade in quality. In local contexts it may be the most consumer-useful answer.

## 3. Tier Decision Matrix

| Decision Question | Tier 1 — Verified Intersection | Tier 2 — Crossing Landmark | Tier 3 — Community-Distance Reference | Tier 4 — Nearest-Road Fallback |
| --- | --- | --- | --- | --- |
| What consumer question does it answer? | Which exact intersection is affected? | Which known crossing landmark is the hazard near? | Where along the corridor is the hazard? | Which nearby local road or block is the hazard near? |
| Best road context | True junctions, town-street intersections, highway intersections | Road hazards physically near reviewed crossings | US highways, state routes, FM roads, long corridors | Local streets, neighborhood grids, short local roads |
| Best examples | `US 90 at Sawmill Road` only if verified | `US 90 near the Waco Street crossing` | `US 90, 1 mile west of Dayton`; `US 59, north of Cleveland`; `FM 1409, south of Dayton` | `Young Street near Cleveland Street`; `Colbert Street near Winfree Street` |
| Main strength | Highest precision when true | Strong local landmark without changing incident type | Strong countywide and traveler awareness | Strong block-level local awareness |
| Main risk | False precision if inferred from nearest-road data | Confusing road hazards with crossing incidents | Too broad in dense local grids | Looks precise while still being proximity-only |
| Selection gate | Explicit or geometry-supported intersection evidence | Reviewed crossing landmark plus meaningful proximity | Reliable community anchor plus corridor context | Safe fallback when higher tiers are unsupported or less useful |

## 4. Evidence Requirements Table

| Tier | Required Evidence | Acceptable Evidence | Disallowed Evidence | Example Output |
| --- | --- | --- | --- | --- |
| Tier 1 — Verified Intersection | Proof that the primary road and reference road intersect at or very near the hazard coordinate. | Explicit `intersection`, `crossStreet`, `fromStreet`, `toStreet`, or equivalent source field; verified road geometry intersection; reviewed human-confirmed intersection landmark; resolver metadata explicitly identifying an intersection plus strict distance support. | `coordinate.resolveNearestRoadName` alone; nearest-road pairs without intersection geometry; generic proximity; parsed free-text road names without cross-street meaning; crossing landmark names used as road intersections. | `Road Closed on US 90 at Sawmill Road` |
| Tier 2 — Crossing Landmark | A trusted crossing landmark that is close enough and meaningful enough to orient a road hazard. | Reviewed Gridly crossing; approved crossing override; trusted crossing dataset row; known crossing landmark with conservative distance support and no crossing-incident implication. | Generic nearby rail geometry; unreviewed text match; road name that happens to match a crossing; distance-only crossing proximity with no reviewed landmark; wording that says or implies the crossing itself is blocked. | `Road Closed on US 90 near the Waco Street crossing` |
| Tier 3 — Community-Distance Reference | Reliable community anchor, conservative distance, cardinal direction, and corridor context. | Recognized community center or awareness anchor; validated distance/direction calculation; primary road class indicating highway/FM/state/long corridor; weak or proximity-only nearest-road evidence. | Unknown or unstable community anchor; excessive or misleading distance; ambiguous direction; dense local-street context where the phrase is too broad; using community-distance to hide a verified intersection. | `Road Closed on US 90, 1 mile west of Dayton` |
| Tier 4 — Nearest-Road Fallback | A safe primary road or nearby-road phrase when higher tiers are unsupported or less useful. | Primary road from existing incident fields; coordinate resolver road name used as proximity evidence; nearby local road that is distinct and close; local-street context where block-level reference is useful. | `at` wording; treating nearest-road output as intersection proof; obscure/private/inaccessible road promoted on a major corridor when a better community anchor exists; reference roads that duplicate the primary road. | `Road Closed on Young Street near Cleveland Street` |

## 5. Selection Order

The recommended future selection order is:

1. **Tier 1 — Verified Intersection**
   - Select only if intersection evidence is affirmative.
   - If the evidence is proximity-only, Tier 1 is not available even if two road names exist.
2. **Tier 2 — Crossing Landmark**
   - Select only if the crossing is reviewed/trusted, nearby, meaningful, and worded as a landmark.
   - Do not select Tier 2 from generic crossing proximity.
3. **Tier 3 — Community-Distance Reference**
   - Select when the hazard is on a major corridor and a reliable community-distance phrase gives better awareness than a weak nearest-road reference.
4. **Tier 4 — Nearest-Road Fallback**
   - Select when higher tiers are unsupported, unavailable, or less useful, especially on local roads and neighborhood grids.

### Exceptions

The hierarchy should allow context-aware exceptions below Tier 2:

- **Local-road exception:** Tier 4 may beat Tier 3 on town-grid or neighborhood roads because block-level awareness is more useful than community-distance wording.
- **Major-corridor exception:** Tier 3 may beat Tier 4 on highways and FM roads when the reference road is proximity-only, obscure, minor, private, inaccessible, or not useful to broad travelers.
- **Reviewed-crossing exception:** Tier 2 should remain above Tier 3 and Tier 4 when the crossing is a trusted local landmark and wording guardrails prevent crossing-incident confusion.
- **Verified-intersection non-exception:** Tier 1 should not be bypassed when true intersection evidence exists, because verified `at` wording is the clearest consumer phrase.

## 6. Consumer-Language Review

The final hierarchy supports Gridly's consumer-language goals.

### Know Before You Go

The hierarchy prioritizes the phrase that helps a user understand the affected segment before leaving or rerouting. Verified intersections answer exact-location questions. Crossing landmarks help where local users orient by crossings. Community-distance phrases help travelers identify the affected portion of a long corridor. Nearest-road fallbacks preserve useful local block context.

### Awareness Platform First

The strategy avoids navigation-style precision when the system does not have navigation-grade evidence. `Near` remains appropriate for proximity. `At` is reserved for verified intersections. Community-distance wording gives broad awareness without pretending to route the user to a precise turn.

### Consumer Language Over Technical Language

The selected phrases should be plain and readable:

- Prefer `near the Waco Street crossing` over internal crossing identifiers.
- Prefer `1 mile west of Dayton` over coordinate or geometry language.
- Prefer `near Cleveland Street` over resolver-source terminology.
- Avoid exposing tier names, confidence scores, source names, or diagnostics in user-facing copy.

### Wording Guardrails

Future copy should not sound like navigation guidance. It should not instruct users to turn, detour, take an alternate route, or navigate to a coordinate. The wording should describe the hazard location only.

## 7. Regression Protections

Future implementation must not:

- Infer intersections from nearest-road lookups.
- Treat `coordinate.resolveNearestRoadName` as proof of a cross street.
- Treat `resolveNearbyRoadPair` output as proof of an intersection without geometry or source semantics.
- Promote unsupported Tier 1 wording because two road names are available.
- Use `at {referenceRoad}` unless Tier 1 evidence is affirmative.
- Treat generic crossing proximity as a reviewed crossing landmark.
- Downgrade reviewed crossing landmarks when they are the clearest valid reference.
- Convert road hazards into crossing incidents.
- Change crossing names, crossing review overrides, crossing popups, or crossing-specific behavior.
- Change alert cards, popups, awareness headlines, location descriptions, scoring, or formatter output during an audit-only milestone.
- Use community-distance wording with unreliable anchors, misleading distances, or ambiguous directions.
- Prefer obscure, private, or inaccessible nearest-road references on major corridors when a reliable community-distance phrase is clearer.
- Use technical language such as resolver names, geometry confidence, or tier labels in consumer-facing text.
- Create wording that sounds like turn-by-turn navigation guidance.
- Allow future diagnostics to mutate production incident records or route-scoring inputs.

## 8. Implementation Readiness Assessment

Enough evidence exists to proceed to a future implementation-design milestone, but not directly to broad user-facing production copy without another shadow validation step.

### Ready

- The final tier hierarchy is defined.
- Tier 1 evidence gates are defined.
- Tier 2 crossing-landmark requirements are defined.
- Tier 3 versus Tier 4 selection principles are defined.
- Major-corridor and local-street examples are documented.
- Regression protections are clear.
- The consumer-language goal is stable: truthful, useful awareness wording without false precision.

### Still needed before production behavior changes

- Concrete distance thresholds for Tier 1 geometry confirmation.
- Concrete distance thresholds for Tier 2 crossing-landmark proximity.
- Concrete distance and rounding rules for Tier 3 community-distance wording.
- A road-class or corridor-classification rule that distinguishes major corridors from local roads.
- A recognizability or exclusion rule for private, obscure, inaccessible, or low-value reference roads.
- Shadow diagnostics that record why Tier 3 beat Tier 4 or why Tier 4 beat Tier 3.
- Browser validation confirming unsupported Tier 1 rows remain downgraded.
- Fixture coverage for US 90, US 59, FM 1960, FM 1409, TX 321, Young Street, Cleveland Street, Colbert Street, and Winfree Street examples.

## 9. Final Recommendation

Adopt the V312.4 evidence-first location strategy as the governing decision framework for future road-hazard location work.

The recommended final hierarchy is:

**Tier 1 — Verified Intersection**

↓

**Tier 2 — Crossing Landmark**

↓

**Tier 3 — Community-Distance Reference**

↓

**Tier 4 — Nearest-Road Fallback**

The hierarchy should be implemented only in a future milestone with shadow diagnostics first. Future production work should preserve all existing non-road-hazard behavior and must not change crossing behavior, review overrides, scoring, alert generation, Route Watch, Active Route Context, or incident records.

The most important final decision is this: **a road-name resolver can provide useful proximity context, but it does not prove an intersection.** Verified `at` wording belongs only to Tier 1. When that evidence is absent, the system should choose the best consumer-aware landmark, community-distance, or nearest-road phrase without overstating certainty.
