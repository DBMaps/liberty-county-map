# GRIDLY V681 — OSM Directional Validation Model Design

## Mission Alignment

Gridly remains a **Know Before You Go** awareness platform.

Product order remains unchanged:

1. **Awareness Platform First** — county-aware awareness, boundary discipline, and conservative user trust remain primary.
2. **Route Intelligence Second** — directional corridor intelligence may advance only through offline evidence, validation, confidence design, audit, and separately authorized activation gates.

V681 is documentation-only. It defines how future OSM directional evidence should be evaluated, accepted, rejected, blocked, or escalated for manual review. It does not perform extraction, build inventory artifacts, create runtime logic, calculate confidence, activate directional display, or connect validation output to production systems.

## Protected Systems Verification

| Protected system | Required state | V681 verification |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Must remain unchanged |
| `historyUiEnabled` | `false` | Must remain unchanged |
| `DriveTexasPaused` | `true` | Must remain unchanged |
| `TransportationIntelligenceEnabled` | `false` | Must remain unchanged |
| `TransportationIntelligenceDisplay` | `false` | Must remain unchanged |
| `TransportationIntelligenceActivation` | `false` | Must remain unchanged |

V681 does not modify `js/app.js`, runtime configuration, Supabase, TIGER assets, county road assets, DriveTexas behavior, Transportation Intelligence behavior, route rendering, or directional UI.

## V680 Recap

V680 defined a future offline inventory design for OSM directional evidence. It separated corridor records, segment records, containment records, directional evidence records, validation records, and audit records. It established that inventory is a neutral evidence catalog, not a product surface, and that all future records remain runtime-ineligible by default.

V681 advances that architecture by defining the validation model that would consume those future inventory records and produce non-runtime validation outcomes.

## Validation Philosophy

The validation layer must decide whether directional evidence is trustworthy enough to advance toward future confidence-model design without guessing. Validation is not the confidence model itself. It is the gate that determines whether the evidence set is complete, internally consistent, county-contained, and reviewable.

Core principles:

- **Blocked by default:** absence, ambiguity, or conflict does not become a directional claim.
- **Corridor-agnostic:** rules apply to interstates, U.S. highways, state highways, farm-to-market roads, multiplexes, divided highways, undivided highways, one-way carriageways, reversible lanes, and future corridor classes.
- **Data-driven:** validation outcomes are derived from declared evidence categories, not manual per-corridor engineering.
- **County-aware:** no corridor advances unless containment is explicit and compatible with the approved county scope.
- **Evidence-preserving:** rejected, blocked, and escalated records remain auditable; validation must not delete ambiguity.
- **Runtime-isolated:** validation outputs do not enable display, routing, DriveTexas activation, or Transportation Intelligence.

## Validation Goals

The model must answer these operational questions for each future corridor and segment set:

- Is the corridor identity sufficiently supported by route reference and highway-class evidence?
- Is the segment set continuous enough to evaluate as a corridor candidate?
- Is county containment known, approved, and free of unresolved boundary leakage?
- Is directional evidence present, consistent, and appropriate for the corridor type?
- Are conflicting signals resolvable by rule, or do they require manual review?
- Should the evidence be accepted, rejected, blocked, or escalated?
- What non-runtime output should be recorded for future audit and confidence-model consumption?

## Evidence Taxonomy

| Evidence category | Description | Validation role | Default classification |
| --- | --- | --- | --- |
| Route references | Normalized route refs, relation refs, alternate refs, and multiplex refs | Establishes corridor identity | Required |
| Highway classification | OSM `highway` class and normalized corridor class compatibility | Confirms candidate road class and filters excluded ways | Required |
| Oneway metadata | `oneway`, implied one-way class, directional way orientation, and `-1` handling | Primary directional evidence for divided and one-way carriageways | Required when directionality is asserted |
| Geometry continuity | Segment adjacency, ordered chain consistency, gaps, duplicate geometry, and orientation continuity | Confirms corridor shape is coherent enough to evaluate | Required |
| County containment evidence | Spatial containment against approved county boundary artifacts and boundary-crossing status | Determines county eligibility and blocking status | Required |
| Carriageway separation | Parallel one-way ways, median-separated pairs, dual carriageways, and role grouping | Supports divided-corridor interpretation | Optional but required when a divided-corridor claim is made |
| Lane metadata | `lanes`, `lanes:forward`, `lanes:backward`, turn lanes, bus/HOV context | Enriches directionality and reversible-lane review | Optional; insufficient alone |
| Destination metadata | `destination`, `destination:ref`, `destination:forward`, `destination:backward` | Supports direction plausibility and ramp/link review | Optional; insufficient alone |
| Relation membership | OSM route relations, member roles, ref consistency | Supports identity and continuity | Optional unless configured as required for a future class |
| Access/restriction metadata | Access, vehicle restrictions, construction, service, private, emergency, toll, and time-based restrictions | Blocks or escalates unsuitable segments | Optional; blocking when restrictive or inconsistent |
| Reversible-lane metadata | `change:lanes`, time-dependent direction, managed-lane indicators | Identifies non-static directionality | Disallowed for automatic acceptance; manual review required |
| Human notes only | Free-text comments without structured evidence | Audit context only | Insufficient |

## Required Evidence Definitions

A validation candidate must have all required evidence before it can be accepted:

1. **Corridor identity evidence** — at least one normalized route reference must match the configured corridor identity or approved alias set. Multiplex corridors must preserve all relevant refs instead of collapsing them into one name.
2. **Highway-class compatibility** — each evaluated segment must have a class compatible with the configured corridor class and segment role. Excluded service roads, private roads, unrelated ramps, or unsupported classes cannot be accepted as mainline.
3. **Geometry continuity evidence** — accepted corridor candidates must form an evaluable chain, pair, or network pattern with declared gaps, splits, and branch handling.
4. **County containment evidence** — every evaluated segment must have containment status against approved county scope.
5. **Directional basis evidence** — if the validation candidate proposes directional interpretation, it must include oneway metadata, explicit bidirectional status, or documented non-static directionality status.
6. **Provenance evidence** — source identifiers, extraction batch identity, geometry hash, tag snapshot reference, and validation timestamp must be recordable.

## Optional Evidence Definitions

Optional evidence can strengthen future confidence evaluation but cannot replace required evidence:

- Route relation membership and relation member roles.
- Carriageway separation indicators for divided corridors.
- Directional lane counts and lane-role metadata.
- Destination and destination-ref tags.
- Bearing summaries and geometry-derived cardinal candidates.
- Access restriction context that does not conflict with public corridor evaluation.
- Reviewer notes that clarify ambiguity without overriding structured evidence.

## Insufficient Evidence Definitions

These evidence types are insufficient by themselves:

- Geometry bearing without route reference and oneway evidence.
- Lane metadata without route identity and continuity.
- Destination tags without route identity and oneway or bidirectional status.
- Relation membership without segment-level ref and highway-class compatibility.
- Human notes without structured OSM evidence.
- County-name tags without spatial containment evidence.
- A single isolated segment for a corridor candidate unless explicitly configured as a valid isolated facility class.

## Disallowed Evidence Definitions

The following must not be used to automatically accept a directional corridor:

- Assumptions from corridor name alone.
- Manual hardcoded northbound, southbound, eastbound, or westbound declarations.
- County-specific or corridor-specific exception rules embedded in validation logic.
- Runtime traffic data, DriveTexas status, or Transportation Intelligence state.
- TIGER geometry as a replacement for OSM directional evidence.
- Free-text map notes that contradict structured evidence without review.
- Time-dependent reversible-lane interpretation without a separate review and activation process.

## Validation Workflow

1. **Input eligibility check:** confirm the candidate comes from a future offline inventory artifact and is not a runtime feed.
2. **Schema completeness check:** verify required corridor, segment, containment, directional evidence, and audit fields are present.
3. **Corridor identity validation:** evaluate route refs, aliases, highway class, relation evidence, and multiplex handling.
4. **Segment role validation:** classify mainline, link, ramp, frontage, service, excluded, or future roles using data-driven policies.
5. **County containment validation:** test every segment against approved county scope and boundary-crossing policy.
6. **Continuity validation:** detect gaps, disconnected branches, duplicate members, reversed geometry, and unsupported loops.
7. **Directional evidence validation:** evaluate oneway, bidirectional, divided-pair, carriageway, lane, destination, and reversible-lane evidence.
8. **Conflict resolution:** apply deterministic conflict rules; escalate unresolved material conflicts.
9. **Outcome assignment:** produce accepted, rejected, blocked, or manual-review-required status.
10. **Output recording:** write non-runtime validation records for audit and future confidence-model consumption.

## Acceptance Conditions

A candidate may be marked `accepted_for_confidence_model_input` only when all conditions are met:

- Required evidence is present and parseable.
- Route refs and highway class are compatible with configured corridor identity.
- Geometry continuity is sufficient for the configured corridor type and segment role.
- County containment is `contained` or an explicitly allowed `boundary_crossing` with split/continuity policy recorded.
- Directional basis is explicit: one-way, bidirectional, divided-pair, or declared non-static/manual-review exclusion.
- No blocking condition is present.
- No unresolved material conflict remains.
- Validation provenance is recordable.

Acceptance does not mean display-ready. It means the evidence may advance to a future confidence-model design or offline validation prototype.

## Rejection Conditions

A candidate should be rejected when evidence is evaluated and found incompatible, but the problem is not a system-level blocker:

- Route refs do not match the configured corridor identity or approved aliases.
- Highway class is incompatible with the corridor class or segment role.
- Segment is unrelated frontage, service, private, construction-only, or excluded by policy.
- Geometry is an isolated or disconnected fragment that cannot support the corridor candidate.
- Oneway metadata contradicts the proposed directional interpretation and the contradiction is local and explainable.
- Duplicate, stale, or superseded inventory records are present and newer records replace them.

Rejected records remain auditable and may be reconsidered after future extraction or metadata correction.

## Blocking Conditions

A corridor or corridor segment set must be blocked when validation cannot safely proceed:

- County containment is `outside_scope` or `unresolved` for any required mainline segment.
- Required evidence is missing for corridor identity, highway class, continuity, containment, or directional basis.
- Conflicting route refs create ambiguous corridor identity for required mainline segments.
- Directional metadata conflicts across a divided carriageway pair in a way that cannot be resolved deterministically.
- Reversible, time-dependent, managed-lane, or contraflow evidence would require dynamic interpretation.
- Geometry continuity contains material gaps, unexplained branch swaps, or unsupported topology.
- Source provenance or geometry hash is missing.
- Any validation output would imply runtime activation, display enablement, TIGER replacement, DriveTexas activation, or Transportation Intelligence activation.

Blocked candidates do not advance to confidence scoring.

## Manual Review Conditions

Manual review is required when evidence is present but not safely decidable by rule:

- Multiplex refs are valid individually but their shared geometry or split points are ambiguous.
- A boundary crossing is valid regionally but requires county split decisions.
- Oneway and lane metadata disagree, but geometry suggests a possible data-entry issue.
- Destination tags conflict with route orientation or cardinal bearing.
- Relation membership is incomplete while segment refs and geometry appear plausible.
- Reversible-lane, HOV, managed-lane, or temporary construction evidence appears.
- Future corridor classes introduce unsupported roles or tags.
- A reviewer must decide whether a gap is a true discontinuity or a harmless extraction artifact.

Manual review may produce `accepted_after_review`, `rejected_after_review`, or `blocked_after_review`, but those remain non-runtime outcomes.

## County Containment Requirements

County containment is a validation gate, not an enrichment detail.

Required rules:

- Every segment must have a spatial containment result against approved county boundary artifacts.
- County-name tags may support audit context but cannot replace spatial containment.
- `contained` segments may proceed if other required evidence passes.
- `boundary_crossing` segments may proceed only when the corridor policy allows cross-county continuity and the split/ownership decision is recorded.
- `outside_scope` required mainline segments block the county-scoped candidate.
- `unresolved` containment blocks validation until resolved.
- Cross-county corridors must preserve per-county validation outcomes instead of converting regional continuity into local eligibility.

## Conflict-Resolution Model

Conflicts must be handled in this order:

1. **Source integrity conflicts:** missing provenance, stale hashes, or malformed records block validation.
2. **Containment conflicts:** county scope conflicts block before directional interpretation.
3. **Identity conflicts:** route-ref and highway-class conflicts reject or escalate before direction is evaluated.
4. **Topology conflicts:** continuity, branch, duplicate, and geometry-order conflicts block or escalate.
5. **Directional conflicts:** oneway, carriageway, lane, destination, and bearing conflicts are resolved only after identity and topology pass.
6. **Enrichment conflicts:** optional metadata conflicts can reduce future confidence or trigger manual review but cannot override required evidence.

Deterministic rules may reject clearly incompatible records. Material contradictions between required evidence categories must be blocked or escalated; they must not be averaged into confidence.

## Validation Output Design

Future validation records should use a non-runtime envelope similar to:

```json
{
  "artifactType": "osm_directional_validation_result",
  "schemaVersion": "future-version",
  "milestone": "future-offline-milestone",
  "runtimeEligible": false,
  "corridorId": "stable-corridor-id",
  "countyScope": ["approved-county"],
  "validationStatus": "accepted_for_confidence_model_input | rejected | blocked | manual_review_required",
  "requiredEvidenceStatus": {
    "routeReferences": "pass | fail | missing | conflict",
    "highwayClassification": "pass | fail | missing | conflict",
    "geometryContinuity": "pass | fail | missing | conflict",
    "countyContainment": "pass | fail | missing | conflict",
    "directionalBasis": "pass | fail | missing | conflict",
    "provenance": "pass | fail | missing | conflict"
  },
  "optionalEvidencePresent": [],
  "insufficientEvidenceObserved": [],
  "blockingReasons": [],
  "manualReviewReasons": [],
  "rejectionReasons": [],
  "conflicts": [],
  "reviewDecision": null,
  "confidenceModelInputEligible": false,
  "directionalDisplayEligible": false
}
```

Validation outputs should be immutable per batch, traceable to source inventory records, and explicitly marked not runtime eligible.

## Confidence-Model Integration Points

A future confidence model may consume only accepted validation outputs. It should receive:

- Required evidence pass/fail state.
- Optional evidence presence and quality flags.
- Conflict history and resolved-review status.
- County containment status.
- Segment role and corridor class context.
- Blocking and rejection absence.
- Provenance and drift indicators.

The confidence model must not consume blocked records, unresolved manual-review records, or rejected records as positive evidence. Confidence scoring remains a future design milestone and is not implemented by V681.

## Runtime Isolation Strategy

V681 validation outputs must remain offline and non-runtime:

- No modification to `js/app.js`.
- No production ingestion path.
- No UI display path.
- No NB/SB/EB/WB surface.
- No runtime flags changed.
- No Supabase schema or query changes.
- No DriveTexas activation.
- No Transportation Intelligence activation.
- No county road asset or TIGER replacement.

Any future runtime connection requires a separate milestone, separate risk review, explicit protected-system verification, and user-facing activation authorization.

## TIGER Coexistence Strategy

TIGER and county road assets remain the current production road-context foundation. OSM validation may eventually provide directional evidence, but it must not replace TIGER assets by implication.

Coexistence rules:

- OSM directional evidence is evaluated as supplemental offline evidence.
- TIGER geometry may support contextual comparison but cannot satisfy OSM directional required evidence.
- County road assets remain unchanged.
- Any future TIGER/OSM reconciliation must be separately designed, reviewed, and approved.

## Future DriveTexas Compatibility Considerations

DriveTexas remains paused. V681 does not activate, query, infer, or display DriveTexas data.

Future compatibility should treat DriveTexas as a separate operational condition source, not as route-direction evidence. A future integration may compare validated OSM directionality against external incident location semantics only after OSM validation, confidence modeling, runtime governance, and activation authorization are complete.

## Risk Review

Key risks include false directional confidence, inconsistent OSM metadata, county boundary leakage, validation drift, manual-review burden, and user trust erosion if directional claims appear prematurely. These risks require validation to remain blocked by default and display-blocked until future milestones prove evidence quality, confidence design, and runtime safety.

## Future Roadmap

Recommended future sequence:

1. V682 or later: define confidence-model design inputs and scoring boundaries using V681 validation outputs.
2. Offline validation prototype: run the model against controlled inventory samples without production linkage.
3. Reviewer workflow design: define reviewer roles, decisions, and audit trails.
4. Drift monitoring design: compare future extraction batches and preserve validation history.
5. Runtime readiness gate: only after accepted validation, confidence thresholds, audit, and protected-system review.
6. Directional display design: separate UI/UX milestone with explicit activation authorization.

## Final Recommendation

V681 should be adopted as the documentation-only validation model design for future OSM directional evidence. The model is corridor-agnostic, county-aware, blocked by default, and scalable across corridor classes. Directional display should remain blocked.

**Final determination:** `VALIDATION MODEL READY FOR CONFIDENCE MODEL DESIGN`.
