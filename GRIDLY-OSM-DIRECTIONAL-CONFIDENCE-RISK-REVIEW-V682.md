# GRIDLY V682 — OSM Directional Confidence Risk Review

## Scope

This risk review supports the V682 OSM directional confidence model design. It is documentation-only and does not create extraction, inventory, runtime logic, directional display, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, Supabase changes, county asset changes, or production confidence code.

## Protected Systems

The following states must remain unchanged:

| Protected system | Required state |
| --- | --- |
| `historicalReadsEnabled` | `false` |
| `historyUiEnabled` | `false` |
| `DriveTexasPaused` | `true` |
| `TransportationIntelligenceEnabled` | `false` |
| `TransportationIntelligenceDisplay` | `false` |
| `TransportationIntelligenceActivation` | `false` |

## False Confidence Risk

False confidence is the primary product risk. A confidence state could be mistaken for a directional fact, especially when users see corridor names that already imply travel direction.

Mitigation:

- Keep confidence blocked by default.
- Require multiple independent validated signals.
- Separate validation acceptance from confidence trust.
- Keep all outputs non-runtime until a future activation gate.
- Record blockers, reducers, conflicts, and review status with every confidence output.

## Bearing-Only Inference Risk

Line bearing can suggest north/south/east/west orientation, but it cannot prove travel direction, carriageway role, one-way status, route identity, or county eligibility.

Mitigation:

- Bearing-only evidence must always remain insufficient.
- Bearing must be supplemental only.
- Bearing cannot satisfy the directional basis requirement.
- Bearing cannot resolve conflicts between primary or supporting evidence.
- Any model or prototype that promotes bearing-only confidence must fail review.

## Evidence Quality Risk

OSM data can be incomplete, stale, inconsistent, or uneven across corridor classes and counties.

Mitigation:

- Require route refs, highway class, oneway or bidirectional status, continuity, containment, and provenance before confidence can rise.
- Use lane, destination, relation, and access metadata as supporting evidence, not substitutes for primary evidence.
- Expire confidence when primary evidence drifts.
- Preserve audit records so stale or corrected evidence can be compared.

## Metadata Inconsistency Risk

Tags may vary between adjacent segments, different mappers, counties, and corridor classes. Multiplexes, frontage roads, ramps, HOV lanes, and reversible lanes increase inconsistency risk.

Mitigation:

- Use data-driven classification rather than corridor-specific exceptions.
- Reduce confidence for inconsistent supporting metadata.
- Require manual review for ambiguous multiplexes, divided-pair interpretation, reversible lanes, managed lanes, and unresolved relation issues.
- Block confidence when primary metadata conflicts materially.

## County Containment Risk

A regional corridor can be directionally valid while still being invalid for a county-scoped Gridly view. Boundary crossings and county split decisions can create false local confidence.

Mitigation:

- Treat county containment as a confidence gate.
- Block `outside_scope` and `unresolved` required segments.
- Allow boundary crossings only when policy and split decisions are recorded.
- Preserve per-county confidence states instead of inheriting regional confidence wholesale.

## Confidence Drift Risk

Confidence can become stale when OSM geometry, tags, relation membership, or county boundaries change.

Mitigation:

- Track geometry hashes, tag snapshots, validation batches, and confidence batches.
- Reduce or expire confidence when supporting or primary evidence changes.
- Block confidence when containment changes are unresolved.
- Require revalidation after primary evidence drift.

## Runtime Expansion Risk

A future team could mistakenly treat offline confidence outputs as display-ready or route-ready.

Mitigation:

- Include explicit `futureRuntimeEligible: false` until a later authorization milestone.
- Keep confidence outputs in an offline namespace.
- Do not modify `js/app.js` or runtime configuration in V682.
- Require a separate runtime contract, default-deny display flag, and protected-system audit before any production use.

## User Trust Risk

Directional confidence could be misunderstood as navigation guidance or an official traffic direction. Incorrect directional display would damage trust in Gridly's awareness-first mission.

Mitigation:

- Keep directional display blocked.
- Avoid NB/SB/EB/WB user-facing labels until separate display design and safety review.
- Use confidence internally for offline evaluation only.
- Keep product copy focused on awareness, not routing or navigation claims.

## DriveTexas Assumption Risk

Static OSM confidence and DriveTexas event intelligence are different evidence domains. Assuming compatibility could activate Transportation Intelligence by implication or create false event-direction claims.

Mitigation:

- Keep `DriveTexasPaused: true`.
- Do not use DriveTexas as confidence input in V682.
- Require separate event-to-corridor matching and event-direction confidence designs before any future integration.
- Keep Transportation Intelligence activation and display disabled.

## Maintenance Burden

A scalable confidence model must support dozens of counties and hundreds of corridors without manual exceptions. Manual corridor-specific rules would become unmaintainable and risky.

Mitigation:

- Use a corridor-agnostic taxonomy.
- Record evidence categories and confidence states consistently.
- Avoid US59-specific, county-specific, or manual exception logic.
- Use review queues for ambiguity rather than hardcoded overrides.
- Design fixtures for multiple corridor classes before runtime consideration.

## Recommendation to Keep Directional Display Blocked

Directional display must remain blocked after V682. The confidence model is ready for offline prototype validation, not user-facing display.

Do not enable:

- Directional UI.
- NB/SB/EB/WB display.
- DriveTexas activation.
- Transportation Intelligence activation.
- Runtime confidence consumption.
- TIGER replacement.

## Final Determination

**CONFIDENCE MODEL READY FOR CONFIDENCE VALIDATION PROTOTYPE**.
