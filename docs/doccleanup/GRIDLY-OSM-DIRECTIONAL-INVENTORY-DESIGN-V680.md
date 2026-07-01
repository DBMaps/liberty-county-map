# GRIDLY V680 — OSM Directional Inventory Design

## Mission Alignment

Gridly remains a **Know Before You Go** awareness platform.

Product order remains unchanged:

1. **Awareness Platform First** — county-aware situational awareness remains the primary responsibility.
2. **Route Intelligence Second** — directional corridor intelligence may advance only through offline inventory, validation, audit, confidence, and activation gates.

V680 is documentation-only. It defines what future inventory artifacts should exist for OSM directional intelligence. It does not extract OSM data, generate runtime assets, create confidence logic, or enable directional display.

## Protected Systems Verification

| Protected system | Required state | V680 verification |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Must remain unchanged |
| `historyUiEnabled` | `false` | Must remain unchanged |
| `DriveTexasPaused` | `true` | Must remain unchanged |
| `TransportationIntelligenceEnabled` | `false` | Must remain unchanged |
| `TransportationIntelligenceDisplay` | `false` | Must remain unchanged |
| `TransportationIntelligenceActivation` | `false` | Must remain unchanged |

V680 does not modify `js/app.js`, runtime configuration, Supabase, TIGER assets, county road assets, DriveTexas behavior, Transportation Intelligence behavior, or directional UI.

## V679 Recap

V679 defined how a future offline OSM directional extraction process should acquire, normalize, validate, and preserve corridor evidence. It established that extraction must be conservative, repeatable, offline, evidence-preserving, county-contained, and TIGER-compatible. It also defined required OSM signals, optional enrichment signals, invalid signals, corridor identity expectations, county containment expectations, future extraction artifacts, future audit artifacts, and future confidence-model inputs.

V680 advances that planning into an inventory design package. It answers what records and artifacts must exist after future extraction but before confidence scoring, runtime ingestion, or display activation.

## Inventory Philosophy

The inventory layer should be a neutral evidence catalog, not a product surface. It should store enough structured information to support future validation, audit, confidence modeling, and activation decisions without becoming a runtime dependency.

Core principles:

- **Corridor-agnostic:** the same record types support interstates, U.S. highways, state highways, FM roads, multiplexes, divided highways, one-way carriageways, and future corridor classes.
- **County-contained:** every usable segment must have explicit county containment status.
- **Evidence-first:** inventory records preserve source facts and unresolved ambiguity instead of converting uncertainty into display claims.
- **Blocked by default:** records do not imply runtime eligibility or directional display readiness.
- **Composable:** corridor, segment, containment, directional evidence, validation, and audit records are separable so new counties and corridors can be added without redesign.
- **TIGER coexistence:** OSM inventory may support future directional intelligence but does not replace TIGER or county road assets.

## Inventory Goals

The V680 inventory design must support:

- Dozens of counties and hundreds of corridors.
- Cross-county corridor continuity without losing county containment.
- Multiple route references and multiplexes.
- Mainline, link, frontage, ramp, service, and excluded segment classification.
- One-way carriageway metadata and bidirectional uncertainty.
- Directional metadata, lane metadata, and destination metadata.
- Future validation and confidence-model inputs.
- Human audit review, drift review, and maintenance ownership.
- Strict isolation from production systems until a separate activation milestone.

## Inventory Architecture

The inventory should be organized as a documentation-defined, future offline artifact family:

| Artifact type | Purpose | Runtime eligible by default |
| --- | --- | --- |
| Corridor inventory | Defines corridor identity, class, refs, aliases, county scope, and lifecycle state | `false` |
| Segment inventory | Catalogs extracted candidate segments and normalized segment-level metadata | `false` |
| Containment inventory | Records county containment, boundary conditions, and cross-county continuity | `false` |
| Directional evidence inventory | Preserves oneway, bearing, lane, destination, and relation evidence used by future models | `false` |
| Validation inventory | Records completeness checks, reviewer outcomes, unresolved issues, and blocking status | `false` |
| Audit inventory | Records provenance, extraction batch metadata, drift, changes, reviewers, and decisions | `false` |

Recommended future artifact envelope:

```json
{
  "artifactType": "osm_directional_inventory",
  "schemaVersion": "future-version",
  "milestone": "future-offline-milestone",
  "runtimeEligible": false,
  "generatedAt": "ISO-8601 timestamp",
  "corridors": [],
  "segments": [],
  "containmentRecords": [],
  "directionalEvidenceRecords": [],
  "validationRecords": [],
  "auditRecords": []
}
```

## Corridor Record Design

A corridor-level record defines identity and scope. It should not contain display-ready directional claims.

### Required corridor fields

| Field | Purpose |
| --- | --- |
| `corridorId` | Stable normalized identifier, independent of county and source IDs |
| `corridorClass` | `interstate`, `us_highway`, `state_highway`, `farm_to_market`, `multiplex`, `regional`, or future class |
| `displayName` | Human-readable corridor name for audit documents |
| `routeRefs` | Normalized route references such as `I-69`, `US 59`, `SH 105`, or `FM 1960` |
| `allowedRefAliases` | Accepted aliases for normalization review |
| `countyScope` | Approved counties where inventory may be evaluated |
| `continuityPolicy` | Expected behavior for cross-county continuity and boundary splits |
| `mainlinePolicy` | Whether mainline only, mainline plus links, or separately classified links are allowed |
| `inventoryState` | Lifecycle state from the V680 state model |
| `runtimeEligible` | Always `false` for V680-style inventory artifacts |

### Optional corridor fields

| Field | Purpose |
| --- | --- |
| `osmRelationIds` | Route relation evidence when available |
| `priorityTier` | Planning priority only; must not affect confidence |
| `maintenanceOwner` | Team or role responsible for future review |
| `reviewCadence` | Suggested revalidation interval |
| `notes` | Human audit context |
| `exampleCorridors` | Non-binding examples; US 59 / I-69 may appear here only as an example |

## Segment Record Design

A segment-level record catalogs candidate road pieces associated with corridor inventory.

### Required segment fields

| Field | Purpose |
| --- | --- |
| `segmentId` | Stable derived identifier |
| `corridorId` | Parent corridor reference |
| `sourceType` | Expected to identify OSM way, relation member, or future supported source |
| `osmWayId` | OSM way identifier when the source is an OSM way |
| `geometryHash` | Drift and reproducibility check |
| `routeRefs` | Normalized segment refs |
| `highwayClass` | OSM highway class or normalized future class |
| `segmentRole` | `mainline`, `link`, `ramp`, `frontage`, `service`, `excluded`, or future role |
| `oneway` | `yes`, `no`, `-1`, `implicit`, or `unknown` |
| `membershipStatus` | `confirmed`, `probable`, `ambiguous`, or `rejected` |
| `countyContainmentStatus` | Linked containment status |
| `runtimeEligible` | Always `false` until separate activation |

### Optional segment fields

| Field | Purpose |
| --- | --- |
| `osmRelationIds` | Relation evidence |
| `bearingDegrees` | Geometry-derived bearing for future direction checks |
| `lengthMeters` | Segment length for continuity and coverage review |
| `laneCount` | Parsed lane metadata |
| `lanesForward` | Direction-specific lane evidence |
| `lanesBackward` | Direction-specific lane evidence |
| `destinationTags` | Destination and destination-ref evidence |
| `accessTags` | Public access and restriction context |
| `bridgeTunnelLayer` | Grade-separation review context |
| `sourceTagsSnapshot` | Evidence preservation |

## Containment Record Design

Containment records separate county eligibility from route identity.

### Required containment fields

| Field | Purpose |
| --- | --- |
| `containmentId` | Stable containment record identifier |
| `segmentId` | Segment being evaluated |
| `corridorId` | Corridor being evaluated |
| `countyScope` | Approved county or counties for evaluation |
| `containmentStatus` | `contained`, `boundary_crossing`, `outside_scope`, or `unresolved` |
| `boundaryMethod` | Spatial boundary, accepted county boundary artifact, or future method |
| `blockingStatus` | Whether containment blocks corridor progression |
| `runtimeEligible` | Always `false` |

### Optional containment fields

| Field | Purpose |
| --- | --- |
| `matchedCountyNames` | Counties intersected by segment geometry |
| `boundaryCrossingPoints` | Non-runtime geometry summary for audit |
| `osmCountyTags` | Supporting OSM county evidence only |
| `splitRecommendation` | Whether future extraction should split at boundary |
| `containmentNotes` | Reviewer context |

## Directional Evidence Record Design

Directional evidence records preserve facts for future validation and confidence models. They do not decide display direction.

### Required directional evidence fields

| Field | Purpose |
| --- | --- |
| `evidenceId` | Stable evidence record identifier |
| `segmentId` | Segment being evaluated |
| `corridorId` | Parent corridor reference |
| `directionalSourceTypes` | Evidence categories present: oneway, bearing, relation, lanes, destination, etc. |
| `onewayValue` | Raw or normalized oneway value |
| `directionCandidate` | `northbound`, `southbound`, `eastbound`, `westbound`, `bidirectional`, or `unknown` candidate only |
| `evidenceCompleteness` | Required evidence completeness category for future models |
| `ambiguityStatus` | `none`, `minor`, `material`, or `blocking` |
| `runtimeEligible` | Always `false` |

### Optional directional evidence fields

| Field | Purpose |
| --- | --- |
| `bearingDegrees` | Geometry bearing candidate |
| `cardinalAxis` | North-south, east-west, diagonal, or unknown axis |
| `lanesForward` | Lane-direction evidence |
| `lanesBackward` | Lane-direction evidence |
| `turnLanes` | Intersection/turn metadata |
| `destination` | Destination text evidence |
| `destinationRef` | Destination route evidence |
| `relationRole` | OSM relation role evidence |
| `opposingCarriagewaySegmentId` | Linkage for divided highways when known |
| `evidenceNotes` | Human context |

## Validation Record Design

Validation records document machine and human review readiness without creating confidence logic.

### Required validation fields

| Field | Purpose |
| --- | --- |
| `validationId` | Stable validation record identifier |
| `corridorId` | Corridor under validation |
| `validationScope` | Corridor-level, segment-level, containment-level, or evidence-level validation |
| `requiredFieldStatus` | Complete, incomplete, or blocked |
| `containmentValidationStatus` | Complete, unresolved, blocked, or not applicable |
| `directionalEvidenceStatus` | Complete, partial, ambiguous, or blocked |
| `blockingIssues` | List of blocking issue codes |
| `reviewDisposition` | `not_reviewed`, `needs_review`, `accepted_for_next_stage`, or `blocked` |
| `runtimeEligible` | Always `false` |

### Optional validation fields

| Field | Purpose |
| --- | --- |
| `reviewer` | Human reviewer or role |
| `reviewedAt` | Review timestamp |
| `sampleMethod` | Sampling method for manual audit |
| `exceptionCount` | Count of unresolved exceptions |
| `validationNotes` | Human context |

## Audit Record Design

Audit records preserve provenance and change history.

### Required audit fields

| Field | Purpose |
| --- | --- |
| `auditId` | Stable audit identifier |
| `artifactType` | Corridor, segment, containment, evidence, validation, or whole inventory |
| `artifactId` | Record or artifact being audited |
| `sourceTimestamp` | Source data timestamp or extract timestamp |
| `schemaVersion` | Inventory schema version |
| `changeType` | Created, updated, drift_detected, reviewed, blocked, or retired |
| `changeSummary` | Human-readable change summary |
| `runtimeEligible` | Always `false` |

### Optional audit fields

| Field | Purpose |
| --- | --- |
| `previousArtifactHash` | Drift comparison |
| `currentArtifactHash` | Drift comparison |
| `sourceQueryVersion` | Extraction query provenance |
| `reviewer` | Human reviewer |
| `decisionRationale` | Human decision context |
| `linkedIssueIds` | References to tracking issues |

## Inventory Lifecycle States

| State | Meaning |
| --- | --- |
| `not_started` | Corridor has no inventory artifact |
| `defined` | Corridor record exists but no segment records are attached |
| `inventoried_offline` | Future offline extraction populated records, still non-runtime |
| `needs_validation` | Inventory exists but validation records are incomplete |
| `validation_blocked` | Required validation or containment issues block progression |
| `audit_ready` | Inventory is ready for human audit review |
| `audit_blocked` | Human or drift audit blocks progression |
| `confidence_model_ready` | Inventory exposes enough inputs for a future confidence-model design milestone |
| `retired` | Corridor or inventory version is superseded or no longer maintained |

No V680 state enables runtime behavior.

## Required Fields

At minimum, future inventory must require:

- Stable IDs for corridors, segments, containment records, directional evidence records, validation records, and audit records.
- Corridor class, normalized route refs, aliases, county scope, continuity policy, mainline policy, inventory state, and `runtimeEligible: false`.
- Segment source identity, OSM way identity when applicable, geometry hash, route refs, highway class, segment role, oneway value, membership status, containment status, and `runtimeEligible: false`.
- Containment status, boundary method, blocking status, and county scope.
- Directional evidence source categories, oneway value, direction candidate, evidence completeness, and ambiguity status.
- Validation scope, required-field status, containment validation status, directional evidence status, blocking issues, and review disposition.
- Audit source timestamp, schema version, change type, and change summary.

## Optional Fields

Optional fields should enrich future review but never bypass required gates:

- OSM relation IDs and relation roles.
- Bearing, cardinal axis, length, opposing carriageway linkage, and boundary crossing summaries.
- Lane, turn-lane, destination, destination-ref, access, bridge, tunnel, and layer tags.
- Maintenance owner, review cadence, reviewer, reviewed timestamp, sample method, exception count, issue links, and rationale.
- Previous/current artifact hashes and source query version.

## Blocking Conditions

A corridor must be automatically blocked from advancing when any of the following conditions exist:

1. Missing or non-unique `corridorId`.
2. Missing normalized route refs.
3. Unsupported corridor class without an approved future class definition.
4. Empty or unapproved county scope.
5. Any required record type is absent for an inventoried corridor.
6. Segment records lack source identity, geometry hash, highway class, route refs, or membership status.
7. Containment status is `outside_scope` or `unresolved` for required mainline segments.
8. Boundary-crossing segments lack split or continuity policy.
9. Directional evidence has `blocking` ambiguity for required mainline segments.
10. Multiplex route refs cannot be separated or audited.
11. Mainline/link/frontage/service classification is unresolved for material segment counts.
12. Required validation records are incomplete or marked blocked.
13. Audit provenance is missing source timestamp, schema version, or change summary.
14. Any artifact has `runtimeEligible: true` before a separate activation milestone.
15. Inventory depends on DriveTexas while DriveTexas remains paused.
16. Inventory recommends TIGER replacement or modifies county road assets.
17. Inventory requires `js/app.js`, Supabase, runtime ingestion, or directional UI changes.

## Confidence-Model Integration Points

V680 does not create confidence logic. It defines inputs a future confidence-model design could consume:

- Required-field completeness by corridor and segment.
- County containment status and boundary exception counts.
- Route reference normalization quality and alias ambiguity.
- OSM relation corroboration presence.
- Mainline/link/frontage/ramp classification consistency.
- Oneway coverage and ambiguity distribution.
- Bearing and carriageway consistency.
- Lane metadata coverage and directional lane consistency.
- Destination metadata coverage and route-reference consistency.
- Drift history, source timestamp age, and re-extraction change rate.
- Human validation disposition and audit exceptions.

Future confidence models must treat these as evidence inputs, not display authorization.

## Runtime Isolation Strategy

Inventory artifacts must remain outside runtime bundles until a separate milestone explicitly authorizes activation. Required isolation controls:

- No `js/app.js` changes.
- No production ingestion.
- No Supabase writes.
- No directional UI, NB/SB/EB/WB display, or routing display.
- No DriveTexas activation.
- No Transportation Intelligence activation.
- Every future inventory artifact defaults to `runtimeEligible: false`.
- Inventory review occurs through offline documents and offline artifacts only.

## TIGER Coexistence Strategy

OSM directional inventory should coexist with TIGER and county road assets by design:

- TIGER remains the existing road geometry baseline unless separately changed by another approved milestone.
- OSM inventory is an evidence layer for future directional metadata, not a replacement geometry source.
- County road assets remain unchanged.
- Disagreements between TIGER, county assets, and OSM are audit issues, not automatic replacement instructions.
- Any future TIGER replacement proposal must be separate from V680 inventory design.

## Future DriveTexas Compatibility Considerations

DriveTexas remains paused. V680 creates no DriveTexas dependency. Future compatibility may evaluate whether DriveTexas events can reference inventory corridor IDs, county containment, or segment identifiers, but only after a separate milestone authorizes DriveTexas analysis and preserves protected states.

Compatibility considerations for later work:

- Keep corridor IDs stable enough for possible future event correlation.
- Keep county containment explicit so future events cannot leak into unsupported counties.
- Avoid assuming DriveTexas provides directional certainty.
- Treat DriveTexas as an event source candidate, not an inventory authority.

## Risk Review

Primary risks are inventory bloat, hardcoding, county containment gaps, metadata inconsistency, confidence inflation, runtime expansion, user trust loss, DriveTexas assumptions, and maintenance burden. The companion V680 risk review recommends keeping directional display blocked.

## Future Roadmap

Recommended next milestones:

1. Offline validation model design using V680 record types.
2. Offline inventory prototype for a limited, non-runtime sample corridor set.
3. Human audit checklist and review workflow.
4. Confidence-model design using inventory inputs only.
5. Drift and maintenance cadence design.
6. Activation-readiness review only after inventory, validation, audit, and confidence milestones are complete.

## Final Recommendation

V680 should be accepted as a documentation-only inventory design. The inventory architecture is scalable, corridor-agnostic, county-contained, and suitable for future offline validation-model design. It is not ready for runtime ingestion, directional display, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, or production use.

**Final determination: INVENTORY DESIGN READY FOR VALIDATION MODEL DESIGN.**
