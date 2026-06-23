# GRIDLY V675 — OSM Directional Intelligence Risk Review

## Scope

This risk review supports the V675 documentation-only audit of whether OpenStreetMap can safely support future Gridly directional intelligence for major corridors. It does not approve implementation, display, routing, DriveTexas integration, Transportation Intelligence activation, or TIGER replacement.

## OSM data completeness risk

OSM coverage quality can vary by county, corridor, and segment. Major divided corridors may be well represented, while smaller state highways or farm-to-market roads may have incomplete relation membership, inconsistent geometry, or missing directional semantics.

**Risk posture:** Medium.

**Control:** Treat every corridor segment as blocked until preprocessing proves route identity, geometry, and directional confidence.

## OSM relation/route-name inconsistency risk

OSM route relations, `ref` tags, and `name` tags may not always align. A segment may be named locally, tagged with a route number, included in a relation, or represented by multiple parallel ways. Directional intelligence must not depend on a single label.

**Risk posture:** Medium to high.

**Control:** Require multi-signal validation using route relation membership, `ref`, `name`, highway classification, and geometry continuity. Reject conflicts unless manually resolved in an audit artifact.

## County containment risk

Major routes cross county boundaries. Clipping geometry to Liberty, Montgomery, and San Jacinto can create partial segments that lose continuity context. Future Chambers or Jefferson relevance for I-10 must not cause uncontrolled expansion into the current runtime scope.

**Risk posture:** Medium.

**Control:** Clip runtime geometry to approved counties only, preserve cross-county route identity as metadata, and mark boundary-cut segments for validation. Keep I-10 future-only until new county scope is approved.

## Runtime asset-size risk

Full OSM road extracts could be too large and would violate the corridor-only purpose. Even a corridor catalog could grow if too many local roads, ramps, frontage roads, or unvalidated variants are included.

**Risk posture:** Medium.

**Control:** Use a corridor-only extract with simplified geometry, compact metadata, and measured bundle impact. Do not load or display the catalog at runtime until separately approved.

## False directional confidence risk

The highest user-facing risk is presenting NB/SB/EB/WB context when the source data does not prove it. Guessing from road bearing alone can be wrong on curves, ramps, frontage roads, divided highways, and diagonal corridors.

**Risk posture:** High.

**Control:** Directionality must be blocked unless proven by validated carriageway geometry, one-way semantics, route identity, and confidence rules. Bearing-only inference must not be sufficient.

## Maintenance/update risk

OSM changes over time. A future catalog would require repeatable refresh, diff review, regression testing, and confidence revalidation. Without maintenance, stale or changed route data could become misleading.

**Risk posture:** Medium.

**Control:** Require extraction date, source version, validation artifacts, and refresh procedures before any prototype moves toward production.

## DriveTexas mapping risk

Future official transportation-event text may describe locations using lane names, frontage roads, ramps, mile markers, local names, or official corridor references that do not map cleanly to OSM segments. DriveTexas remains paused and must not be activated by this audit.

**Risk posture:** Medium to high.

**Control:** Keep DriveTexas integration blocked. If later approved, validate official event vocabulary and segment matching separately before using OSM directional metadata.

## User trust risk

Gridly is an awareness platform first. Incorrect directional context could cause users to over-trust route intelligence, misunderstand incidents, or believe Gridly is providing official routing guidance.

**Risk posture:** High.

**Control:** Keep directional display blocked until explicitly approved. Any future language must remain awareness-oriented and avoid implying official navigation or guaranteed route status.

## Recommendation

Directional display should remain blocked until explicitly approved by a future milestone. OSM should not replace TIGER. OSM may be evaluated only as a supplemental corridor-only directional catalog, and only after confidence can be proven without guessing.
