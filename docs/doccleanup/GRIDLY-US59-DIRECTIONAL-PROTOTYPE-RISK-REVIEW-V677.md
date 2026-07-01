# GRIDLY V677 — US 59 / I-69 Directional Prototype Risk Review

## Scope

This risk review covers the offline-only V677 research validation for US 59 / I-69 in `liberty-tx` and `montgomery-tx`. It does not authorize runtime behavior changes, directional UI, route guidance, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, county-road asset replacement, Supabase changes, new counties, or framework changes.

## False directional confidence

False directional confidence is the primary V677 risk. A divided corridor can appear directionally obvious from map geometry, but Gridly cannot treat line bearing as proof of northbound or southbound travel direction. Without OSM relation membership, one-way semantics, carriageway pairing, and conflict review, a directional label could be plausible but wrong.

Risk posture: **High and blocking** until segment-level non-bearing evidence exists.

## OSM relation dependency

US 59 / I-69 validation depends on OSM route relations and route-reference tags being complete enough to identify mainline corridor membership. Relation data may be incomplete, stale, fragmented across route variants, or inconsistent at transitions and concurrency points. If relation membership is missing or ambiguous, the prototype must quarantine the segment rather than infer membership from nearby geometry.

Risk posture: **High** because no V677 relation-member inventory is available in the repository.

## County containment

V677 is limited to `liberty-tx` and `montgomery-tx`. US 59 / I-69 naturally continues beyond county boundaries, so preprocessing must clip geometry while preserving enough metadata to understand route continuity. County clipping can create boundary-cut fragments that look discontinuous or directionally ambiguous if adjacent out-of-scope context is removed.

Risk posture: **High and unresolved** until every accepted segment is clipped, assigned to exactly one approved county, and documented with boundary-cut handling.

## Future maintenance

OSM data changes over time. Any future directional catalog would require repeatable extraction, source timestamps, checksums, regression checks, and review of changed relation membership. A one-time manual extract would not be enough for durable directional intelligence.

Risk posture: **Medium to high** because maintenance workflow is prerequisite work, not an implementation detail.

## User trust impact

Gridly is an awareness platform first. Incorrect NB/SB context could cause users to misunderstand an incident location even if Gridly does not provide navigation. A single wrong directional label on a major corridor could reduce confidence in county awareness information.

Risk posture: **High** if directional information is displayed before confidence is proven; blocked in V677 because no display is enabled.

## DriveTexas assumptions

V677 does not activate DriveTexas and does not prove DriveTexas event text can be mapped to OSM corridor segments. Future official-event integration would need separate validation for vocabulary, frontage-road handling, lane descriptions, closures, and event extents. It would be unsafe to assume that a validated OSM corridor catalog automatically solves DriveTexas matching.

Risk posture: **Medium to high** for future milestones; no runtime impact in V677.

## Prototype limitations

V677 is limited by the absence of local OSM extract artifacts. The repository does not include the route-relation member table, source timestamp, checksum, per-way OSM IDs, county-clipped geometry, or segment confidence audit required for an evidence-based pass. Therefore, V677 can validate the governance boundary and failure condition, but it cannot validate corridor directionality.

Risk posture: **Blocking** for any PASS or PASS WITH OBSERVATIONS determination.

## Mitigations required before retry

Before a future retry can be considered, Gridly would need:

1. Reproducible offline OSM extraction for US 59 / I-69.
2. Source timestamp and checksum.
3. Route relation and member-way inventory.
4. County-contained clipping for Liberty and Montgomery only.
5. Mainline/frontage/ramp/connector classification.
6. One-way and carriageway-pairing review.
7. Segment-level confidence scoring.
8. Accepted, rejected, and quarantined segment audit output.
9. Explicit prohibition on bearing-only direction assignment.
10. Continued runtime and display isolation.

## Final risk determination

**FAIL / BLOCKED FOR DIRECTIONAL USE.** The risk of unsupported directional confidence remains too high. Gridly should not enable directional display, route guidance, DriveTexas activation, Transportation Intelligence activation, or runtime use from V677 outputs.
