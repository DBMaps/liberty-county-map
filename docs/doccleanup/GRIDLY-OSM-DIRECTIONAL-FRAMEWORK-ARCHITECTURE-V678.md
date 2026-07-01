> **Supersession Note:** This document has been superseded by `THE-GRIDLY-BLUEPRINT.md` as the governing architectural authority for Gridly. It remains preserved for historical context.

# GRIDLY V678 — OSM Directional Intelligence Framework Architecture

## Mission Alignment

Gridly's operating mission remains **Know Before You Go**. V678 defines a documentation-only architecture package for directional intelligence that preserves Gridly's product order:

1. **Awareness Platform First** — surface trustworthy county-aware road awareness without expanding runtime obligations.
2. **Route Intelligence Second** — evaluate directional and corridor intelligence only after offline extraction, audit, confidence, and containment gates are proven.

This milestone does not introduce user-facing direction labels, runtime routing behavior, or live transportation activation. It defines the framework required to decide whether OSM-derived metadata can support future offline directional intelligence across many corridors.

## Protected Systems Verification

The following protected systems are unchanged and must remain blocked unless a future milestone explicitly authorizes activation:

| Protected system | Required state | V678 state |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Unchanged |
| `historyUiEnabled` | `false` | Unchanged |
| `DriveTexasPaused` | `true` | Unchanged |
| `TransportationIntelligenceEnabled` | `false` | Unchanged |
| `TransportationIntelligenceDisplay` | `false` | Unchanged |
| `TransportationIntelligenceActivation` | `false` | Unchanged |

V678 is documentation-only. It does not modify `js/app.js`, runtime configuration, Supabase integration, county assets, TIGER assets, DriveTexas wiring, or Transportation Intelligence flags.

## Why a US59-Only Solution Is Insufficient

A US 59 / I-69-only solution would create a brittle path that fails Gridly's county and corridor expansion goals. US 59 / I-69 is useful as the first likely validation corridor because recent Overpass inspection found OSM ways with directional primitives such as `ref = I 69;US 59`, `highway = motorway`, `oneway = yes`, lane metadata, `destination:lanes` metadata, `tiger:county = Montgomery, TX`, and `Texas_Trunk_System = yes`. However, those observations are evidence of possible metadata richness, not proof that every future corridor has equivalent tagging quality.

A hardcoded US59 path is insufficient because it would:

- Encode route-specific assumptions that do not transfer to I-10, US 90, TX 146, TX 321, SH 105, SH 150, FM 1960, or future county corridors.
- Overfit confidence rules to motorway-grade dual carriageway geometry while failing rural, arterial, or farm-to-market road patterns.
- Create one-off naming, direction, and county containment logic that would need rework for every corridor.
- Increase user trust risk by implying directional certainty where OSM tags may be sparse, inconsistent, or locally ambiguous.
- Conflict with Gridly's awareness-first strategy by prematurely treating directional metadata as route intelligence.

## Scalable Directional-Intelligence Goals

The framework should support corridor-agnostic directional intelligence with the following goals:

1. **Metadata-first extraction** — derive candidate directional facts from OSM tags and geometry before any runtime use.
2. **Corridor-neutral schema** — model corridors by route references, geometry, jurisdiction, and confidence rather than hardcoded route names.
3. **County-contained validation** — ensure every corridor segment is tied to accepted county boundaries and does not leak into unsupported counties.
4. **Blocked-by-default output** — keep every generated directional artifact offline until human review and activation milestones approve use.
5. **Evidence traceability** — preserve source tags, way identifiers, extraction dates, and audit status for each segment.
6. **Tiered readiness** — classify corridors by metadata completeness and confidence instead of binary availability.
7. **Runtime isolation** — prevent extraction results from changing the production map, incident display, report forms, or routing behavior.

## OSM Directional Primitives Inventory

Potential OSM-derived primitives include:

| Primitive | Example / source | Directional value | Required? |
| --- | --- | --- | --- |
| Route reference | `ref`, `network`, `route` relations | Identifies corridor membership | Yes |
| Highway classification | `highway=motorway`, `trunk`, `primary`, `secondary`, etc. | Indicates expected geometry and access pattern | Yes |
| Oneway status | `oneway=yes`, `oneway=-1`, implicit motorway one-way | Supports carriageway direction inference | Yes |
| Geometry | way nodes, bearing, split carriageways, intersections | Supports directional bearing and continuity | Yes |
| County attribution | `tiger:county` or spatial containment against county boundaries | Supports county containment | Yes |
| Lane metadata | `lanes`, `lanes:forward`, `lanes:backward` | Improves confidence where present | Optional |
| Destination-lane metadata | `destination:lanes`, `destination:ref:lanes` | Helps validate travel direction and destinations | Optional |
| Direction tags | `direction`, `destination`, route relation roles where present | Supplemental validation | Optional |
| Surface/access tags | `access`, `motor_vehicle`, ramp tags | Helps filter non-mainline geometry | Optional |
| Link classification | `motorway_link`, `trunk_link`, `primary_link` | Separates ramps from mainline | Optional but important |

## Corridor-Agnostic Metadata Model

A future offline extraction package should model each corridor without route-specific hardcoding:

```json
{
  "corridorId": "normalized-route-or-corridor-id",
  "displayName": "Human reviewed corridor name",
  "routeReferences": ["US 59", "I-69"],
  "corridorTier": "tier_1_candidate",
  "countyScope": ["Montgomery"],
  "segments": [
    {
      "source": "osm",
      "osmWayId": "string",
      "geometryHash": "string",
      "highwayClass": "motorway",
      "oneway": true,
      "bearingDegrees": 0,
      "inferredDirection": "northbound_candidate",
      "directionConfidence": "medium",
      "requiredSignalsPresent": ["route_reference", "highway_classification", "oneway", "geometry", "county_attribution"],
      "optionalSignalsPresent": ["lane_metadata_optional", "destination_lane_metadata_optional"],
      "countyContainmentStatus": "contained",
      "tigerCoexistenceStatus": "coexists_no_replacement",
      "humanAuditStatus": "not_reviewed",
      "runtimeEligible": false
    }
  ]
}
```

The model separates extraction facts from runtime eligibility. No segment becomes displayable merely because OSM metadata exists.

## Corridor Eligibility Requirements

A corridor may enter offline extraction planning only when all minimum requirements are met:

1. Route references can be normalized into a stable corridor identity.
2. Highway classification is present and appropriate for public road awareness.
3. Geometry is complete enough to calculate bearings and segment continuity.
4. Oneway or forward/backward context is available or can be conservatively marked unknown.
5. County containment can be established through OSM county tags, accepted county boundaries, or both.
6. Existing TIGER/county assets can coexist without replacement.
7. Human audit can verify sampled segments, edge cases, ramps, overlaps, and local naming.
8. Runtime output remains disabled by default.

## Directional Confidence Framework

Directional confidence should be assigned conservatively:

| Confidence | Requirements | Allowed use |
| --- | --- | --- |
| Blocked | Missing required signals, unsupported county, ambiguous geometry, or failed audit | No runtime or prototype display |
| Low | Required route and geometry signals present but oneway/county/lane signals incomplete | Offline research only |
| Medium | Required signals present, county contained, geometry and oneway align, optional metadata may be partial | Offline prototype candidate |
| High | Required signals present, optional lane/destination evidence supports inferred direction, sampled human audit passes | Future activation planning candidate only |

Confidence must never be inferred from route name alone. Directional display remains blocked even for high-confidence offline candidates until a later milestone authorizes product behavior.

## County Containment Model

County containment must be enforced before any directional artifact is considered useful to Gridly:

- Prefer accepted Gridly county boundaries as the containment authority.
- Treat OSM `tiger:county` as evidence, not as the sole boundary source.
- Record every segment as contained, boundary-crossing, outside-scope, or unresolved.
- Block segments that cross unsupported county boundaries unless a future county expansion milestone approves them.
- Preserve county attribution in extraction evidence for auditability.

## TIGER Coexistence Strategy

OSM directional metadata should coexist with TIGER and county road assets. V678 does not recommend TIGER replacement. TIGER-derived road and county assets remain the stable awareness foundation, while OSM may become an offline metadata supplement for directional primitives. Future extraction should use OSM to annotate candidate corridor directionality, not to replace established county road geometry or labels.

## Runtime Isolation Strategy

All V678 outputs are documentation artifacts. Future offline work should remain isolated through:

- Separate extraction files outside runtime bundles.
- No import path from generated OSM metadata into `js/app.js`.
- No UI control, legend, tooltip, road label, or report-flow dependency.
- No Supabase schema, table, policy, or function change.
- No DriveTexas or Transportation Intelligence activation.
- Explicit `runtimeEligible: false` defaults in evidence models.

## Future DriveTexas Compatibility Model

DriveTexas remains paused. A future compatibility layer may compare OSM directional candidates with DriveTexas event directionality only after DriveTexas is explicitly unpaused by a separate milestone. The compatibility model should treat DriveTexas as a future validation source, not as an assumed current input. No V678 architecture requires DriveTexas availability.

## Supported Corridor Tiers

| Tier | Description | Example corridors | Status |
| --- | --- | --- | --- |
| Tier 0 | Unsupported or insufficient evidence | Any corridor lacking required signals | Blocked |
| Tier 1 | Candidate for offline extraction | US 59 / I-69, I-10, US 90 | Planning only |
| Tier 2 | Candidate for offline prototype design after extraction audit | To be assigned by future milestones | Blocked until approved |
| Tier 3 | Candidate for future runtime activation review | None in V678 | Not approved |

Designed future corridors include US 59 / I-69, I-10, US 90, TX 146, TX 321, SH 105, SH 150, FM 1960, and future county corridors that satisfy the same eligibility requirements.

## Blocked-by-Default Policy

All directional intelligence is blocked by default. Extraction, confidence scoring, prototype generation, display, DriveTexas comparison, and Transportation Intelligence activation each require separate milestone approval. Absence of a block is not approval.

## Human Audit Requirements

Human review must verify:

- Corridor identity and route reference normalization.
- County containment and boundary-crossing behavior.
- Directional inference for sampled mainline segments in both travel directions.
- Ramp/link filtering and intersection edge cases.
- Lane and destination metadata interpretation.
- False-positive risks for frontage roads, business routes, multiplexes, and route overlaps.
- Documentation of unresolved or ambiguous segments.

## Maintenance / Update Strategy

Future offline extraction should include repeatable update controls:

- Record extraction date, Overpass query version, OSM object IDs, and geometry hashes.
- Diff new extracts against prior evidence before changing confidence.
- Require re-audit when OSM ways split, merge, change tags, or move across county boundaries.
- Keep corridor definitions data-driven and versioned.
- Maintain a changelog for confidence promotions and demotions.
- Expire stale evidence after a defined review window.

## Risk Review

Primary risks include overfitting to US 59 / I-69, false directional confidence, inconsistent OSM metadata, county containment leakage, maintenance burden, and user trust damage from premature display. These risks require directional display to remain blocked while the architecture advances toward offline extraction planning.

## Future Milestone Roadmap

1. **V679 candidate extraction planning** — define Overpass queries, normalization scripts, and offline evidence locations.
2. **Offline extraction prototype** — generate non-runtime corridor metadata for multiple corridors.
3. **Human audit package** — sample and verify corridor segments across at least one motorway, one state highway, and one FM corridor.
4. **Confidence calibration** — compare required and optional signals across corridors.
5. **DriveTexas compatibility research** — only after DriveTexas is separately authorized for analysis.
6. **Runtime activation review** — only after extraction, audit, confidence, and product requirements are approved.

## Final Recommendation

Proceed with a corridor-agnostic OSM directional intelligence framework and reject a US59-only implementation. Treat US 59 / I-69 as the first likely validation corridor, but require every schema, confidence rule, audit procedure, and future tool to support multiple corridors without rework.

**Final determination: FRAMEWORK ARCHITECTURE READY FOR EXTRACTION PLANNING.**
