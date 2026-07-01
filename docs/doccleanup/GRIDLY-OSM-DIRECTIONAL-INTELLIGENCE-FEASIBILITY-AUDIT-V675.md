# GRIDLY V675 — OSM Directional Intelligence Feasibility Audit

## Mission alignment

Gridly remains **Awareness Platform First** and **Route Intelligence Second**. This V675 milestone is a documentation-only feasibility audit under the mission theme **Know Before You Go**. The purpose is to decide whether OpenStreetMap (OSM) could safely support a future, separately approved directional-intelligence layer for major corridors without changing runtime behavior now.

The audit evaluates OSM as a possible supplemental source for future corridor awareness such as northbound, southbound, eastbound, and westbound context. It does not authorize display, activation, routing, DriveTexas integration, schema changes, alert changes, or replacement of existing road assets.

## Protected systems verification

V675 made no runtime changes. The protected systems remain required in their blocked or disabled state:

| Protected system | Required state | V675 status |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Preserved |
| `historyUiEnabled` | `false` | Preserved |
| `DriveTexasPaused` | `true` | Preserved |
| `TransportationIntelligenceEnabled` | `false` | Preserved |
| `TransportationIntelligenceDisplay` | `false` | Preserved |
| `TransportationIntelligenceActivation` | `false` | Preserved |

No Directional Display was enabled. No DriveTexas integration was enabled. No Transportation Intelligence activation, display, or runtime behavior was added.

## Current road data baseline

Gridly currently treats county road assets as awareness-supporting map context. The existing TIGER-derived county road assets are useful for broad county-level road visibility, local road naming, and stable offline-style context within county packages.

For V675, the baseline remains unchanged:

- Liberty County road assets remain unchanged.
- Montgomery County road assets remain unchanged.
- San Jacinto County road assets remain unchanged.
- No new counties were added.
- No Supabase schema changes were made.
- No runtime route resolver, report, alert, awareness, or Route Watch behavior was changed.

## Why TIGER remains useful

TIGER remains useful because it is broad, stable, county-friendly, and appropriate for general awareness context:

- It provides a consistent road-network baseline for county-scoped packages.
- It supports local road recognition where directional carriageway semantics are not required.
- It is appropriate for map context, reporting language, and awareness framing.
- It avoids relying on live third-party routing behavior.
- It can coexist with county containment expectations already used by Gridly.

TIGER should therefore remain the primary county road-context asset at this stage.

## Why TIGER is insufficient for directional intelligence

TIGER is not sufficient by itself for safe NB/SB/EB/WB corridor intelligence because directional awareness requires more than a road name or centerline. Future directional intelligence would need carriageway separation, one-way segment semantics, route membership, directional continuity, confidence scoring, and validation against real corridor geometry.

Known limitations for directional-intelligence use include:

- Centerlines may not distinguish divided highway carriageways well enough for lane-direction context.
- Route names can be present without reliable direction-specific segment attribution.
- Local naming variants may not indicate official route continuity.
- County clipping can break route continuity at borders.
- Directional confidence must not be inferred from a road label alone.

## OSM source assessment

OSM can contain useful directional-intelligence primitives, including highway classifications, route relations, ref tags, name tags, one-way tags, bridge/tunnel structure, divided carriageways, and geometry that may distinguish opposing travel directions. These properties make OSM a plausible future supplemental catalog source for major corridors.

However, OSM is community-maintained and must be treated as variable-confidence source data. It can support directional intelligence only when preprocessing proves that a corridor has enough evidence to avoid guessing. A future Gridly catalog would need to preserve source attribution, extraction date, validation status, relation confidence, directionality confidence, and blocked/approved state per corridor segment.

## Directional-intelligence requirements

A future corridor-only directional catalog would require all of the following before any implementation:

1. County-contained extraction for Liberty, Montgomery, and San Jacinto.
2. Explicit corridor identity mapping using `ref`, `name`, and route relation evidence.
3. Geometry validation for divided and undivided segments.
4. One-way and carriageway direction validation where applicable.
5. Segment-level confidence scoring.
6. Rejection of segments where NB/SB/EB/WB would be guessed from line bearing alone.
7. Human-readable audit output explaining why a segment is approved or blocked.
8. A strict runtime contract that keeps the catalog passive until a future milestone approves activation.
9. Asset-size budget validation for a corridor-only extract.
10. Maintenance workflow for OSM updates and regression checks.

## Corridor feasibility matrix

| Corridor | Counties / relevance | OSM feasibility for directionality | Pilot posture | Rationale |
| --- | --- | --- | --- | --- |
| US 59 / I-69 | Liberty, Montgomery, San Jacinto regional relevance | Medium to high, pending relation and carriageway validation | Safest pilot candidate | Major divided corridor with strong route identity; likely useful for future official event matching if confidence can be proven. |
| US 90 | Liberty relevance | Medium | Conditional pilot candidate | Strong route identity, but mixed urban/rural segments and local naming require validation. |
| TX 146 | Liberty relevance | Medium | Conditional pilot candidate | State highway identity is clear, but county clipping and local geometry must be checked. |
| TX 321 | Liberty relevance | Medium | Conditional pilot candidate | Useful county corridor; directionality should remain blocked where geometry or route continuity is ambiguous. |
| FM 1960 | Liberty / Montgomery regional relevance | Low to medium | Block until validated | Farm-to-market route naming and segment continuity may be inconsistent; directional labels could be misleading without stronger evidence. |
| SH 105 | Montgomery / San Jacinto regional relevance | Medium | Conditional pilot candidate | Important east-west regional corridor; pilot only after relation continuity and county-contained segment checks. |
| SH 150 | San Jacinto relevance | Low to medium | Block until validated | Smaller corridor with potential relation/name inconsistency; should not receive directional display without explicit proof. |
| I-10 | Future Chambers / Jefferson relevance | High for future counties, out of current county scope | Future-only candidate | Major divided interstate likely supports directionality, but it is not a V675 implementation target for current counties. |

## County containment assessment

OSM extraction can likely be county-contained if a future preprocessing workflow clips source geometries to approved county boundaries and stores only approved corridor segments. However, route relations naturally cross county boundaries, and clipping can create partial segments that lose context. County containment is feasible only if preprocessing preserves enough external route identity metadata while excluding out-of-scope runtime geometry.

Required containment controls:

- Extract only Liberty, Montgomery, and San Jacinto corridor geometries for current scope.
- Preserve cross-county route identifiers as metadata, not as uncontrolled geometry expansion.
- Mark boundary-cut segments as requiring validation.
- Do not let I-10 geometry enter current runtime packages until Chambers or Jefferson scope is explicitly approved.

## Runtime/storage efficiency assessment

A corridor-only OSM directional catalog would likely be much smaller than full OSM road extracts because it would store only selected major corridors, simplified geometry, directional metadata, and confidence flags. The runtime impact should remain low if the catalog is preprocessed into static, county-contained assets and not queried live.

Efficiency requirements for any future prototype:

- Store only pilot corridor segments, not the full OSM road network.
- Simplify geometry within a documented tolerance.
- Use compact metadata keys for corridor id, segment id, direction, confidence, source date, and blocked/approved state.
- Keep assets passive and unloaded from UI paths until explicitly approved.
- Measure bundle-size and load-time impact before runtime use.

## Architecture compatibility assessment

OSM can coexist with current TIGER-derived county road assets if it is treated as a supplemental corridor-only directional catalog rather than a replacement. The architecture should remain layered:

1. TIGER-derived county assets continue to provide general road context.
2. OSM corridor catalog, if later approved, provides directional metadata only for validated major corridors.
3. Awareness generation remains unchanged unless a future milestone explicitly authorizes use.
4. Directional display remains blocked until separately approved.
5. DriveTexas mapping remains paused until official integration governance is approved.

This compatibility depends on a strict separation between baseline road context and future directional-intelligence evidence.

## DriveTexas readiness impact assessment

A validated OSM corridor catalog could materially improve future DriveTexas or official transportation-event readiness by providing a normalized corridor and directional segment reference layer. It could help match official event descriptions such as northbound lanes, southbound frontage road, eastbound main lanes, or westbound closure contexts.

V675 does not integrate DriveTexas. The readiness benefit is prospective only. Any future DriveTexas use would require official source mapping validation, event vocabulary mapping, lane/frontage-road handling, and protected-system approval.

## Risk review summary

Key risks identified in V675:

- OSM completeness varies by corridor and segment.
- Route relations and route names may be inconsistent.
- County clipping can remove context needed to prove directionality.
- Runtime asset size must remain bounded by corridor-only extraction.
- False directional confidence would harm user trust.
- Maintenance requires repeatable OSM refresh and regression validation.
- DriveTexas event text may not map cleanly to OSM segments.
- Directional display must remain blocked until explicitly approved.

A dedicated risk review is provided in `GRIDLY-OSM-DIRECTIONAL-INTELLIGENCE-RISK-REVIEW-V675.md`.

## Non-goals

V675 explicitly does not:

- Modify runtime behavior.
- Modify `js/app.js`.
- Add directional UI.
- Add NB/SB/EB/WB display.
- Integrate DriveTexas.
- Activate Transportation Intelligence.
- Replace TIGER road assets.
- Modify existing county road assets.
- Modify Supabase schema.
- Add new counties.
- Change alert generation.
- Change awareness generation.
- Change reporting behavior.
- Change Route Watch behavior.
- Introduce frameworks.

## Required future prerequisites

Before any future prototype, Gridly would need:

1. Explicit governance approval for a prototype milestone.
2. A repeatable OSM extraction script or documented process.
3. County boundary clipping validation.
4. Corridor relation and `ref` validation.
5. Directionality confidence scoring rules.
6. A blocked-by-default catalog schema.
7. Human audit artifacts for approved and rejected segments.
8. Bundle-size and runtime-load budget checks.
9. Protected-system regression checks.
10. A decision gate forbidding directional display until confidence is proven without guessing.

## Final determination

**LIMITED CORRIDOR-ONLY OSM FEASIBILITY REVIEW RECOMMENDED BEFORE ANY IMPLEMENTATION.**

OSM should not replace TIGER at this stage. OSM should be evaluated only as a supplemental corridor-only directional catalog for major corridors. No production implementation should occur during V675. A future prototype should be recommended only if corridor confidence can be proven without guessing and directional display remains blocked until explicitly approved.
