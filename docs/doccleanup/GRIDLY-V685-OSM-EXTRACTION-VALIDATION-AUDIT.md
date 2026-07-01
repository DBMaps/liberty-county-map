# GRIDLY V685 — OSM Extraction Validation Audit

## 1. Mission alignment

Gridly remains **Know Before You Go**. V685 preserves the product posture of **Awareness Platform First** and **Route Intelligence Second** by validating V684's offline extracted OSM inventory before any confidence scoring, runtime loading, route intelligence behavior, or user-facing display is considered.

## 2. Protected-system verification

V685 is audit-only and records the protected systems as unchanged:

| Protected system | Verified value |
|---|---:|
| `historicalReadsEnabled` | `false` |
| `historyUiEnabled` | `false` |
| `DriveTexasPaused` | `true` |
| `TransportationIntelligenceEnabled` | `false` |
| `TransportationIntelligenceDisplay` | `false` |
| `TransportationIntelligenceActivation` | `false` |

The V685 evidence also records `runtimeChanged: false`, `appJsChanged: false`, `uiChanged: false`, `driveTexasChanged: false`, and `transportationIntelligenceChanged: false`.

## 3. V683/V684 dependency summary

- V683 dependency: **METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS**.
- V684 dependency: offline OSM extraction prototype artifacts were generated for corridor inventory, segment inventory, and prototype evidence.
- V685 does not override V683 or V684. It validates whether the V684 output is structurally usable and safely bucketed for a future offline confidence validation prototype.

## 4. Validation input paths

V685 reads these existing V684 artifacts:

- `assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json`
- `assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json`
- `assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json`

V685 writes machine-readable evidence to:

- `assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json`

## 5. Explicit non-goals

V685 does **not**:

- Modify `js/app.js`, `index.html`, or CSS.
- Add runtime loading.
- Add UI.
- Add directional labels.
- Add NB/SB/EB/WB display.
- Connect to Route Watch, Alerts, Awareness, Supabase, DriveTexas, or Transportation Intelligence.
- Resume DriveTexas.
- Enable Transportation Intelligence.
- Change county operational status.
- Introduce frameworks.
- Calculate final directional confidence.

## 6. Validation method

The validation script `tools/directional-intelligence/v685-osm-extraction-validation-audit.mjs` performs offline checks only:

1. Confirms required V684 inputs exist.
2. Parses all inputs as JSON.
3. Detects corridor and segment inventory shapes.
4. Validates corridor identity, segment IDs, source traceability, geometry summary structure, corridor membership signals, county evidence, review bucket consistency, rejection correctness, extraction statuses, and evidence signal coverage.
5. Classifies records into confidence-prerequisite readiness groups without calculating confidence.
6. Writes the V685 JSON evidence artifact.

## 7. Detected input shapes

| Artifact | Detected shape | Result |
|---|---|---|
| Segment inventory | `array` | Supported |
| Corridor inventory | `array` | Supported |
| Corridor ID | `us59-i69` found | Pass |

## 8. Segment inventory integrity results

| Metric | Count |
|---|---:|
| Total segments | 245 |
| `extracted` segments | 164 |
| `extracted_with_review` segments | 81 |
| `rejected` segments | 0 |
| Non-rejected missing `segmentId` | 0 |
| Unique `segmentId` values | 245 |
| Duplicate `segmentId` values | 0 |
| Preserved `sourceWayId` values | 245 |
| Duplicate `sourceWayId` groups | 0 |

Segment inventory is structurally usable. Stable segment IDs are present for every non-rejected segment, all segment IDs are unique, and every record preserves a source way ID.

## 9. Source traceability results

| Traceability check | Count | Percent |
|---|---:|---:|
| `sourceWayId` present | 245 | 100% |
| Source identity present through `sourceRef`, `sourceFutureRef`, `sourceName`, or `sourceTigerNameBase` | 245 | 100% |
| `geometrySummary` present | 245 | 100% |

Source traceability is strong enough for future offline confidence validation, subject to existing review buckets.

## 10. Geometry validation results

| Geometry check | Count |
|---|---:|
| Valid geometry summaries | 245 |
| Invalid geometry summaries | 0 |
| `coordinateCount >= 2` | 245 |
| `startCoordinate` present | 245 |
| `endCoordinate` present | 245 |
| `bbox` present | 245 |
| `approximateBearingDegrees` present when geometry is valid | 245 |

Bearing is validated only as a geometry-derived audit field. V685 does not treat bearing as standalone directional confidence.

## 11. Corridor membership validation results

| Corridor membership check | Count |
|---|---:|
| Accepted primary-corridor segments | 245 |
| Rejected non-primary-corridor segments | 0 |
| Suspicious accepted segments with weak corridor evidence | 0 |
| Suspicious rejected segments with possible corridor evidence | 0 |

V685 found US 59 / I-69 corridor membership evidence across accepted extracted segments. No rejected records exist in the V684 inventory.

## 12. County containment validation results

Expected nearby county names for this evidence-only milestone are `Liberty, TX`, `Montgomery, TX`, `San Jacinto, TX`, and `Harris, TX`.

| County evidence | Count |
|---|---:|
| County preserved | 189 |
| Missing county | 56 |
| Unknown county | 0 |
| Multi-county ambiguity | 0 |

County distribution:

| County bucket | Count |
|---|---:|
| `Montgomery, TX` | 92 |
| `Harris, TX` | 61 |
| `Liberty, TX` | 31 |
| `San Jacinto, TX` | 5 |
| `__MISSING__` | 56 |

Harris and San Jacinto appearances are evidence only. V685 does not activate, onboard, or operationalize any county.

## 13. Review bucket validation results

| Review bucket metric | Count |
|---|---:|
| Correctly bucketed records | 225 |
| Questionable bucket records | 20 |

Bucket distribution:

| Review bucket | Count |
|---|---:|
| `none` | 164 |
| `missing_county` | 36 |
| `manual_review_required` | 17 |
| `hov_hot_lane` | 10 |
| `construction_segment` | 8 |
| `reversible_lane` | 7 |
| `missing_oneway` | 3 |

The questionable bucket findings are not structural failures. They are records where one primary bucket is present but additional review reasons also apply, such as `missing_county` coexisting with `missing_oneway`, `hov_hot_lane`, or `reversible_lane`. These records should remain in review buckets for V686.

## 14. Rejection validation results

| Rejection check | Count |
|---|---:|
| Rejected records | 0 |
| Correct rejections | 0 |
| Questionable rejections | 0 |

No V684 records were rejected, so V685 found no rejection inconsistency.

## 15. Evidence signal validation results

| Evidence signal check | Count |
|---|---:|
| Records with `evidenceSignals` | 245 |
| Missing expected boolean signal coverage | 0 |

Expected signal fields checked: `hasRef`, `hasFutureRef`, `hasName`, `hasCounty`, `hasOneway`, `hasOnewayConditional`, `hasLanes`, `hasTurnLanes`, `hasDestinationLanes`, `hasStrategicTags`, `hasGeometry`, `isReversible`, `isConstruction`, `isHovHot`, and `hasFixme`.

## 16. Confidence-prerequisite readiness results

V685 does not calculate final confidence. It only classifies readiness for a future offline prototype.

| Readiness group | Count |
|---|---:|
| `confidence_ready_candidate` | 164 |
| `confidence_review_required` | 81 |
| `confidence_blocked` | 0 |

Ready candidates have extracted status, valid geometry, corridor evidence, county evidence, oneway evidence, and no reversible, construction, HOV/HOT, or fixme flags. Review-required records remain eligible only for future offline review handling. No record is blocked by V685 structural validation.

## 17. Risk review

Key risks retained for V686:

- **Review-bucket complexity:** 20 records have multiple review conditions represented by a single primary bucket. V686 should preserve the full `reviewReasons` array and not rely only on `reviewBucket`.
- **Missing county evidence:** 56 records lack county values and must remain review-gated for confidence work.
- **Managed/reversible/construction semantics:** HOV/HOT, reversible, construction, and fixme records remain unsuitable for automatic confidence without deeper review.
- **Bearing misuse risk:** Approximate bearing is present for all valid geometries but must remain geometry-only evidence, never a standalone directional claim.

## 18. Runtime/UI non-change confirmation

V685 created an offline audit script, an offline evidence JSON file, and this markdown audit document only. It did not modify runtime files, UI files, CSS, `js/app.js`, DriveTexas code paths, Transportation Intelligence code paths, Supabase integration, county operational status, or framework dependencies.

## 19. Final determination

**EXTRACTION VALIDATION PARTIAL — CONFIDENCE VALIDATION ALLOWED WITH REVIEW BUCKETS**

Rationale: V684 extraction is structurally usable with strong IDs, traceability, geometry summaries, corridor evidence, and evidence signal coverage. However, 81 records require review and 20 records have bucket/reason combinations that should be explicitly handled in the next offline prototype. Confidence validation may proceed only with review buckets preserved.

## 20. Recommended next milestone

**V686 — OSM Confidence Validation Prototype**

V686 should use validated extracted segments to test the confidence model without runtime/UI integration, without DriveTexas activation, and without Transportation Intelligence activation.
