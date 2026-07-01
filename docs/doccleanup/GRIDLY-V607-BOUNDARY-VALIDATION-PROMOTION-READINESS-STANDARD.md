# GRIDLY V607 — Boundary Validation and Promotion Readiness Standard

## 1. Executive Summary

V607 defines the documentation-only standard for deciding when a locally extracted county boundary candidate is valid enough to be considered promotion-ready for the County Asset Program. It applies after a boundary source has been acquired locally and after V604-style extraction has produced a candidate in ignored generated staging, but before any file is copied into a committed county-owned boundary artifact path.

This milestone does not validate a real candidate boundary, does not run extraction, does not create generated GIS output, and does not promote any boundary file. It creates the review standard future milestones must satisfy before moving a staged boundary candidate into:

`assets/county-implementation/<county>/boundary/<county>-county-boundary.geojson`

V607 keeps boundary promotion separate from runtime activation. A promoted county-owned boundary artifact is a package asset only; it does not activate a county, register runtime assets, enable Transportation Intelligence, resume DriveTexas, or enable historical reads/UI.

## 2. Final Determination

**BOUNDARY VALIDATION AND PROMOTION STANDARD DEFINED**

Gridly now has a documented validation and promotion readiness standard for county boundary artifacts. Future boundary promotion must prove that a locally extracted candidate is valid GeoJSON, county-specific, FIPS/name aligned, geometry-safe, source-documented, review-approved, and free of national/statewide source leakage before it can be copied from ignored staging into the committed county-owned boundary artifact path.

No county boundary is promoted by V607. No county is activated by V607.

## 3. Scope Controls

V607 is documentation only. It does not:

- activate any county;
- register any county into runtime;
- modify application runtime behavior;
- resume DriveTexas;
- enable Transportation Intelligence;
- enable historical reads, historical UI, historical API, or dashboard behavior;
- download boundary data;
- extract GIS data;
- create generated GIS outputs;
- promote any boundary files;
- commit national boundary sources;
- commit statewide boundary sources;
- commit ignored generated staging output; or
- classify any county as activation-ready or runtime-ready.

The only repository change in this milestone is this standard document.

## 4. V597 Root Cause Alignment

V597 identified the failure mode of advancing county work before county-owned runtime assets existed. V607 addresses that root cause by creating a strict package-asset gate for county boundaries before any later package completion or runtime milestone can rely on a boundary.

The standard prevents repetition of the V597 failure mode by requiring these separations:

1. **Raw source is not a package artifact.** National, statewide, or county source files remain local/operator-supplied inputs unless a later milestone explicitly approves otherwise.
2. **Generated staging is not production.** Extracted candidates in ignored staging are review inputs only.
3. **Promotion is not activation.** Copying a reviewed county-specific boundary into the county package path does not register runtime assets or activate a county.
4. **County ownership must be proven.** The promoted artifact must be a county-specific boundary with expected FIPS/GEOID and name evidence.
5. **Runtime behavior remains protected.** Boundary readiness cannot be used to bypass normalization review, runtime registration review, or activation controls.

## 5. Relationship to V604, V605, and V606

V607 depends on but does not supersede V604, V605, or V606:

- **V604 — County Boundary Extraction Harness** defines the local harness pattern, committed-boundary validation behavior, and ignored generated staging model for candidate boundary output.
- **V605 — County Package Readiness Matrix** identifies Montgomery as package-ready for normalization review and identifies Chambers, San Jacinto, Polk, Jefferson, and Harris as package partial because boundary extraction remains required.
- **V606 — County Boundary Source Acquisition / Local Extraction Plan** defines the local source acquisition and extraction path, while explicitly deferring boundary promotion to a later standard.

V607 fills that deferred gap. It defines when a staged boundary candidate may be called validated, when it may be called promotion-ready, and what evidence must accompany a future promotion. It does not perform the V604 extraction work and does not change any V605 county status.

## 6. Boundary Lifecycle States

| State | Definition | Git posture | Allowed next movement |
| --- | --- | --- | --- |
| Missing | No committed county boundary artifact exists for the county package. | No boundary artifact is tracked for that county. | Acquire source locally and prepare for extraction. |
| Source Acquired Locally | A trusted operator-supplied boundary source is available outside Git or in an ignored local source area. | Source must remain untracked. National/statewide source files must not be committed. | Run extraction locally in a future authorized milestone. |
| Extracted to Ignored Staging | A candidate county boundary has been generated from the local source into ignored staging. | Candidate remains untracked unless a future promotion milestone explicitly copies a reviewed county-specific artifact to the county package path. | Validate structure, metadata, county identity, and Git safety. |
| Validated | Candidate satisfies all V607 validation requirements and has documented validation output. | Candidate may still remain in ignored staging. Validation alone does not imply commit eligibility. | Complete source provenance, command evidence, reviewer approval, and promotion path review. |
| Promotion-Ready | Candidate satisfies validation requirements and all promotion requirements, including reviewer approval and target path confirmation. | Only the county-specific promoted artifact may be committed in a future promotion milestone. | Copy to the county-owned boundary artifact path only when explicitly authorized. |
| Promoted County-Owned Boundary Artifact | Reviewed county-specific boundary exists at the committed county package boundary path. | Tracked as a package asset under `assets/county-implementation/<county>/boundary/`. | Package normalization review may consider the county boundary present; runtime activation still requires separate authorization. |

## 7. Validation Requirements

A staged county boundary candidate is **Validated** only when every requirement below passes and the result is documented:

1. **Valid GeoJSON.** The file must parse as GeoJSON without syntax errors, truncation, invalid JSON tokens, or encoding corruption.
2. **FeatureCollection.** The root object must be a GeoJSON `FeatureCollection`.
3. **At least one feature.** The `features` array must exist and contain one or more features.
4. **Polygon or MultiPolygon only.** Every feature geometry must be `Polygon` or `MultiPolygon`; `Point`, `LineString`, `MultiPoint`, `MultiLineString`, `GeometryCollection`, and null geometries are rejected.
5. **Expected FIPS/GEOID match.** The candidate must expose or be traceable to the expected county FIPS/GEOID for the target county. Acceptable property names may vary by source, but the evidence must show the target FIPS exactly.
6. **County name match when available.** When the source includes a county name property, it must match the expected county name with documented normalization for case, punctuation, or suffix differences.
7. **Non-empty coordinate arrays.** All polygon rings must contain coordinates. Empty coordinate arrays, empty rings, or missing coordinate arrays are invalid.
8. **No mixed-county boundary features.** The candidate must not include multiple counties, statewide dissolved features, national boundaries, neighboring counties, or unrelated administrative regions.
9. **No national/statewide source committed.** Validation must confirm that raw national or statewide source files are not part of the tracked diff.
10. **Generated staging ignored by Git.** Validation must confirm that generated staging output remains ignored/untracked unless a future promotion milestone intentionally copies the reviewed county-specific artifact to the approved county boundary path.

A candidate that fails any requirement is not validated and must remain out of the committed county boundary artifact path.

## 8. Promotion Requirements

A validated candidate becomes **Promotion-Ready** only when all promotion requirements below are satisfied:

1. **Source provenance documented.** Evidence must include source publisher, source title, source vintage or publication date when available, local filename/path used during extraction, acquisition date, checksum when practical, and why the source is acceptable.
2. **Extraction command documented.** The exact command used to produce the staged candidate must be recorded, including county identifier, expected FIPS/GEOID, source path, and output path.
3. **Validation output documented.** The exact validation command and result must be recorded, including any warnings, normalized property names, and reviewer notes.
4. **Reviewer approval documented.** A reviewer must explicitly approve the candidate for promotion as a county package artifact. Approval must state that promotion is not runtime activation.
5. **Promoted file path matches the required pattern.** The only approved committed path is `assets/county-implementation/<county>/boundary/<county>-county-boundary.geojson`.
6. **Promoted file is county-specific.** The promoted artifact must contain only the target county boundary. Statewide, national, dissolved multi-county, or raw source files are never promotion-ready.

Promotion-ready status authorizes only a future, explicit promotion change. It does not authorize county activation or runtime registration.

## 9. Failure Classifications

| Classification | Meaning | Required response |
| --- | --- | --- |
| BLOCKED_SOURCE_MISSING | No trusted local source is available or source provenance is insufficient. | Stop. Acquire or document a source in a future milestone before extraction or promotion. |
| BLOCKED_EXTRACTION_FAILED | Extraction did not produce a candidate boundary in ignored staging. | Keep all outputs unpromoted; inspect source/tooling and rerun only in an authorized extraction milestone. |
| BLOCKED_INVALID_GEOJSON | Candidate cannot be parsed as valid GeoJSON or is not a FeatureCollection with at least one feature. | Reject candidate and regenerate after source/tooling review. |
| BLOCKED_FIPS_MISMATCH | Candidate FIPS/GEOID does not match the expected target county. | Reject candidate; verify county mapping and extraction filters. |
| BLOCKED_GEOMETRY_INVALID | Candidate geometry is empty, unsupported, mixed-county, corrupt, or otherwise not county boundary geometry. | Reject candidate; investigate source geometry and extraction logic. |
| BLOCKED_GIT_TRACKING_RISK | Raw source, national/statewide files, or generated staging output appear in the tracked diff. | Stop and remove unsafe files from tracking before any commit. |
| PROMOTION_READY | Candidate passed validation and all promotion evidence/reviewer requirements. | A future promotion milestone may copy only the county-specific artifact to the approved path. |

## 10. County-by-County Current Status

| County | FIPS | Current status | V607 promotion posture |
| --- | --- | --- | --- |
| Montgomery | 48339 | PACKAGE READY FOR NORMALIZATION REVIEW | Existing boundary remains a package artifact for normalization review. V607 does not re-promote or activate Montgomery. |
| Chambers | 48071 | PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED | Not promotion-ready. Requires local source, extraction to ignored staging, validation evidence, and reviewer approval in future milestones. |
| San Jacinto | 48407 | PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED | Not promotion-ready. Requires local source, extraction to ignored staging, validation evidence, and reviewer approval in future milestones. |
| Polk | 48373 | PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED | Not promotion-ready. Requires local source, extraction to ignored staging, validation evidence, and reviewer approval in future milestones. |
| Jefferson | 48245 | PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED | Not promotion-ready. Requires local source, extraction to ignored staging, validation evidence, and reviewer approval in future milestones. |
| Harris | 48201 | PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED | Not promotion-ready. Requires local source, extraction to ignored staging, validation evidence, and reviewer approval in future milestones. |

No V607 status changes are made for any county.

## 11. Required Evidence Package for Future Boundary Promotion

A future promotion milestone must include an evidence package containing:

- target county name and FIPS/GEOID;
- current lifecycle state before promotion;
- source publisher, title, vintage/date, acquisition date, local source path, and checksum when practical;
- source scope confirmation showing whether the source was county-specific, Texas statewide, or national;
- confirmation that raw national/statewide source files are not committed;
- exact extraction command;
- generated staging output path;
- exact validation command and validation result;
- GeoJSON structure summary, including root type, feature count, geometry types, and coordinate non-empty result;
- FIPS/GEOID and county-name match evidence;
- mixed-county exclusion evidence;
- Git status evidence showing generated staging and raw source files are not tracked;
- proposed promoted path;
- reviewer approval statement; and
- explicit statement that promotion does not activate the county or alter runtime behavior.

## 12. V602 Large-Diff Protection Strategy

V607 preserves the V602 large-diff protection strategy by requiring source, staging, and promotion separation:

- national boundary sources must not be committed;
- statewide boundary sources must not be committed;
- generated staging output must remain ignored until a future promotion milestone intentionally copies a reviewed county-specific artifact;
- promotion diffs must contain only the county-specific boundary artifact and supporting review documentation authorized for that milestone;
- extraction should remain one county at a time to keep review scope small;
- future promotion evidence must include `git status --short` output to prove unsafe source/staging files are not tracked; and
- any large or unexpected GIS file in the diff is a BLOCKED_GIT_TRACKING_RISK condition.

## 13. Protected Boundary Verification

| Protected boundary | V607 verification |
| --- | --- |
| Do not activate counties. | No activation step is defined or executed. |
| Do not register counties into runtime. | No runtime registry file is modified. |
| Do not modify app runtime behavior. | This milestone changes documentation only. |
| Do not resume DriveTexas. | DriveTexas is not resumed or connected to boundary promotion. |
| Do not enable Transportation Intelligence. | No Transportation Intelligence capability is enabled. |
| Do not enable historical reads/UI. | No historical reads, UI, API, or dashboard behavior is changed. |
| Do not download data. | V607 does not download boundary data. |
| Do not extract GIS data. | V607 does not run extraction. |
| Do not create generated GIS outputs. | V607 creates no GIS output. |
| Do not promote any boundary files. | V607 defines promotion readiness only and promotes no files. |
| Keep V597 protections intact. | Promotion remains separate from runtime activation and county ownership must be proven before package advancement. |
| Keep V602 protections intact. | Large source files and generated staging are excluded from committed diffs. |

## 14. Recommended Next Milestone

**V608 — Boundary Promotion Evidence Template**

V608 should create a reusable evidence template for future county boundary promotion reviews. The template should capture source provenance, extraction command, validation output, reviewer approval, target path, Git tracking safety, and protected-boundary confirmation without performing extraction, promotion, runtime registration, or county activation.
