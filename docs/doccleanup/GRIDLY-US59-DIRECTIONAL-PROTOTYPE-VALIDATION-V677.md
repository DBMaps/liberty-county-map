# GRIDLY V677 — US 59 / I-69 Directional Prototype Offline Validation

## Mission alignment

Gridly remains **Awareness Platform First** and **Route Intelligence Second** under the mission theme **Know Before You Go**. V677 is an offline-only research prototype validation intended to determine whether Gridly can reliably establish directional intelligence for the US 59 / I-69 corridor from OpenStreetMap-derived evidence without guessing.

This milestone does not authorize route guidance, navigation, user-facing directional labels, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, county-road asset replacement, Supabase changes, new counties, or framework changes.

## Protected systems verification

V677 is documentation and evidence only. No runtime files were modified, and protected systems remain in their required blocked states:

| Protected system | Required state | V677 verification |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Preserved; no runtime edits. |
| `historyUiEnabled` | `false` | Preserved; no UI edits. |
| `DriveTexasPaused` | `true` | Preserved; no DriveTexas activation. |
| `TransportationIntelligenceEnabled` | `false` | Preserved; no Transportation Intelligence activation. |
| `TransportationIntelligenceDisplay` | `false` | Preserved; no directional display. |
| `TransportationIntelligenceActivation` | `false` | Preserved; no activation path added. |

Files intentionally not modified include `js/app.js`, runtime assets, county road assets, TIGER-derived assets, Supabase files, and production configuration.

## Prototype objective

The objective was to answer one narrow research question:

> Can Gridly reliably determine corridor directionality for US 59 / I-69 using OSM-derived data?

The approved corridor and county scope were:

- Corridor: **US 59 / I-69**
- Counties: `liberty-tx`, `montgomery-tx`

The validation standard required evidence for corridor identity, corridor continuity, northbound path, southbound path, and directional consistency without relying solely on line bearing.

## Offline evidence inventory

The repository contains prior OSM feasibility and planning artifacts for V675 and V676, but it does not contain a V677 OSM corridor extract, route-relation member table, source extraction timestamp, checksum, per-way OSM IDs, or a preprocessed segment audit table for US 59 / I-69 within Liberty and Montgomery counties.

Because this milestone is offline-only, no live OSM query, DriveTexas query, Supabase query, or production-system query was used to compensate for missing local extract evidence.

## OSM extraction findings

### Required question 1: Can US 59 / I-69 be extracted cleanly from OSM?

**Finding: Not validated.**

A clean extraction cannot be confirmed from the repository alone because the required local extraction artifacts are absent. The validation would require at minimum:

- OSM route relations for US 59 and I-69.
- Member ways within `liberty-tx` and `montgomery-tx`.
- Normalized `ref` / `name` evidence.
- Source timestamp and checksum.
- Accepted, rejected, and quarantined segment lists.

Without those artifacts, Gridly cannot prove that the corridor was extracted cleanly.

### Required question 2: Can route relation data reliably identify corridor membership?

**Finding: Not validated.**

Prior planning indicates OSM route relations are the preferred evidence source for major corridors, but V677 does not have relation membership evidence to inspect. Relation reliability therefore remains unproven for this corridor and county scope.

## Corridor continuity findings

**Finding: Corridor continuity is not validated.**

Continuity would require a county-contained sequence of accepted mainline segments connecting through Montgomery and Liberty counties with documented treatment at county boundaries. No such sequence is present in the repository. The absence of per-segment OSM IDs, topology checks, boundary-cut markers, and gap/overlap analysis prevents a continuity pass.

## Directionality findings

### Required question 3: Can northbound and southbound carriageways be distinguished?

**Finding: Not validated.**

Northbound and southbound carriageways cannot be distinguished without accepted mainline ways, one-way semantics, relation evidence, and carriageway pairing data. No V677 segment table exists to prove this separation.

### Required question 4: Can directionality be established without relying solely on line bearing?

**Finding: Not validated; bearing-only inference is disallowed.**

Directionality cannot be established from bearing alone. Required non-bearing evidence would include OSM `oneway` tags, ordered route relation membership, explicit carriageway structure, route membership, and conflict review. Because those artifacts are unavailable locally, any NB/SB assignment would require guessing and is therefore blocked.

## Confidence methodology

The V677 confidence method follows the prior V676 planning framework and requires scoring each accepted segment across five evidence areas:

| Evidence area | Points | V677 requirement |
| --- | ---: | --- |
| Route identity | 25 | OSM relation membership or normalized `ref` / `name` evidence proves US 59 / I-69 identity. |
| Geometry continuity | 20 | Accepted mainline segments connect without unexplained gaps, overlaps, or reversals. |
| Directional semantics | 25 | One-way tags, carriageway pairing, relation roles, or equivalent explicit evidence support NB/SB. |
| County containment | 15 | Geometry is clipped and assigned to exactly one approved county. |
| Conflict review | 15 | Frontage roads, ramps, connectors, duplicated geometry, and conflicting refs are resolved or quarantined. |

Confidence status definitions:

- `pass_candidate`: score >= 90 and no mandatory blockers.
- `review_required`: score 70-89 or non-critical inconsistencies.
- `blocked`: score < 70 or any mandatory blocker.

Mandatory blockers for V677 include missing source timestamp/checksum, absent relation-member evidence, missing county containment proof, frontage/ramp ambiguity, and bearing-only direction inference.

## Segment confidence assessment

Because no V677 OSM segment extract or audit table exists, no segment can receive a `pass_candidate` score. The evidence-based prototype result is:

| Metric | Result |
| --- | ---: |
| High-confidence corridor segments | 0% validated |
| Ambiguous or blocked corridor segments | 100% unresolved from available evidence |
| Route identity validated | No |
| Corridor continuity validated | No |
| Directionality validated | No |
| County containment validated | No |

These percentages reflect the available offline evidence in this repository, not a claim about the real-world quality of OSM coverage.

## Ambiguous segment analysis

All candidate segments remain ambiguous because the prototype lacks the artifacts needed to classify them. Specific unresolved ambiguity categories are:

- Mainline versus frontage road separation.
- Mainline versus ramp or connector separation.
- US 59 / I-69 concurrency handling.
- One-way direction assignment.
- Northbound and southbound carriageway pairing.
- County-boundary clipping at Liberty and Montgomery boundaries.
- Conflict handling for local names and route-reference variants.

No ambiguous segment should be promoted to runtime, display, or directional use.

## County containment findings

**Finding: County containment is not validated.**

The approved counties are only `liberty-tx` and `montgomery-tx`. The repository includes existing county-focused assets, but V677 did not create or modify county road assets and did not add new counties. Because no US 59 / I-69 OSM extract is present, there is no segment-level proof that candidate geometry is clipped to, assigned to, and contained within the approved counties.

## Runtime implications

V677 has no runtime implications:

- Runtime behavior was not changed.
- `js/app.js` was not modified.
- Directional UI was not added.
- NB/SB/EB/WB display was not added.
- Route guidance and navigation features were not added.
- DriveTexas remains paused.
- Transportation Intelligence remains disabled.
- TIGER assets and county road assets remain unchanged.
- No prototype output is connected to production systems.

## Preprocessing required before any future retry

A future offline retry would require a reproducible preprocessing package that produces:

1. OSM source timestamp and checksum.
2. Route relations for US 59 and I-69.
3. Relation-member way inventory within Liberty and Montgomery counties.
4. Normalized corridor IDs for US 59 / I-69 refs and naming variants.
5. County-clipped segment geometry.
6. Mainline/frontage/ramp/connector classification.
7. Carriageway pairing and one-way semantic review.
8. Topology checks for gaps, overlaps, reversals, and county-boundary cuts.
9. Segment confidence scores with mandatory blockers.
10. Accepted, rejected, and quarantined audit tables.

## Future applicability

OSM may still be a useful supplemental source for future corridor-only research if a complete offline extract is produced and scored. However, V677 proves that planning assumptions alone are insufficient. Gridly should continue to block directional display unless future evidence can prove route identity, continuity, county containment, and NB/SB directionality segment by segment.

## Future risks remaining

- False directional confidence if line bearing is treated as proof.
- OSM relation incompleteness or stale relation membership.
- County clipping that removes context needed for directionality.
- Frontage-road and ramp confusion around a divided highway.
- Maintenance drift as OSM changes.
- User trust impact if ambiguous directionality reaches the UI.
- Incorrect assumptions that a future DriveTexas event can be mapped directly to OSM segments.

## PASS / FAIL assessment

**FAIL.**

The evidence required to establish high-confidence, repeatable US 59 / I-69 directional intelligence is not present in the repository. Directionality cannot be established without guessing, and the requested standard explicitly requires failure when confidence cannot be established without guessing.

## Final determination

**FAIL — Gridly cannot currently rely on the available offline repository evidence to determine US 59 / I-69 corridor directionality for Liberty and Montgomery counties without guessing.**
