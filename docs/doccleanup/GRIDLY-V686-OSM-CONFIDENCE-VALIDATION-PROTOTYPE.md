# GRIDLY V686R — OSM Confidence Validation Prototype Recovery

## 1. Mission alignment

Gridly remains **Know Before You Go**. This recovered V686 artifact supports the product posture of **Awareness Platform First** and **Route Intelligence Second** by validating offline confidence evidence before any corridor readiness reassessment.

## 2. Recovery context

V686 was reported complete, but the repository contained no V686 script, evidence JSON, or markdown artifact. V686R restores the missing V686 audit-only artifact set from the existing V684/V685 outputs already present in the repository.

## 3. Protected-system verification

Protected systems remain unchanged and explicitly verified in the recovered evidence:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## 4. Input artifact paths

The recovery used these existing artifacts:

| Input | Requested path | Resolved path | Status |
| --- | --- | --- | --- |
| V684 segment inventory | `assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json` | `assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json` | Found and valid JSON |
| V685 validation audit | `assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json` | `assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json` | Found and valid JSON |
| V684 extraction evidence | `assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json` | `assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json` | Found and valid JSON |

No path mismatch was required for these three inputs.

## 5. Explicit non-goals

This recovery does **not**:

- modify `js/app.js`
- modify `index.html`
- modify CSS
- add runtime loading
- add UI
- add directional labels
- add NB/SB/EB/WB display
- infer or display NB/SB/EB/WB to users
- connect to Route Watch, Alerts, or Awareness
- resume DriveTexas
- enable Transportation Intelligence
- change county operational status
- change Supabase
- fix the existing `directional-intelligenc` / `directional-intelligence` path typo
- introduce frameworks

## 6. Confidence validation method

The recovered script validates input existence, confirms JSON parseability, detects the segment inventory shape, and evaluates each segment using an independent signal model. Supported segment inventory shapes are:

- array
- object containing `segments`
- object containing `segmentInventory`
- object containing `records`

The detected segment inventory shape was `array`.

## 7. Independent signal model

### Core signals

- valid geometry summary
- corridor evidence
- county attribution
- oneway evidence
- source identity

### Supporting signals

- lanes
- turn:lanes
- destination:lanes
- Texas_Trunk_System
- NHS
- hgv:national_network

### Risk/reduction signals

- reversible lane
- `oneway:conditional` containing `-1`
- construction segment
- HOV/HOT lane
- fixme/FIXME tags
- missing county
- missing oneway
- missing ref/fut_ref
- missing geometry
- rejected extraction status

## 8. Confidence state model

V686R assigns only these offline audit states:

- `confidence_candidate_strong`
- `confidence_candidate_limited`
- `confidence_review_required`
- `confidence_blocked`

It does **not** calculate NB/SB/EB/WB, infer displayed direction, or create runtime confidence.

Strong candidates require valid geometry, corridor evidence, county attribution, oneway evidence, source identity, `extractionStatus: extracted`, `reviewBucket: none`, no review reasons, and no reversible/construction/HOV-HOT/fixme risk. Review-required V685 segments are preserved and are not silently promoted.

## 9. Bearing-only prohibition validation

Bearing is treated as geometry evidence only. Bearing does not create confidence and bearing-only candidates are blocked if encountered.

Recovered result:

- `bearingOnlyCandidateCount: 0`
- `bearingOnlyBlockedCount: 0`
- `bearingOnlyPolicyPass: true`

## 10. Review bucket preservation

V685 review-required segments remain review-required when they contain `extracted_with_review`, reversible lane evidence, construction evidence, HOV/HOT evidence, fixme/FIXME evidence, missing county, missing ref/fut_ref, missing oneway, or existing review reasons/buckets.

Recovered result:

- `promotedFromReviewCount: 0`
- No V685 review-required segment was promoted to strong or limited confidence.

## 11. Confidence state distribution

| Confidence state | Count |
| --- | ---: |
| `confidence_candidate_strong` | 164 |
| `confidence_candidate_limited` | 0 |
| `confidence_review_required` | 81 |
| `confidence_blocked` | 0 |

Total segments evaluated: **245**.

## 12. Consistency with V685

| Comparison | V685 | V686R | Delta |
| --- | ---: | ---: | ---: |
| Ready candidates vs V686 strong/limited | 164 | 164 | 0 |
| Review-required vs V686 review/blocked | 81 | 81 | 0 |
| Blocked vs V686 blocked | 0 | 0 | 0 |

Additional consistency checks:

- `promotedFromReviewCount: 0`
- `demotedFromReadyCount: 0`
- `newlyBlockedCount: 0`

## 13. Evidence summary

The recovered evidence JSON is written to:

`assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json`

It includes input artifact validation, detected input shapes, total evaluated segments, the independent signal model, confidence distribution, bearing-only policy, V685 consistency checks, county/highway/review-bucket distributions by confidence state, reduction signal distribution, capped samples, protected-system verification, runtime non-change flags, and final determination.

## 14. Risk review

The recovered validation is partial because review buckets remain present. This is expected and preserves V685 findings instead of converting review-required segments into confidence-ready segments.

Key preserved risks include missing county attribution, reversible lanes, construction segments, HOV/HOT lanes, missing oneway evidence, missing ref/fut_ref evidence, and fixme/FIXME tags.

## 15. Runtime/UI non-change confirmation

This milestone is offline audit-only artifact recovery. It does not change runtime application code, UI, CSS, DriveTexas behavior, Supabase, county operational status, or Transportation Intelligence flags.

Recovered evidence records:

- `runtimeChanged: false`
- `appJsChanged: false`
- `uiChanged: false`
- `driveTexasChanged: false`
- `transportationIntelligenceChanged: false`

## 16. Final determination

**CONFIDENCE VALIDATION RECOVERY PARTIAL — REASSESSMENT ALLOWED WITH REVIEW BUCKETS**

## 17. Recommended next milestone

**V687R.2 — Corridor Readiness Reassessment After V686 Recovery**

This should rerun readiness using the now-restored V686 evidence before any V688 governance work.
