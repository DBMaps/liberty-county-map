# GRIDLY V682 — OSM Directional Confidence Model Design

## Mission Alignment

Gridly remains a **Know Before You Go** awareness platform.

Product order remains unchanged:

1. **Awareness Platform First** — county-scoped awareness, conservative interpretation, and user trust remain primary.
2. **Route Intelligence Second** — directional corridor intelligence may advance only through offline evidence inventory, validation, confidence design, review, and separately authorized activation gates.

V682 is documentation-only. It defines how future validated directional evidence would progress into confidence states. It does not perform extraction, build inventory artifacts, create runtime logic, calculate production confidence, enable directional display, connect DriveTexas, activate Transportation Intelligence, replace TIGER assets, modify county road assets, modify Supabase, add counties, or modify `js/app.js`.

## Protected Systems Verification

| Protected system | Required state | V682 verification |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Must remain unchanged |
| `historyUiEnabled` | `false` | Must remain unchanged |
| `DriveTexasPaused` | `true` | Must remain unchanged |
| `TransportationIntelligenceEnabled` | `false` | Must remain unchanged |
| `TransportationIntelligenceDisplay` | `false` | Must remain unchanged |
| `TransportationIntelligenceActivation` | `false` | Must remain unchanged |

V682 creates design documents only. Runtime files, feature flags, production data feeds, DriveTexas paths, Transportation Intelligence paths, TIGER assets, county assets, and directional UI remain untouched.

## V681 Recap

V681 defined the offline validation model for OSM directional evidence. It established required evidence categories, optional evidence, insufficient evidence, disallowed evidence, acceptance conditions, rejection conditions, blocking conditions, manual review conditions, county containment requirements, and non-runtime validation outputs.

V681's key output was `accepted_for_confidence_model_input`, which means evidence is validated enough to be considered by a future confidence model. It did not mean direction is display-ready, production-ready, or trusted by users.

V682 begins after V681 validation. The confidence model consumes only validated evidence records and decides whether the combined evidence is strong, weak, conflicting, stale, blocked, or review-dependent.

## Confidence Philosophy

The confidence model must be conservative, data-driven, corridor-agnostic, county-aware, and blocked by default.

Core principles:

- **No bearing-only confidence:** Gridly must never claim directional confidence based solely on line bearing. Bearing-only evidence is always insufficient.
- **Multiple independent signals required:** directional confidence requires agreement across independently validated evidence categories.
- **Validation before confidence:** confidence cannot repair missing validation, missing provenance, unresolved containment, or blocked evidence.
- **Conflict lowers trust:** conflicts are not averaged away; material conflicts reduce, block, or require review.
- **County scope matters:** confidence is evaluated per approved county scope and cannot be inherited blindly from a regional corridor.
- **Runtime isolation:** confidence outputs remain offline design artifacts until a future activation gate explicitly authorizes consumption.
- **Scale without exceptions:** the model must work for dozens of counties, hundreds of corridors, interstates, U.S. highways, state highways, FM roads, multiplexes, divided facilities, undivided facilities, one-way carriageways, reversible lanes, and future corridor classes without corridor-specific rules.

## Confidence Goals

The confidence model must answer:

- Which validated evidence combinations establish high directional confidence?
- Which validated evidence combinations support only tentative or limited confidence?
- Which evidence gaps, conflicts, or containment problems reduce confidence?
- Which conditions block confidence regardless of other evidence?
- Which states are eligible for future directional consideration?
- Which states require manual review?
- What outputs should be available to future offline prototypes and future runtime systems?
- What conditions permanently block directional confidence until upstream data changes?

## Confidence-State Definitions

| State | Meaning | Future directional consideration | Manual review requirement |
| --- | --- | --- | --- |
| `blocked` | Required validation, containment, provenance, or safety criteria fail | Not eligible | Required only if unblocking is possible |
| `insufficient_evidence` | Evidence is valid but too thin to support confidence | Not eligible | Optional, depending on strategic value |
| `low_confidence` | Multiple signals exist but are weak, incomplete, stale, or partially inconsistent | Not display-eligible; may inform offline review | Usually required before advancement |
| `moderate_confidence` | Primary evidence is present and supporting evidence mostly agrees, but material limitations remain | Eligible for offline prototype evaluation only | Required before runtime consideration |
| `high_confidence` | Multiple independent primary and supporting signals agree, containment is clean, and drift is controlled | Eligible for future directional consideration after separate gates | Spot review recommended for new corridor classes |
| `manual_review_required` | Evidence cannot be safely classified by rule | Not eligible until reviewed | Required |
| `confidence_expired` | Previously confident evidence drifted beyond freshness or change thresholds | Not eligible until revalidated | Required if still strategically needed |
| `permanently_blocked` | Direction cannot be represented safely as static directional confidence | Not eligible | Review can document rationale but cannot auto-unblock |

No state enables runtime display, routing, DriveTexas activation, Transportation Intelligence activation, or TIGER replacement by itself.

## Confidence Input Taxonomy

| Input signal | Confidence role | Notes |
| --- | --- | --- |
| Route references | Primary | Confirms corridor identity and multiplex membership |
| Highway classification | Primary | Confirms corridor class and segment eligibility |
| Validated oneway metadata | Primary | Establishes explicit directionality for one-way or divided carriageways |
| Validated geometry continuity | Primary | Confirms segment ordering, adjacency, and topology are evaluable |
| Validated county containment | Primary gate | Determines county eligibility and scope |
| Validated carriageway separation | Supporting for divided highways; primary when the confidence claim depends on divided-pair interpretation | Supports directional pairing and parallel carriageway logic |
| Validated lane metadata | Supporting | Supports directional lane allocation but cannot establish direction alone |
| Validated destination metadata | Supporting | Supports plausibility for links, ramps, and directional signs |
| Relation membership | Supporting | Supports route identity and continuity where relation quality is strong |
| Access and restriction metadata | Supporting or blocking | Can reduce or block confidence when inconsistent with public corridor use |
| Geometry bearing | Supplemental only | Never sufficient by itself and never a primary signal |
| Reviewer notes | Supplemental | May explain but cannot override structured evidence without audit status |
| Historical confidence result | Supplemental | Useful for drift comparison, not proof of current confidence |

## Primary Evidence Definitions

Primary evidence is independently strong enough to anchor a confidence claim when combined with other primary or supporting evidence:

1. **Validated route reference alignment** — segment refs, relation refs, and multiplex refs match the configured corridor identity or approved alias policy.
2. **Validated highway-class compatibility** — segment classes match the corridor class and role policy for mainline, link, ramp, frontage, or excluded roles.
3. **Validated oneway or bidirectional metadata** — directional basis is explicit and correctly normalized, including `oneway=-1` handling where applicable.
4. **Validated geometry continuity** — candidate segments form an ordered, connected, auditable corridor pattern.
5. **Validated county containment** — all required segments are contained, approved boundary crossings, or intentionally excluded from the county-scoped confidence calculation.
6. **Validated carriageway-pair structure when required** — divided highways and one-way carriageways must show compatible pair, separation, and direction evidence before divided-direction confidence can rise.

## Supporting Evidence Definitions

Supporting evidence strengthens or weakens a claim but cannot create confidence without primary evidence:

- Route relation membership with consistent roles and ordering.
- Carriageway separation details for divided corridors.
- Lane counts, directional lane tags, turn-lane tags, managed-lane indicators, and forward/backward lane allocation.
- Destination, destination-ref, forward/backward destination, and ramp-sign metadata.
- Access restrictions that confirm or constrain the intended public corridor role.
- Cross-segment consistency across adjacent counties when the county policy allows regional continuity context.

## Supplemental Evidence Definitions

Supplemental evidence provides context, audit support, and drift comparison only:

- Geometry bearing summaries and cardinal-direction candidates.
- Human reviewer notes.
- Prior confidence state and prior validation batch identifiers.
- External observation notes that are not part of an approved integration.
- Non-authoritative map labels or descriptive names.

Supplemental evidence cannot independently increase a record above `insufficient_evidence`.

## Insufficient Evidence Definitions

The following are insufficient for directional confidence:

- Bearing-only evidence.
- A road name or corridor label without validated route refs.
- Lane metadata without route identity, continuity, and directional basis.
- Destination tags without route identity and validated directional metadata.
- Relation membership without segment-level compatibility.
- County-name tags without spatial containment.
- A single isolated geometry fragment unless the future corridor class explicitly allows isolated facilities.
- Reviewer notes without structured validated evidence.

## Confidence Progression Model

Confidence progresses only after V681 validation acceptance.

1. **Validated input gate:** only records accepted for confidence-model input may enter scoring.
2. **Blocker scan:** blocking and permanent-blocking conditions are evaluated before any confidence increase.
3. **Primary signal count:** at least two independent primary evidence categories must agree before moving beyond `insufficient_evidence`.
4. **Directional basis requirement:** validated oneway, bidirectional, divided-pair, or explicitly non-static status must exist; bearing cannot satisfy this requirement.
5. **Supporting signal agreement:** supporting evidence can raise confidence when it agrees with primary evidence and comes from independent metadata.
6. **Containment confirmation:** county containment must be clean or explicitly approved as boundary-crossing before confidence can become `moderate_confidence` or `high_confidence`.
7. **Conflict and drift checks:** unresolved conflicts, stale evidence, geometry hash changes, or tag drift reduce or expire confidence.
8. **Output assignment:** final state, rationale, signal summary, blockers, review flags, and runtime eligibility are recorded as offline outputs.

Suggested progression thresholds:

- `insufficient_evidence`: fewer than two independent primary signals, or no validated directional basis.
- `low_confidence`: two primary signals agree but supporting evidence is absent, weak, stale, or partially inconsistent.
- `moderate_confidence`: route identity, class, continuity, containment, and directional basis agree, with at least one supporting signal and no material unresolved conflict.
- `high_confidence`: all required primary signals agree, multiple supporting signals agree where available, containment is clean, drift is within tolerance, and no material conflict remains.

## Confidence Reduction Model

Confidence should be reduced when evidence remains usable but less trustworthy:

- Supporting evidence is missing for a complex corridor type.
- Lane metadata conflicts with oneway metadata but the conflict is local and reviewable.
- Destination metadata suggests a different travel direction than primary signals.
- Relation membership is incomplete but segment refs and continuity are strong.
- Boundary crossing is approved but county split decisions are complex.
- Geometry continuity has minor non-material gaps or extraction artifacts.
- Evidence age exceeds freshness targets but has not crossed expiration thresholds.
- Multiplex refs are present but split points or shared extents are ambiguous.
- Highway class changes are valid but require future class-specific policy review.

Reduction never converts blocked evidence into low confidence. Reduction applies only after blocker checks pass.

## Confidence Blocking Model

Confidence must be blocked when safe interpretation is not possible:

- V681 validation status is not accepted for confidence input.
- Required route identity, class, continuity, containment, provenance, or directional basis is missing.
- County containment is `outside_scope` or `unresolved` for required segments.
- Oneway metadata materially contradicts carriageway-pair structure.
- Route refs create unresolved corridor identity ambiguity.
- Geometry continuity contains material gaps, branch swaps, duplicates, or topology impossible to evaluate.
- Reversible, time-dependent, contraflow, or managed-lane direction would require dynamic interpretation.
- Source provenance, extraction batch, tag snapshot, or geometry hash is missing.
- Any output would imply runtime display, DriveTexas activation, Transportation Intelligence activation, or TIGER replacement.
- Evidence depends solely on line bearing.

## Manual Review Model

Manual review is required when evidence is valid but not safely decidable by deterministic rules:

- Multiplex geometry, split points, or route refs are ambiguous.
- Divided-carriageway pairing is plausible but incomplete.
- Directional lane tags disagree with oneway tags.
- Destination tags contradict route identity or primary directional basis.
- Boundary crossings require county-specific ownership, split, or eligibility decisions.
- Reversible-lane or managed-lane tags appear.
- Confidence drift suggests upstream OSM changes that may be real rather than extraction noise.
- A future corridor class introduces new evidence patterns not covered by the current taxonomy.

Manual review may produce a reviewed confidence state, but review decisions remain auditable and non-runtime unless future activation gates explicitly allow consumption.

## County Containment Integration

County containment is a confidence gate and a confidence reducer.

Rules:

- `contained` required segments may support `moderate_confidence` or `high_confidence` if other evidence agrees.
- Approved `boundary_crossing` segments may support confidence only when the county split policy is recorded.
- `outside_scope` required segments block county-scoped confidence.
- `unresolved` containment blocks confidence until resolved.
- Regional continuity may support audit context but cannot override county eligibility.
- Cross-county corridors must preserve per-county confidence outputs, including differing states for different counties.

## Conflict-Resolution Considerations

Conflicts are handled by severity and evidence category:

1. **Provenance conflicts** block confidence.
2. **Containment conflicts** block or expire confidence before direction is considered.
3. **Identity conflicts** block or require manual review before direction is considered.
4. **Topology conflicts** block, reduce, or require review depending on materiality.
5. **Directional conflicts** reduce, block, or require review; they are never resolved by bearing alone.
6. **Supporting metadata conflicts** reduce confidence unless they reveal a primary evidence contradiction.
7. **Supplemental conflicts** are audit notes unless they indicate drift or upstream data change.

The model should record the strongest conflict, affected segments, evidence categories involved, and whether the conflict is blocking, reducing, or review-triggering.

## Confidence Drift Handling

Confidence drift occurs when current evidence differs from previously validated evidence.

Drift triggers:

- Geometry hash changes.
- Tag snapshot changes affecting refs, highway class, oneway, lanes, destination, access, or relation membership.
- County boundary artifact changes.
- Corridor split/merge changes.
- Previously supporting evidence disappears.
- Previously unresolved conflicts become stronger.

Handling:

- Minor supplemental drift records an audit note.
- Supporting evidence drift reduces confidence pending revalidation.
- Primary evidence drift expires confidence and requires revalidation.
- Containment drift blocks confidence until resolved.
- Dynamic direction drift for reversible or managed lanes remains non-static and blocked from automatic confidence.

## Confidence Output Design

Future offline outputs should include:

- `confidenceState`.
- `confidenceEligibleForOfflinePrototype`.
- `futureRuntimeEligible` defaulting to `false`.
- `manualReviewRequired`.
- `blockingReasons`.
- `reductionReasons`.
- `primarySignalsPresent`.
- `supportingSignalsPresent`.
- `supplementalSignalsPresent`.
- `conflicts`.
- `countyContainmentSummary`.
- `driftStatus`.
- `evidenceBatchId`.
- `validationBatchId`.
- `geometryHash`.
- `tagSnapshotId`.
- `reviewStatus`.
- `auditRationale`.

## Future Runtime Integration Points

If a later milestone authorizes runtime consumption, runtime systems should consume only a narrow, pre-audited confidence summary:

- Corridor identifier and county scope.
- Segment identifiers already approved for runtime use.
- Confidence state.
- Directional basis type.
- Manual-review status.
- Blocking status.
- Freshness and drift status.
- Explicit runtime eligibility flag.
- Display eligibility flag, defaulting to `false`.

Runtime systems should not consume raw OSM tags, bearing-derived direction, reviewer free text, unreviewed conflicts, or confidence records that lack explicit activation approval.

## Runtime Isolation Strategy

V682 outputs remain offline documentation and future artifact designs. Isolation requirements:

- Do not modify `js/app.js`.
- Do not add directional UI.
- Do not add NB/SB/EB/WB display.
- Do not enable DriveTexas.
- Do not enable Transportation Intelligence.
- Do not add Supabase tables or writes.
- Do not change TIGER or county road assets.
- Do not connect confidence outputs to production systems.
- Keep future confidence artifacts in an offline namespace until a separate milestone authorizes runtime integration.

## TIGER Coexistence Strategy

TIGER assets remain Gridly's county road base where already used. OSM directional confidence must coexist as optional offline intelligence and must not replace TIGER geometry or county road assets.

Future coexistence rules:

- TIGER continues to serve existing non-directional county road awareness functions.
- OSM confidence records remain separate and provenance-labeled.
- No TIGER feature is overwritten by OSM directional evidence.
- Any future conflation must be separately designed, audited, and authorized.

## Future DriveTexas Compatibility Considerations

DriveTexas remains paused. Confidence design should not assume DriveTexas availability, semantics, geometry, directionality, or event status.

Future compatibility may require:

- Separate event-to-corridor matching.
- Separate confidence between static OSM direction and dynamic event direction.
- Strict proof that DriveTexas status does not activate Transportation Intelligence or directional display without authorization.
- Independent runtime flags and display gates.

## Risk Review

Primary risks:

- False confidence from weak or correlated evidence.
- Bearing-only inference accidentally promoted to directional truth.
- OSM metadata inconsistency across counties and corridor classes.
- Multiplex ambiguity.
- Divided-highway and one-way carriageway pairing errors.
- Reversible-lane and managed-lane static interpretation errors.
- County containment drift.
- Runtime systems consuming offline confidence prematurely.
- User trust damage if confidence appears as a navigational claim.

Mitigation is to keep confidence blocked by default, require multiple independent validated signals, reject bearing-only evidence, preserve county containment gates, require review for ambiguity, and keep directional display blocked.

## Future Roadmap

Recommended next milestones:

1. Build an offline confidence validation prototype that reads mock V681 validation outputs and emits non-runtime V682 confidence records.
2. Create synthetic fixtures for interstates, U.S. highways, state highways, FM roads, multiplex corridors, divided highways, undivided highways, one-way carriageways, and reversible-lane scenarios.
3. Define freshness, drift, and expiration thresholds per evidence category.
4. Design review workflows and audit schemas.
5. Run county-contained offline tests before any runtime integration discussion.
6. Only after separate approval, design a runtime contract with default-deny display eligibility.

## Final Recommendation

Proceed to an offline confidence validation prototype. Do not enable directional display, DriveTexas, Transportation Intelligence, runtime confidence consumption, TIGER replacement, or production directional logic.

Final determination: **CONFIDENCE MODEL READY FOR CONFIDENCE VALIDATION PROTOTYPE**.
