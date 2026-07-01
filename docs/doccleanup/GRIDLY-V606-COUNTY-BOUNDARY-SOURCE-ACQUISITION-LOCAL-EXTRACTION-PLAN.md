# GRIDLY V606 — County Boundary Source Acquisition / Local Extraction Plan

## 1. Executive Summary

V606 defines the documentation-only operational plan for obtaining, validating, extracting, and later promoting county boundary assets for counties that remain boundary-incomplete after V605. It converts the V605 finding of **PACKAGE PARTIAL — BOUNDARY EXTRACTION REQUIRED** into a controlled local workflow that uses trusted boundary sources without committing national or statewide source datasets and without generating GIS outputs during this milestone.

The plan is designed to keep Gridly aligned with V597, V598, V599/V600, V603, V604, and V605:

- V597 established that counties cannot be activated before county-owned runtime assets exist.
- V598 fixed source/runtime leakage and reinforced that package inputs must not be confused with runtime assets.
- V599/V600 established the required county package: boundary, roads, crossings, and overrides.
- V603 established local/batched normalization for roads, crossings, and overrides.
- V604 established the county boundary extraction harness and ignored generated-staging model.
- V605 classified Montgomery as package-ready for normalization review and identified five counties that still require boundary extraction.

V606 does not perform acquisition, download source data, execute extraction, create generated GIS output, promote boundary artifacts, register runtime assets, or activate counties. It only defines the safe path to perform those activities in future milestones.

## 2. Final Determination

**BOUNDARY ACQUISITION AND EXTRACTION PATH DEFINED**

Gridly will use a local, operator-supplied boundary source and V604 extraction flow to create candidate county boundary artifacts in ignored staging for Chambers, San Jacinto, Polk, Jefferson, and Harris. The preferred source strategy is a Texas statewide county boundary source when it is small, reproducible, and authoritative enough for review; a national Census county boundary source remains acceptable only when extraction is performed locally and the national source file is not committed.

No boundary output is promoted by V606. Promotion requires a later, explicit review milestone.

## 3. Scope Controls

V606 is documentation only. It does not:

- activate any county;
- register any county into runtime;
- modify application runtime behavior;
- resume DriveTexas;
- enable Transportation Intelligence;
- enable historical reads, historical UI, historical API, or dashboard behavior;
- download boundary data;
- execute V604 extraction;
- create generated GIS outputs;
- commit generated staging output;
- commit national Census county shapefiles;
- commit Texas statewide county boundary source files; or
- classify any county as activation-ready or runtime-ready.

The only repository change in this milestone is this operational plan.

## 4. V597 Root Cause Alignment

V597 identified the root cause that Montgomery was advanced before county-owned runtime assets existed. V606 prevents repetition of that failure mode by requiring county boundary ownership to be resolved before a future county package can advance beyond partial status.

A county boundary is not an optional visual aid. It is the geographic ownership envelope that constrains county-specific package validation, review, normalization, and future runtime eligibility. Without a county-owned boundary artifact, Gridly cannot safely prove that roads, crossings, overrides, and later derived runtime assets belong to the intended county area.

For future package advancement, boundary ownership is required because it:

1. establishes the county geographic envelope before normalization review is treated as package-complete;
2. prevents source/runtime leakage by distinguishing raw source files, generated staging, promoted package artifacts, and runtime assets;
3. gives V603/V604 a stable county-level validation target;
4. prevents accidental activation based only on roads, crossings, or overrides; and
5. keeps package readiness separate from runtime activation.

V606 therefore treats missing boundaries as package blockers, not runtime errors and not activation prompts.

## 5. Current Boundary Status

| County | FIPS | Current boundary status | V606 conclusion |
| --- | --- | --- | --- |
| Montgomery | 48339 | Boundary exists. | No boundary acquisition required for current package review. |
| Chambers | 48071 | Missing. | Boundary source acquisition and V604 local extraction required. |
| San Jacinto | 48407 | Missing. | Boundary source acquisition and V604 local extraction required. |
| Polk | 48373 | Missing. | Boundary source acquisition and V604 local extraction required. |
| Jefferson | 48245 | Missing. | Boundary source acquisition and V604 local extraction required. |
| Harris | 48201 | Missing. | Boundary source acquisition and V604 local extraction required. |

## 6. Boundary Source Options

| Option | Description | Acquisition complexity | File size | Reproducibility | Long-term maintenance | Compatibility with V603/V604 |
| --- | --- | --- | --- | --- | --- | --- |
| Option A — National Census county boundary source | Use a national county boundary dataset, such as a Census county boundary shapefile or GeoJSON, supplied locally by the operator. | Medium. Source is commonly available, but national scope requires careful operator selection and version recording. | High. National files can be large and must not be committed. | High if the exact source name, vintage, checksum, and acquisition date are recorded. | Medium. National source vintages change and may exceed local county needs. | Compatible with V604 if extraction is local and filtered by correct Texas county FIPS values. V603 is unaffected. |
| Option B — Texas statewide county boundary source | Use a Texas-only statewide county boundary dataset supplied locally by the operator. | Low to medium. Statewide Texas-only scope is easier to reason about than national scope if a stable source is chosen. | Medium. Smaller than national source and less likely to trigger V602-style large-diff problems if kept out of Git. | High when source name, publisher, vintage, checksum, and acquisition date are recorded. | High. Statewide county boundaries are broad enough to support all five missing counties without per-county manual sourcing. | Strongly compatible with V604 because the harness can extract individual counties from one locally supplied Texas source. V603 is unaffected. |
| Option C — County-owned/local government source | Use boundary files published by each county or local government source. | High. Each county may publish different formats, coordinate systems, update cadences, or download paths. | Low per county, but operational overhead is higher. | Medium. Reproducibility depends on whether each county maintains stable archived versions. | Medium to low. Five separate acquisition paths increase drift and review burden. | Compatible with V604 if converted or supplied in supported form, but less uniform than a statewide source. V603 is unaffected. |

## 7. Recommended Acquisition Strategy

The preferred path is:

**Primary recommendation: Texas statewide boundary source, acquired locally and never committed.**

A Texas statewide source provides one consistent input for Chambers, San Jacinto, Polk, Jefferson, and Harris while avoiding the unnecessary repository and extraction burden of a national dataset. The operator should record publisher, source title, vintage, local filename, checksum, acquisition date, and notes in a future review artifact, but the source file itself must remain outside Git or inside an ignored local source/staging area.

**Fallback recommendation: National source with local extraction only.**

A national Census county boundary source is acceptable only if the source remains local, extraction is filtered to the target county FIPS, and the large national file is not committed. This fallback is useful when the statewide source is unavailable, questionable, or incompatible with V604.

This strategy minimizes repository bloat and prevents V602-style failures by ensuring that only small, reviewed, county-specific boundary artifacts can be considered for future promotion. Large source files remain outside committed history, generated extraction output remains ignored, and promotion is handled by a separate review milestone.

## 8. Local Extraction Workflow

Future boundary extraction should follow this sequence exactly:

1. **Acquire source locally.** The operator obtains a trusted Texas statewide boundary source, or a national source fallback, outside this milestone. V606 does not automate downloads.
2. **Record source metadata.** Capture publisher, title, vintage, local path, checksum, acquisition date, format, coordinate reference information if available, and reason for source selection in a future review note.
3. **Place source in local-only storage.** Keep the source outside Git or in an ignored local staging directory. Do not add the source file to the repository.
4. **Run V604 extraction explicitly.** Invoke the V604 county boundary extraction harness for one target county at a time using the local source and the expected county FIPS.
5. **Generate county boundary output in ignored staging.** Candidate output must be written only to the ignored generated staging path defined by V604. It is not production and is not automatically committed.
6. **Validate output.** Confirm that output is valid GeoJSON, uses the expected county FIPS/name, contains the expected geometry type, has no corrupt coordinates, and is plausibly aligned with known county adjacency.
7. **Review against package requirements.** Compare the candidate boundary with V599/V600 package expectations and V605 county status before considering promotion.
8. **Promote only through future review.** A later milestone must explicitly authorize copying a reviewed county-owned boundary artifact from staging into the committed county package boundary location.

No downloads, extraction runs, generated files, or promotions occur in V606.

## 9. Promotion Policy

Generated staging is not production.

Generated staging is not committed automatically.

Boundary promotion requires separate review.

A candidate boundary may become a committed county package artifact only after a future promotion milestone verifies:

- the source was trusted and recorded;
- the correct FIPS and county name were extracted;
- the geometry is valid and county-scoped;
- the output file is small enough for review;
- no national or statewide source file is included in the diff;
- the artifact belongs in the county package boundary directory; and
- promotion does not imply runtime activation.

## 10. County-by-County Acquisition Plan

| County | FIPS | Expected acquisition path | Expected extraction path | Promotion posture |
| --- | --- | --- | --- | --- |
| Chambers | 48071 | Use the preferred Texas statewide boundary source; use national local-only fallback if needed. | Extract one Chambers boundary candidate from the local source with V604 into ignored staging. | Future review must verify Chambers FIPS/name, coastal geometry, and package placement before promotion. |
| San Jacinto | 48407 | Use the preferred Texas statewide boundary source; use national local-only fallback if needed. | Extract one San Jacinto boundary candidate from the local source with V604 into ignored staging. | Future review must verify San Jacinto FIPS/name, adjacency, and package placement before promotion. |
| Polk | 48373 | Use the preferred Texas statewide boundary source; use national local-only fallback if needed. | Extract one Polk boundary candidate from the local source with V604 into ignored staging. | Future review must verify Polk FIPS/name, geometry validity, and package placement before promotion. |
| Jefferson | 48245 | Use the preferred Texas statewide boundary source; use national local-only fallback if needed. | Extract one Jefferson boundary candidate from the local source with V604 into ignored staging. | Future review must verify Jefferson FIPS/name, coastal geometry, and package placement before promotion. |
| Harris | 48201 | Use the preferred Texas statewide boundary source; use national local-only fallback if needed. | Extract one Harris boundary candidate from the local source with V604 into ignored staging. | Future review must verify Harris FIPS/name, geometry complexity, file size, and package placement before promotion. |

## 11. Failure Modes

| Failure mode | Risk | Required response |
| --- | --- | --- |
| Missing source | Extraction cannot run or operator attempts unsafe download automation. | Stop. Acquire source manually in a future milestone and record metadata before extraction. |
| Wrong FIPS | Boundary for the wrong county is extracted and could contaminate a package. | Reject output. Re-run extraction with verified Texas county FIPS and county name checks. |
| Geometry mismatch | Output does not match expected county shape, adjacency, or geometry type. | Keep output in staging, mark validation failed, and require source or extraction review. |
| Large source files | National or statewide files create V602-style repository bloat if tracked. | Keep source outside Git or in ignored local staging; verify `git status --short` before commit. |
| Corrupt GeoJSON | Candidate output cannot be parsed or has invalid coordinate/feature structure. | Reject output and rerun extraction after source/tooling inspection. |
| Git tracking mistakes | Source or generated staging files are accidentally added. | Remove from index before commit, confirm ignore policy, and commit only reviewed documentation or explicitly promoted artifacts. |
| Ambiguous source vintage | Reviewers cannot reproduce the boundary. | Require publisher, title, vintage, checksum, and acquisition date before promotion review. |
| County/local source inconsistency | Local government source differs from statewide source without explanation. | Escalate to review; do not promote until source authority and intended boundary standard are documented. |

## 12. V602 Protection Strategy

V606 avoids the V602 large-diff problem through strict separation of source, staging, promotion, and runtime concerns:

- **No large source commits.** National and Texas statewide boundary sources must not be committed.
- **No generated output in this milestone.** V606 does not execute extraction and does not create GIS files.
- **Ignored staging only.** Future V604 extraction output must remain in ignored generated staging until a separate review milestone authorizes promotion.
- **One county at a time.** Future extraction should run per county to keep diffs and validation scope small.
- **Small promotion diffs.** Only reviewed, county-specific boundary artifacts may be considered for committed package placement.
- **Git checks before commit.** Operators must run `git status --short` and confirm that no national/state source file or generated staging output is tracked.
- **No Codex extraction requirement.** Codex does not need to download, parse, or commit large GIS datasets in V606; this prevents extraction failures caused by oversized files or large diffs.

## 13. Future Readiness Path

The approved package-readiness movement is:

**Boundary Missing → Boundary Extracted → Boundary Validated → Package Ready For Normalization Review**

Definitions:

- **Boundary Missing** — no committed county boundary artifact exists for the county package.
- **Boundary Extracted** — V604 has produced a candidate boundary in ignored staging from a trusted local source.
- **Boundary Validated** — the candidate has passed future boundary validation checks and source metadata review.
- **Package Ready For Normalization Review** — the reviewed boundary is promoted into the county package and the county has the full V599/V600 package set: boundary, roads, crossings, and overrides.

This path deliberately stops at package review readiness. It does not define activation steps, runtime registration, runtime loading, Transportation Intelligence, DriveTexas resumption, or historical UI/reads.

## 14. Protected Boundary Verification

V606 verifies the protected boundaries as follows:

| Protected boundary | V606 verification |
| --- | --- |
| Do not activate counties. | No activation step is defined or executed. |
| Do not register counties into runtime. | No runtime registry file is modified. |
| Do not modify app runtime behavior. | This milestone changes documentation only. |
| Do not resume DriveTexas. | DriveTexas is not referenced as an executable workstream. |
| Do not enable Transportation Intelligence. | No Transportation Intelligence capability is enabled. |
| Do not enable historical reads/UI. | No historical reads, UI, API, or dashboard behavior is changed. |
| Do not commit national county shapefiles. | The plan explicitly forbids committing national source files. |
| Do not create generated GIS outputs. | V606 does not run extraction or create output. |
| Do not download data during this milestone. | The acquisition workflow is future/local/operator-supplied and non-automated. |
| Do not cross into county activation. | The readiness path stops at package normalization review readiness. |

## 15. Recommended Next Milestone

**V607 — Boundary Validation and Promotion Readiness Standard**

V607 should define the validation checks, source metadata requirements, acceptable GeoJSON structure, file-size expectations, FIPS/name verification, review evidence, and promotion checklist for moving a candidate county boundary from ignored V604 staging into the committed county package boundary directory.

V607 should remain separate from county activation. Its goal should be promotion readiness only, not runtime registration or activation.
