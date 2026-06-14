# Gridly V312.3 — Community Distance vs Nearest Road Evaluation

## 1. Executive summary

V312.3 is audit-only. It does not change production wording, candidate generation, scoring, formatter behavior, alert cards, popups, awareness headlines, crossing behavior, review overrides, coordinates, incident data, Route Watch, Active Route Context, Supabase sync, or user-facing behavior.

V312.2 established that unsupported Tier 1 wording is over-promoted when proximity-only reference roads are treated as true intersections. The remaining selection question is what to prefer when Tier 1 is not supported and no validated crossing reference is available: Tier 3 community-distance wording or Tier 4 nearest-road fallback wording.

The evaluation finding is that neither Tier 3 nor Tier 4 should globally dominate. The safer product strategy is corridor-aware selection:

- Favor **Tier 3 community-distance** on long, regional corridors when the nearby reference road is weak, obscure, proximity-only, or unlikely to help travelers understand where along the corridor the hazard sits.
- Favor **Tier 4 nearest-road fallback** on local streets and town-grid contexts when the reference road is recognizable, close, and more precise than a broad community-distance phrase.
- Keep **crossing reference** available above both when the crossing is a reviewed, nearby, meaningful landmark and the wording clearly describes a road hazard near a crossing rather than changing the incident into a crossing event.

For the example pair, `Road Closed on US 90, 1 mile west of Dayton` is generally better for broad corridor awareness if Sawmill Road is only proximity evidence. `Road Closed on US 90 near Sawmill Road` is better when Sawmill Road is a locally recognizable access point, when the hazard is very close to it, or when the user is already navigating that local segment.

## 2. Tier 3 vs Tier 4 comparison matrix

| Evaluation axis | Tier 3 — community-distance reference | Tier 4 — nearest-road fallback | Product interpretation |
| --- | --- | --- | --- |
| Best fit | Long corridors, rural stretches, regional highways, repeated corridor incidents | Neighborhood grids, town streets, short local roads, dense local reference networks | Selection should depend on road class and context, not only candidate availability. |
| Example | `Road Closed on US 90, 1 mile west of Dayton` | `Road Closed on US 90 near Sawmill Road` | Both are safe compared with unsupported `at Sawmill Road`; usefulness differs by audience. |
| Awareness value | Strong for countywide and traveler awareness because it answers "where along the corridor?" | Strong for locals when the reference road is recognizable and close | Tier 3 helps orient; Tier 4 helps pinpoint. |
| Precision | Approximate but semantically honest | Potentially more precise, but only if the reference road is actually meaningful and close | Tier 4 can look precise while still being weak if it is only a nearest-road artifact. |
| Overclaim risk | Low if distance and direction are computed from reliable community anchors | Medium if users infer an intersection or access point that is not verified | Avoid `at` for Tier 4 unless Tier 1 evidence exists. |
| Local usefulness | Medium outside town; lower inside a dense street grid | High when the reference road is a real local landmark or cross street | Local streets generally benefit from nearest-road context. |
| Traveler usefulness | High on highways/FM roads because travelers know towns and direction | Medium unless the reference road appears on signs or navigation | Corridor travelers often understand `west of Dayton` faster than a minor road name. |
| Failure mode | Too broad: a user may still not know the exact segment | Too misleading: a nearby road may not be accessible, intersecting, or familiar | The least harmful failure depends on road class. |
| Data burden | Reliable community anchor, distance, direction, and rounding | Reliable primary road plus a distinct nearby reference road | Both need provenance; Tier 4 needs proximity-distance confidence to avoid false precision. |
| Recommended default when Tier 1 unsupported | Major corridor default when community anchor is reliable | Local street default, or major corridor fallback when reference road is highly recognizable/tight | Corridor-aware rules should select between them. |

## 3. Corridor examples

### US 90

US 90 is a long regional corridor. If the audit only knows that `Sawmill Road` came from `coordinate.resolveNearestRoadName` and `referenceRoadAppearsProximityOnly` is true, community-distance is generally more useful for countywide awareness than a weak nearest-road phrase. `1 mile west of Dayton` gives a mental map position along US 90 without implying an intersection. `near Sawmill Road` is still useful if Sawmill is very close, locally recognized, or the expected driver action is to avoid that particular access point.

### FM 1960

FM 1960 can serve both corridor and local access roles. On longer stretches outside a compact town grid, Tier 3 should usually win because drivers need to know which side of a community the hazard affects. Near a named junction, school area, subdivision entrance, or other locally known segment, Tier 4 may be better if the reference is tight and recognizable.

### FM 1409

FM 1409 is a corridor where community-distance wording can help distinguish rural segments that may otherwise share the same road label. Tier 3 is usually preferable when the nearby reference road is a minor road, private road, or resolver-only neighbor. Tier 4 becomes more useful when the reference road is a common local turnoff or a road drivers would use to reroute.

### TX 321

TX 321 spans regional movement and town-edge contexts. Tier 3 should be favored for out-of-town or edge-of-town hazards where `north/south/east/west of {community}` helps travelers orient. Tier 4 should be favored when the hazard is in a denser local area and the nearby road gives a more actionable pinpoint than the community anchor.

### US 59

US 59 is a major regional corridor. Community-distance has high awareness value because incidents can be far apart while sharing the same road name. A nearest-road fallback should be reserved for high-confidence, recognizable references or where the hazard is close enough to the reference road that `near` meaningfully narrows the location.

## 4. Local street examples

### Young Street

For a local street such as Young Street, Tier 4 is generally more useful than Tier 3 because a nearby cross street or local reference is likely how residents identify the exact block. `near Cleveland Street` or another close local reference is more actionable than a broad `1 mile west of Dayton` phrase inside or near town.

### Cleveland Street

Cleveland Street is better served by nearest-road context when a distinct nearby local road is available. Community-distance may be too broad because the user already understands the community; the missing piece is the block or nearest local access point.

### Colbert Street

Colbert Street should usually favor Tier 4 because block-level awareness matters more than corridor-scale orientation. Tier 3 becomes useful only if the street segment is outside a known grid, the nearest-road candidate is weak or private, or the event is being summarized for broad countywide awareness rather than local navigation.

## 5. Recommended selection strategy

This recommendation is for future design only and should not be implemented in V312.3.

1. Preserve the hierarchy gate from V312.2: Tier 1 must require explicit or geometry-supported intersection evidence.
2. Evaluate Tier 2 before Tier 3 or Tier 4 only when a reviewed crossing landmark is nearby, meaningful, and wording guardrails prevent crossing-incident confusion.
3. When Tier 1 is unsupported and Tier 2 is unavailable, classify the primary road context:
   - **Major corridors:** US highways, state highways, FM corridors, and long county routes should default toward Tier 3 when the community anchor is reliable.
   - **Neighborhood/local roads:** short town streets, residential grids, and local access roads should default toward Tier 4 when the reference road is distinct and close.
   - **Hybrid segments:** town-edge highway segments should compare both candidates using proximity strength, road recognizability, and whether the community-distance phrase is too broad.
4. Treat resolver-only reference roads as lower-confidence unless distance metadata, source semantics, or geometry confirms that the reference is close and useful.
5. Prefer Tier 3 over Tier 4 on long corridors when the reference road is minor, private, obscure, inaccessible, or only proximity-derived.
6. Prefer Tier 4 over Tier 3 when the reference road is a recognizable local road, a real turnoff, or a more actionable block-level cue.
7. Do not let Tier 4 wording drift into Tier 1 semantics. `near Sawmill Road` is acceptable as proximity wording; `at Sawmill Road` requires true-intersection support.

## 6. When `near Sawmill Road` is better than `1 mile west of Dayton`

`Road Closed on US 90 near Sawmill Road` provides better awareness value when:

- Sawmill Road is close enough that drivers can use it as a practical navigation or avoidance cue.
- Sawmill Road is locally recognizable to the intended audience.
- The incident is in a town-edge or local-access context where block-level detail matters.
- The community-distance anchor is too broad, for example when many US 90 incidents could be described as west of Dayton.
- The hazard affects turning, access, frontage, or rerouting decisions tied to Sawmill Road.
- The nearest-road evidence is not merely a distant or incidental resolver artifact.

## 7. When `1 mile west of Dayton` is better than `near Sawmill Road`

`Road Closed on US 90, 1 mile west of Dayton` provides better awareness value when:

- US 90 is the main user mental model and the key question is where along the corridor the closure sits.
- Sawmill Road is proximity-only and not verified as intersecting, accessible, or locally meaningful.
- The audience includes travelers who may know Dayton and US 90 but not minor local roads.
- The hazard is on a rural or edge-of-community stretch where nearby-road names can be obscure.
- Multiple nearby minor roads could compete as references, making any one nearest road feel arbitrary.
- The community anchor and direction are reliable and the distance is short enough to be understandable.

## 8. Crossing reference situations that can outperform both

A crossing reference can still outperform both Tier 3 and Tier 4 when all of the following are true:

- The crossing is a reviewed Gridly crossing or otherwise trusted crossing landmark.
- The road hazard is physically near enough to the crossing that the crossing is a meaningful landmark.
- The crossing name is more recognizable than the nearest road and more precise than the community-distance phrase.
- The wording says the road hazard is near the crossing and does not imply the crossing incident itself is blocked unless the incident type supports that.
- The crossing reference helps users distinguish between multiple hazards on the same corridor.

Example: a road closure on US 90 near a locally known Waco Street crossing may be more actionable as a landmark than either `1 mile west of Dayton` or a weak resolver-selected nearby road. This is especially true if drivers already use the crossing as a local orientation point.

## 9. Regression risks

| Risk | Impact | Mitigation for future implementation |
| --- | --- | --- |
| Major-corridor overgeneralization | Local users may lose a useful nearby-road cue on highway segments inside town | Add hybrid rules for town-edge and city-limit contexts. |
| Local-street overprecision | A nearest-road candidate may imply a more exact location than the data supports | Require distance/source confidence for Tier 4, and keep `near` wording. |
| Community-anchor drift | Distance/direction from the wrong community can mislead users | Use validated awareness-area anchors and expose anchor provenance in audit rows. |
| Obscure nearest-road promotion | Private roads or minor roads may be less useful than a town-distance phrase | Penalize private/minor/low-recognition reference roads on major corridors. |
| Crossing confusion | A road hazard near a crossing could be mistaken for a crossing closure | Keep crossing wording guarded and separate from crossing incident behavior. |
| Inconsistent duplicate cards | Similar hazards on the same corridor may alternate between Tier 3 and Tier 4 unpredictably | Use deterministic corridor-aware scoring and log candidate provenance. |
| False Tier 1 relapse | Tier 4 `near` references may later be promoted back to unsupported `at` wording | Preserve `tier1Supported` gating and regression tests for proximity-only sources. |

## 10. Consumer-language review

Consumer language should optimize for fast comprehension without implying unsupported precision.

- `Road Closed on US 90, 1 mile west of Dayton` is clear for countywide awareness because it answers the broad orientation question first.
- `Road Closed on US 90 near Sawmill Road` is clear for local avoidance when Sawmill Road is a known nearby cue.
- `Road Closed on US 90 at Sawmill Road` should not be used unless Tier 1 is supported because `at` sounds like a verified intersection.
- `near the Waco Street crossing` can be strong when the crossing is a trusted landmark, but it must remain visibly different from a crossing-incident headline.
- For major corridors, users benefit from phrases that distinguish one segment from another.
- For neighborhood roads, users benefit from phrases that identify the block or closest local road.

The best consumer-facing rule is not "always use the closest named road" or "always use the nearest town." It is "use the reference that a reasonable driver would use to understand the affected segment without overstating certainty."

## 11. Final recommendation

Adopt corridor-aware Tier 3 vs Tier 4 selection as the future design direction, with no V312.3 production implementation.

Recommended future priority order when Tier 1 is unsupported:

1. Use Tier 2 crossing reference only for reviewed, nearby, meaningful crossing landmarks with strict wording guardrails.
2. Use Tier 3 community-distance on major corridors when the community anchor is reliable and the nearest-road reference is weak, obscure, or proximity-only.
3. Use Tier 4 nearest-road fallback on local streets, town grids, and major-corridor segments where the reference road is close, recognizable, and more actionable than the community-distance phrase.
4. Keep unsupported `at {reference road}` wording out of the selection path.

For the specific US 90 / Sawmill / Dayton example, the recommended audit interpretation is:

- If Sawmill Road is proximity-only from `coordinate.resolveNearestRoadName`, prefer evaluating `Road Closed on US 90, 1 mile west of Dayton` as the safer major-corridor candidate.
- If Sawmill Road is verified as close, recognizable, and useful for access or rerouting, keep `Road Closed on US 90 near Sawmill Road` as a legitimate Tier 4 candidate.
- Do not use `Road Closed on US 90 at Sawmill Road` unless separate Tier 1 evidence confirms the intersection relationship.
