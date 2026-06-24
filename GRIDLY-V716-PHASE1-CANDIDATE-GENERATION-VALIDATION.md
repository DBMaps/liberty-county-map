# GRIDLY V716 — Phase 1 Candidate Generation And Readiness Validation

## Mission

**Know Before You Go**

Gridly remains:

1. **Awareness Platform First**
2. **Route Intelligence Second**

## Scope

V716 executes the prototype directional-candidate generation process against the Phase 1 corridor source datasets introduced and revalidated in V715:

- US 90
- TX 146
- FM 1960

This validation is documentation/evidence only. It does **not** activate corridors, change runtime rendering, connect alerts, modify Route Watch, alter routing/navigation, change county systems, or modify Supabase.

## Source Inventory Used

| Corridor | Source path | Source features | V715 inventory posture |
|---|---:|---:|---|
| US 90 | `assets/directional-intelligenc/source/osm/liberty-us90-source.geojson` | 127 | Inventory feasible; candidate generation feasible |
| TX 146 | `assets/directional-intelligenc/source/osm/liberty-tx146-source.geojson` | 87 | Inventory feasible; candidate generation feasible |
| FM 1960 | `assets/directional-intelligenc/source/osm/liberty-fm1960-source.geojson` | 5 | Inventory feasible; candidate generation feasible |

> Observation: source files remain in the observed V715 path `assets/directional-intelligenc/source/osm/`, which omits the final `e` in `intelligence`. V716 used the observed source path and preserved that spelling as evidence input rather than moving source files.

## Candidate Generation Method

The V716 prototype candidate gate used fail-closed promotion rules:

1. Generate candidates only from source `LineString` features with usable endpoint bearing.
2. Exclude any feature with review bucket exposure from candidate promotion.
3. Promote **high confidence** candidates only when all of the following are true:
   - Liberty County containment is explicit (`tiger:county = Liberty, TX`).
   - `ref` is present.
   - `oneway = yes`.
   - No review buckets are present.
4. Promote **medium confidence** candidates only when all of the following are true:
   - Liberty County containment is explicit (`tiger:county = Liberty, TX`).
   - `ref` is present.
   - `oneway = no`.
   - No review buckets are present.
5. Do not promote bearing-only, county-ambiguous, missing-metadata, construction, reversible/center-lane, HOV/HOT, or manual-review records.

## Corridor Candidate Results

| Corridor | candidateCount | highConfidenceCount | mediumConfidenceCount | reviewRequiredCount | excludedCount | Determination |
|---|---:|---:|---:|---:|---:|---|
| US 90 | 40 | 40 | 0 | 87 | 87 | **READY WITH OBSERVATIONS** |
| TX 146 | 20 | 20 | 0 | 67 | 67 | **READY WITH OBSERVATIONS** |
| FM 1960 | 0 | 0 | 0 | 5 | 5 | **NOT READY** |

## Validation Gates

| Corridor | containmentPass | bearingProtectionPass | failClosedPass |
|---|---|---|---|
| US 90 | true | true | true |
| TX 146 | true | true | true |
| FM 1960 | true | true | true |

### Validation Interpretation

- **containmentPass:** candidate promotion requires explicit Liberty County metadata; missing or non-Liberty county metadata is excluded.
- **bearingProtectionPass:** candidates require usable endpoint bearing, but bearing alone is never sufficient for promotion.
- **failClosedPass:** review bucket exposure blocks promotion; FM 1960 demonstrates fail-closed behavior by producing zero promotable candidates rather than degraded directional output.

## Review Bucket Exposure

| Corridor | reversible_lane | construction_segment | hov_hot_lane | missing_county | missing_oneway | missing_ref | manual_review_required |
|---|---:|---:|---:|---:|---:|---:|---:|
| US 90 | 14 | 0 | 0 | 14 | 34 | 0 | 43 |
| TX 146 | 17 | 0 | 0 | 14 | 43 | 0 | 19 |
| FM 1960 | 0 | 0 | 0 | 4 | 4 | 0 | 0 |

> Counts are bucket exposure counts. A single excluded feature may contribute to more than one bucket, so bucket totals can exceed `excludedCount`.

## Corridor Determinations

### US 90 — READY WITH OBSERVATIONS

US 90 produced 40 high-confidence candidate records and passed containment, bearing protection, and fail-closed validation. However, 87 source features were excluded due to review bucket exposure, especially non-Liberty/manual-review county metadata, missing one-way metadata, missing county metadata, and reversible/center-lane indicators. US 90 is suitable for continued prototype expansion, but not for activation.

### TX 146 — READY WITH OBSERVATIONS

TX 146 produced 20 high-confidence candidate records and passed containment, bearing protection, and fail-closed validation. However, 67 source features were excluded, with the largest exposure in missing one-way metadata, non-Liberty/manual-review county metadata, reversible/center-lane indicators, and missing county metadata. TX 146 is suitable for continued prototype expansion, but not for activation.

### FM 1960 — NOT READY

FM 1960 produced zero promotable candidates. All five source features were excluded under fail-closed rules, primarily due to missing county and missing one-way metadata. The inventory remains feasible, but candidate readiness is not established until metadata gaps are resolved or manually reviewed through a governed evidence process.

## Protected Systems Verification

The following protected systems remain unchanged:

| System | Required state | V716 state |
|---|---|---|
| historicalReadsEnabled | false | false |
| historyUiEnabled | false | false |
| DriveTexasPaused | true | true |
| TransportationIntelligenceEnabled | false | false |
| TransportationIntelligenceDisplay | false | false |
| TransportationIntelligenceActivation | false | false |

## Overall Determination

# PHASE 1 NOT READY

Phase 1 is **not ready for expansion as a complete set** because FM 1960 generated zero promotable candidates under the protected fail-closed candidate rules. US 90 and TX 146 are ready with observations for continued prototype work, but the overall Phase 1 package should not advance until FM 1960 candidate readiness is resolved or explicitly descoped by governance.

## Evidence Artifact

Structured evidence was written to:

`assets/directional-intelligence/evidence/v716-phase1-candidate-generation-validation.json`
