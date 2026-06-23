# GRIDLY V686 — OSM Confidence Validation Prototype

## 1. Mission alignment

Gridly remains **“Know Before You Go.”** V686 is an offline, audit-only confidence validation prototype for the US59/I69 OSM extraction outputs. The product posture remains:

- Awareness Platform First
- Route Intelligence Second

V686 does not activate directional intelligence, route intelligence, UI labels, runtime loading, DriveTexas, or Transportation Intelligence.

## 2. Protected-system verification

Protected systems remain unchanged and are explicitly recorded in the V686 evidence artifact:

| Protected system | Required value | V686 value |
|---|---:|---:|
| historicalReadsEnabled | false | false |
| historyUiEnabled | false | false |
| DriveTexasPaused | true | true |
| TransportationIntelligenceEnabled | false | false |
| TransportationIntelligenceDisplay | false | false |
| TransportationIntelligenceActivation | false | false |

Runtime and UI change flags are also recorded as false:

- `runtimeChanged: false`
- `appJsChanged: false`
- `uiChanged: false`
- `driveTexasChanged: false`
- `transportationIntelligenceChanged: false`

## 3. V683/V684/V685 dependency summary

V686 depends on the prior directional-intelligence audit chain:

- **V683:** `METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS`
- **V684:** offline extraction prototype generated the US59/I69 corridor and segment inventories plus extraction evidence.
- **V685:** `EXTRACTION VALIDATION PARTIAL — CONFIDENCE VALIDATION ALLOWED WITH REVIEW BUCKETS`

V685 readiness summary used by V686:

| V685 readiness state | Count |
|---|---:|
| confidence_ready_candidate | 164 |
| confidence_review_required | 81 |
| confidence_blocked | 0 |

## 4. Validation input paths

V686 reads these offline artifacts only:

- `assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json`
- `assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json`
- `assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json`

V686 writes machine-readable evidence to:

- `assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json`

## 5. Explicit non-goals

V686 does **not**:

- modify `js/app.js`
- modify `index.html`
- modify CSS
- add runtime loading
- add UI
- add directional labels
- add NB/SB/EB/WB display
- infer or display NB/SB/EB/WB to users
- connect to Route Watch
- connect to Alerts
- connect to Awareness
- resume DriveTexas
- enable Transportation Intelligence
- change county operational status
- change Supabase
- introduce frameworks

## 6. Confidence validation method

The prototype validates input existence and JSON parse status, detects the segment inventory shape, then evaluates each extracted segment with an independent signal model. The script safely supports segment inventory as either a top-level array or an object containing a segment array.

Detected V686 input shapes:

| Artifact | Shape |
|---|---|
| V684 segment inventory | array |
| V684 evidence | object |
| V685 evidence | object |

Total segments evaluated: **245**.

## 7. Independent signal model

### Core signals

- valid geometry summary
- corridor evidence
- county attribution
- oneway evidence

### Supporting signals

- lanes
- turn:lanes
- destination:lanes
- strategic tags such as `Texas_Trunk_System`, `NHS`, `hgv:national_network`
- source identity / OSM way id

### Risk / reduction signals

- reversible lane
- `oneway:conditional` containing `-1`
- construction segment
- HOV/HOT lane
- fixme/FIXME tags
- missing county
- missing oneway
- missing `ref` / `fut_ref`
- missing geometry
- rejected extraction status

## 8. Confidence state model

V686 assigns only confidence validation states. It does **not** calculate or infer NB/SB/EB/WB direction.

Allowed states:

- `confidence_candidate_strong`
- `confidence_candidate_limited`
- `confidence_review_required`
- `confidence_blocked`

Classification posture:

- Strong candidates require valid geometry, corridor evidence, county attribution, oneway evidence, source identity, no review reasons, no reduction risks, and extracted status.
- Limited candidates require valid geometry, corridor evidence, oneway evidence, source identity, and no blocking/review risk, but may have reduced supporting metadata.
- Review-required segments include V685 review segments and segments with review risks such as construction, HOV/HOT, reversible lane, missing county, missing ref, missing oneway, or fixme evidence.
- Blocked segments include rejected segments, invalid geometry, non-primary corridor, missing source identity, or bearing/geometry-only evidence.

## 9. Bearing-only prohibition validation

Bearing remains geometry evidence only. Bearing is never sufficient by itself to produce confidence.

| Bearing-only policy metric | Count / result |
|---|---:|
| bearingOnlyCandidateCount | 0 |
| bearingOnlyBlockedCount | 0 |
| bearingOnlyPolicyPass | true |

No bearing-only candidates were found. The policy passed because any bearing-only candidate would be forced to `confidence_blocked`.

## 10. Review bucket preservation

V686 preserves caution from V685. V685 review-required records are not silently promoted to strong confidence. In the available V685 capped sample IDs, V686 recorded:

- `promotedFromReviewCount: 0`
- `demotedFromReadyCount: 0`
- `newlyBlockedCount: 0`

## 11. Confidence state results

| V686 confidence validation state | Count |
|---|---:|
| confidence_candidate_strong | 164 |
| confidence_candidate_limited | 0 |
| confidence_review_required | 81 |
| confidence_blocked | 0 |

Candidate total: **164**. Review/blocked total: **81**.

## 12. Consistency with V685

| Comparison | V685 | V686 |
|---|---:|---:|
| Ready/candidate count | 164 | 164 |
| Review-required vs review-or-blocked count | 81 | 81 |
| Blocked count | 0 | 0 |

Additional consistency metrics:

- `alignedCount: 20`
- `promotedFromReviewCount: 0`
- `demotedFromReadyCount: 0`
- `newlyBlockedCount: 0`

Note: V685 stores capped readiness sample IDs, so per-record alignment is calculated against available sample IDs while count-level consistency uses V685 distributions.

## 13. Evidence distribution summary

### County distribution by confidence state

| Confidence state | County | Count |
|---|---|---:|
| confidence_candidate_strong | Harris, TX | 61 |
| confidence_candidate_strong | Montgomery, TX | 74 |
| confidence_candidate_strong | Liberty, TX | 28 |
| confidence_candidate_strong | San Jacinto, TX | 1 |
| confidence_review_required | __MISSING__ | 56 |
| confidence_review_required | San Jacinto, TX | 4 |
| confidence_review_required | Liberty, TX | 3 |
| confidence_review_required | Montgomery, TX | 18 |

### Highway distribution by confidence state

| Confidence state | Highway | Count |
|---|---|---:|
| confidence_candidate_strong | motorway | 162 |
| confidence_candidate_strong | secondary_link | 2 |
| confidence_review_required | motorway | 71 |
| confidence_review_required | construction | 7 |
| confidence_review_required | secondary | 1 |
| confidence_review_required | tertiary | 2 |

### Review bucket distribution by confidence state

| Confidence state | Review bucket | Count |
|---|---|---:|
| confidence_candidate_strong | none | 164 |
| confidence_review_required | missing_county | 36 |
| confidence_review_required | construction_segment | 8 |
| confidence_review_required | missing_oneway | 3 |
| confidence_review_required | hov_hot_lane | 10 |
| confidence_review_required | reversible_lane | 7 |
| confidence_review_required | manual_review_required | 17 |

### Reduction signal distribution

| Reduction signal | Count |
|---|---:|
| missing_county | 56 |
| construction_segment | 8 |
| missing_oneway | 3 |
| hov_hot_lane | 17 |
| reversible_lane | 7 |
| oneway_conditional_negative_one | 7 |
| fixme_tags | 17 |

## 14. Risk review

Primary confidence risks remain concentrated in review buckets rather than blocked buckets:

- Missing county attribution remains the largest reduction signal.
- HOV/HOT and fixme tags require human review before any future confidence governance.
- Reversible and `oneway:conditional=-1` records remain review-required.
- Construction segments remain review-required.
- No segment is approved for runtime directional display by V686.

## 15. Runtime/UI non-change confirmation

V686 is offline audit evidence only. It creates a script, documentation, and machine-readable evidence. It does not load the evidence at runtime and does not change UI behavior.

Confirmed non-change flags:

- `runtimeChanged: false`
- `appJsChanged: false`
- `uiChanged: false`
- `driveTexasChanged: false`
- `transportationIntelligenceChanged: false`

## 16. Final determination

**CONFIDENCE VALIDATION PARTIAL — CORRIDOR READINESS ASSESSMENT ALLOWED WITH REVIEW BUCKETS**

Rationale: V686 found 164 strong confidence candidates, preserved 81 review-required records, found no blocked records, passed the bearing-only policy, and remained consistent with the V685 readiness distribution. Review buckets must remain active for future governance.

## 17. Recommended next milestone

**V687 — OSM Corridor Readiness Assessment**

V687 should assess whether the US59/I69 corridor inventory is ready for future non-runtime readiness governance using V684, V685, and V686 evidence. V687 should remain offline and should not activate runtime directional intelligence, directional display, DriveTexas, or Transportation Intelligence.
