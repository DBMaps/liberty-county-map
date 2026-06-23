# GRIDLY V681 — OSM Directional Validation Risk Review

## Scope

This risk review supports the V681 documentation-only OSM directional validation model design. It does not perform extraction, create runtime logic, calculate confidence, activate display, activate DriveTexas, activate Transportation Intelligence, replace TIGER assets, modify county road assets, or connect validation outputs to production systems.

## Protected Systems Confirmation

| Protected system | Required state | V681 risk-review position |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | No change recommended |
| `historyUiEnabled` | `false` | No change recommended |
| `DriveTexasPaused` | `true` | No change recommended |
| `TransportationIntelligenceEnabled` | `false` | No change recommended |
| `TransportationIntelligenceDisplay` | `false` | No change recommended |
| `TransportationIntelligenceActivation` | `false` | No change recommended |

## False Directional Confidence Risk

Directional road claims can appear authoritative even when the underlying evidence is incomplete. A premature northbound, southbound, eastbound, or westbound display could mislead users, weaken trust, and imply route intelligence that Gridly has not yet validated.

Mitigation:

- Keep validation offline and non-runtime.
- Require route identity, class compatibility, continuity, containment, directional basis, and provenance before acceptance.
- Treat acceptance only as eligibility for future confidence-model design, not display readiness.
- Block or escalate conflicting required evidence instead of converting it into confidence.

## Evidence-Quality Risk

OSM tags can be incomplete, inconsistent, stale, or differently maintained across counties and corridor classes. Optional tags such as lanes and destinations may be useful but unevenly available.

Mitigation:

- Separate required, optional, insufficient, and disallowed evidence.
- Preserve raw source references and tag snapshots for audit.
- Reject incompatible evidence and block missing required evidence.
- Avoid corridor-specific assumptions or manual engineering exceptions.

## Metadata Inconsistency Risk

Oneway, lane, destination, route relation, and highway-class metadata may disagree. Divided highways, multiplexes, managed lanes, and ramps increase the chance of internal contradictions.

Mitigation:

- Resolve conflicts in a deterministic order: source integrity, containment, identity, topology, directionality, then enrichment.
- Escalate material contradictions between required evidence categories.
- Treat optional metadata conflicts as review or future-confidence inputs, not automatic acceptance.

## County Containment Risk

A directionally plausible corridor can still be wrong for a county-aware product if the segment crosses, leaks outside, or cannot be matched to approved county scope.

Mitigation:

- Make county containment a required validation gate.
- Use spatial containment against approved boundary artifacts.
- Treat county-name tags as audit context only.
- Block unresolved or outside-scope required mainline segments.
- Preserve per-county outcomes for cross-county corridors.

## Validation Drift Risk

OSM geometry and tags change over time. A validation result that was acceptable in one extraction batch may become stale after mapper edits, boundary updates, or schema changes.

Mitigation:

- Require geometry hashes, source IDs, batch identity, and validation timestamps.
- Keep validation outputs immutable per batch.
- Design future drift monitoring before runtime activation.
- Revalidate after material source or boundary changes.

## Runtime Expansion Risk

Documentation outputs can accidentally become de facto product requirements or be wired into runtime surfaces before safety gates are complete.

Mitigation:

- Mark all validation outputs `runtimeEligible: false`.
- Do not modify `js/app.js` or production ingestion paths.
- Require separate milestones for confidence design, offline prototype, runtime readiness, and display activation.
- Keep protected systems unchanged.

## User Trust Risk

Gridly's mission depends on awareness users understanding that displayed information is conservative and trustworthy. Directional claims that are later corrected could damage confidence in the platform.

Mitigation:

- Maintain the product order: Awareness Platform First, Route Intelligence Second.
- Keep directional display blocked until validation, confidence, audit, and activation are separately approved.
- Avoid presenting validation status as user-facing route guidance.

## DriveTexas Assumption Risk

DriveTexas incident or closure semantics may appear to imply directionality, but they are not a substitute for OSM directional evidence. Activating or inferring DriveTexas behavior during OSM validation would collapse separate governance tracks.

Mitigation:

- Keep `DriveTexasPaused: true`.
- Treat DriveTexas as a possible future external condition source only after separate authorization.
- Do not use DriveTexas data as required validation evidence for OSM directionality.

## Maintenance Burden

A scalable validation model must support many counties and corridor classes without bespoke rules. Manual per-corridor exceptions would become costly and risky.

Mitigation:

- Keep the model corridor-agnostic and data-driven.
- Use configurable corridor class, segment role, containment, and evidence-category policies.
- Reserve manual review for unresolved ambiguity, not routine validation.
- Record review outcomes for audit and future process improvement.

## Recommendation to Keep Directional Display Blocked

Directional display should remain blocked. V681 defines how evidence should be validated; it does not prove that current evidence is complete, does not create confidence scoring, does not authorize runtime ingestion, and does not establish user-facing directional UI.

## Final Risk Position

The validation model is appropriate to advance toward future confidence-model design, provided all outputs remain offline, county-aware, blocked by default, and non-runtime.

**Risk recommendation:** keep directional display blocked and keep DriveTexas and Transportation Intelligence inactive.
