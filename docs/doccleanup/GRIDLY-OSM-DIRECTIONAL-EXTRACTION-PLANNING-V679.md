# GRIDLY V679 — OSM Directional Extraction Planning

## Mission Alignment

Gridly remains a **Know Before You Go** awareness platform. V679 is documentation-only and defines how a future OSM directional intelligence system would acquire, normalize, validate, and inventory corridor metadata without changing runtime behavior.

Product order remains unchanged:

1. **Awareness Platform First** — preserve county-aware, trusted situational awareness as the primary product responsibility.
2. **Route Intelligence Second** — directional corridor intelligence may advance only through offline extraction, inventory, audit, confidence, and activation gates.

V679 does **not** perform extraction. It defines how extraction would work in a future milestone.

## Protected Systems Verification

| Protected system | Required state | V679 verification |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Must remain unchanged |
| `historyUiEnabled` | `false` | Must remain unchanged |
| `DriveTexasPaused` | `true` | Must remain unchanged |
| `TransportationIntelligenceEnabled` | `false` | Must remain unchanged |
| `TransportationIntelligenceDisplay` | `false` | Must remain unchanged |
| `TransportationIntelligenceActivation` | `false` | Must remain unchanged |

V679 does not modify `js/app.js`, runtime configuration, Supabase, TIGER assets, county road assets, DriveTexas behavior, Transportation Intelligence behavior, or directional UI.

## V678 Framework Recap

V678 established that OSM directional intelligence must be corridor-agnostic, blocked by default, county-contained, auditable, and isolated from runtime systems. It rejected a US 59 / I-69-only architecture and recommended a framework that can support US 59 / I-69, I-10, US 90, TX 146, TX 321, SH 105, SH 150, FM 1960, and future corridors through shared metadata rules instead of route-specific code.

V679 advances that framework from architecture to extraction planning by defining the required signals, optional enrichment signals, invalid inputs, future artifacts, audit outputs, confidence inputs, failure blocks, and onboarding process that a later offline extraction prototype should follow.

## Extraction Philosophy

Future extraction should be conservative, repeatable, offline, and evidence-preserving:

- **Conservative** — absence of metadata blocks or lowers confidence; it never becomes implied certainty.
- **Repeatable** — the same extraction procedure must work for new corridors without code forks or hardcoded route logic.
- **Offline** — generated outputs remain outside runtime bundles until separately approved.
- **Evidence-preserving** — source OSM identifiers, tags, geometry hashes, extraction timestamps, and validation decisions must remain traceable.
- **County-contained** — no corridor segment should become eligible unless its county scope is known and allowed.
- **TIGER-compatible** — OSM metadata supplements directional analysis; it does not replace TIGER or county road assets.

## Corridor-Agnostic Design Requirements

A future extraction system must:

1. Accept corridor definitions as data, not code branches.
2. Normalize route references through shared rules for interstate, U.S. highway, state highway, and FM route formats.
3. Use the same schema for divided highways, rural highways, state roads, FM roads, and future corridors.
4. Separate route identity from segment membership, county containment, directional inference, confidence, and runtime eligibility.
5. Treat US 59 / I-69 as a validation example only, not as a required dependency.
6. Support multiplexes and overlapping refs without assuming a single route per way.
7. Preserve ramps, frontage roads, links, and service roads as separately classified candidates instead of mixing them with mainline inventory.
8. Default all generated artifacts to `runtimeEligible: false`.

## Required OSM Signals

The following signals are required for a future corridor segment to enter the candidate inventory:

| Signal | Purpose | Minimum expectation |
| --- | --- | --- |
| OSM object identity | Traceability | Way/relation ID and source timestamp are recorded |
| Route reference | Corridor identity | `ref`, route relation membership, or equivalent route evidence can be normalized |
| Highway classification | Road type validation | `highway` class is present and allowable for public corridor analysis |
| Geometry | Direction and continuity | Segment geometry is complete enough to calculate bearing, length, and adjacency |
| Directional context | Direction inference | `oneway`, implicit one-way class behavior, or forward/backward geometry context is present or explicitly marked unknown |
| County attribution | County containment | Spatial containment and/or OSM county evidence can be evaluated against approved county scope |
| Extraction timestamp | Auditability | Extract date and source query/version are recorded |
| Source tag snapshot | Reproducibility | Relevant OSM tags are preserved with the extracted segment |

## Optional OSM Signals

Optional signals may improve auditability and confidence but must not be required for basic candidate inventory:

| Signal | Use |
| --- | --- |
| `lanes` | Supports capacity and carriageway plausibility checks |
| `lanes:forward` / `lanes:backward` | Supports bidirectional or divided-road interpretation |
| `turn:lanes` | Helps identify intersection and turn-channel behavior |
| `destination` | Supports directional destination sanity checks |
| `destination:lanes` | Supports lane-level destination validation |
| `destination:ref` / `destination:ref:lanes` | Helps validate route continuity and signed destinations |
| `maxspeed` | Supplemental consistency check only |
| `surface` | Supplemental road classification context |
| `access`, `motor_vehicle`, `hgv` | Helps filter restricted or non-public segments |
| `bridge`, `tunnel`, `layer` | Helps audit geometry overlap and grade separation |
| Link classes such as `motorway_link` | Helps separate ramps from mainline segments |
| Route relation roles | Supplemental membership evidence |
| OSM version metadata | Drift and re-extraction audit support |

## Disallowed Signals

The future extraction process must not use:

- User-facing assumptions derived from Gridly UI labels.
- DriveTexas events while DriveTexas remains paused.
- Supabase production records as a directional source.
- TIGER geometry as a replacement target for OSM geometry.
- County road assets as proof of OSM directional membership.
- Route name text alone without corroborating route reference or relation evidence.
- Hardcoded corridor-specific if/else logic.
- Confidence promotions based only on corridor importance, traffic volume, or user demand.
- Direction labels inferred from map display orientation alone.
- Any signal requiring runtime activation or production ingestion.

## Corridor Identity Model

Corridor identity should be data-driven and normalized before extraction. A future corridor definition should include:

```json
{
  "corridorId": "normalized-corridor-id",
  "displayName": "Human-readable corridor name",
  "routeRefs": ["US 59", "I-69"],
  "allowedRefAliases": ["US-59", "US 59", "I 69", "I-69"],
  "allowedHighwayClasses": ["motorway", "trunk", "primary"],
  "countyScope": ["approved-county-name"],
  "mainlinePolicy": "mainline_only_or_mainline_plus_links",
  "runtimeEligible": false
}
```

Identity is established by normalized route references and optional route relation evidence, not by corridor-specific code. Multiplexed corridors may contain multiple refs, but each ref must remain visible in the inventory for audit.

## Corridor Membership Model

A segment belongs to a corridor candidate set only when it satisfies shared membership rules:

1. At least one normalized segment ref or relation ref matches the corridor definition.
2. The segment highway class is allowed for the corridor category.
3. Geometry intersects the planned county-contained corridor search envelope.
4. The segment is not excluded as a service road, driveway, parking aisle, unrelated local road, or unsupported access class.
5. Link/ramp segments are classified separately from mainline segments.
6. Membership confidence is recorded as `confirmed`, `probable`, `ambiguous`, or `rejected`.

Membership validation must flag frontage roads, business routes, alternate routes, route overlaps, spurs, ramps, and boundary-crossing fragments for audit instead of silently accepting them.

## County Containment Model

County containment must be evaluated before future extraction artifacts are considered usable:

- Use accepted Gridly county boundaries as the containment authority.
- Treat OSM `tiger:county` as supporting evidence, not the sole authority.
- Assign every segment one containment state: `contained`, `boundary_crossing`, `outside_scope`, or `unresolved`.
- Split or block boundary-crossing segments unless the future extraction milestone explicitly supports cross-county segmentation.
- Record county evidence, boundary method, and unresolved county conflicts in the audit output.
- Block corridors that cannot be evaluated against the approved county scope.

## Future Extraction Artifact Design

A future offline extraction prototype should generate a non-runtime artifact such as:

```json
{
  "artifactType": "osm_directional_extraction",
  "schemaVersion": "future-version",
  "runtimeEligible": false,
  "extractedAt": "ISO-8601 timestamp",
  "corridorId": "normalized-corridor-id",
  "countyScope": ["approved county"],
  "segments": [
    {
      "segmentId": "stable-derived-id",
      "osmWayId": "way id",
      "osmRelationIds": [],
      "geometryHash": "hash",
      "routeRefs": [],
      "highwayClass": "motorway",
      "oneway": "yes|no|-1|unknown",
      "bearingDegrees": null,
      "directionCandidate": "northbound|southbound|eastbound|westbound|unknown",
      "countyContainmentStatus": "contained|boundary_crossing|outside_scope|unresolved",
      "membershipStatus": "confirmed|probable|ambiguous|rejected",
      "sourceTags": {},
      "runtimeEligible": false
    }
  ]
}
```

## Future Inventory Artifact Design

The future inventory artifact should summarize the extraction without enabling runtime use:

- Corridor ID and display name.
- County scope.
- Segment counts by membership state.
- Segment counts by containment state.
- Highway class distribution.
- Oneway coverage rate.
- Optional metadata coverage rates.
- Link/ramp/mainline separation counts.
- Ambiguous or rejected segment counts.
- Audit readiness recommendation.
- `runtimeEligible: false`.

## Future Audit Artifact Design

Future extraction should produce audit outputs that include:

- Query/version metadata.
- Source OSM IDs and geometry hashes.
- Required signal completeness table.
- Optional signal coverage table.
- County containment exceptions.
- Corridor membership exceptions.
- Directional ambiguity list.
- Link/ramp classification review list.
- Multiplex and alias normalization review list.
- Diff against prior extraction, if any.
- Human audit checklist and reviewer disposition.

## Future Confidence-Model Inputs

Future confidence models may consume only offline, auditable inputs:

- Required signal completeness.
- Route reference normalization quality.
- Route relation corroboration.
- Highway classification consistency.
- Geometry continuity and bearing stability.
- Oneway and forward/backward consistency.
- County containment status.
- Optional lane and destination metadata coverage.
- Link/ramp separation quality.
- OSM drift since last extraction.
- Human audit pass/fail outcomes.

Confidence models must not consume runtime UI state, production user behavior, DriveTexas data while paused, or unsupported county data.

## Extraction Failure Conditions

A future extraction must automatically block a corridor when any of the following occur:

1. Route identity cannot be normalized.
2. Required route reference evidence is missing for a material segment set.
3. Highway classification is missing or outside the allowed class policy.
4. Geometry is incomplete, invalid, or insufficient for continuity checks.
5. County containment cannot be established.
6. Unsupported county leakage is detected.
7. Mainline and link/frontage/service roads cannot be separated.
8. Multiplex/alias handling creates conflicting corridor membership.
9. Oneway/directional context is contradictory and cannot be marked safely unknown.
10. Source tags or OSM IDs are not preserved.
11. Extraction artifacts attempt to enter runtime bundles.
12. Any protected system would need activation to complete extraction.

## Runtime Isolation Strategy

V679 requires future extraction to remain isolated through:

- Documentation and offline artifact locations only.
- No imports into `js/app.js`.
- No directional labels, legends, controls, or popups.
- No route guidance, turn guidance, or NB/SB/EB/WB display.
- No Supabase schema, table, policy, or function changes.
- No DriveTexas activation.
- No Transportation Intelligence activation.
- Explicit `runtimeEligible: false` defaults in every artifact.

## TIGER Coexistence Strategy

TIGER and county road assets remain Gridly's baseline awareness assets. Future OSM extraction may provide supplemental directional metadata for offline analysis only. It must not replace TIGER geometry, overwrite county assets, or redefine county road inventories.

## Future DriveTexas Compatibility Considerations

DriveTexas remains paused. Future compatibility work may compare audited OSM directional candidates with DriveTexas directionality only if a separate milestone unpauses and authorizes DriveTexas analysis. V679 assumes no DriveTexas dependency and no DriveTexas runtime activation.

## Risk Review

Key risks include hardcoding, OSM metadata inconsistency, extraction drift, county leakage, confidence inflation, runtime expansion, user trust erosion, DriveTexas assumptions, and maintenance burden. These risks are addressed by corridor-agnostic data definitions, offline-only artifacts, blocked-by-default confidence posture, county containment gates, and continued directional display prohibition.

## Future Roadmap

1. Create schema-only inventory design for offline OSM extraction outputs.
2. Define data-driven corridor onboarding templates.
3. Build a non-runtime extraction prototype for multiple corridor types.
4. Produce human audit packages for sampled corridors.
5. Calibrate confidence rules with required and optional signal coverage.
6. Review DriveTexas compatibility only after separate authorization.
7. Consider runtime activation only after extraction, inventory, audit, confidence, and product gates pass.

## Future Corridor Onboarding Process

Each future corridor should onboard through the same process:

1. Submit a corridor definition with normalized refs, aliases, allowed highway classes, and county scope.
2. Validate that the county scope is approved and boundary data is available.
3. Run offline extraction using shared rules.
4. Generate extraction, inventory, and audit artifacts.
5. Review membership, containment, optional metadata, and failure conditions.
6. Assign a readiness determination.
7. Keep runtime display blocked unless a later activation milestone approves it.

## Final Recommendation

Proceed to inventory design before building extraction code. V679 defines enough process structure to design future extraction and inventory artifacts, but actual extraction should remain blocked until the schema, artifact locations, audit checklist, and onboarding templates are approved.

**Final determination: EXTRACTION PLANNING READY FOR INVENTORY DESIGN.**
