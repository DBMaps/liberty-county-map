# V797 County Runtime Source Path Correction

## Certification Summary

V797 corrects active county runtime source reporting so Jefferson activation cannot present Liberty boundary or road package paths as Jefferson runtime sources.

## Certified Behavior

- Active Jefferson runtime sources report `countyId: jefferson-tx`.
- Jefferson boundary reporting resolves to the statewide Texas county boundary payload used by the active Jefferson boundary overlay.
- Jefferson crossing reporting remains Jefferson-owned.
- Jefferson road reporting is `null` until a loadable Jefferson GeoJSON road source is registered.
- Liberty runtime source behavior remains unchanged.
- The boundary overlay audit distinguishes runtime source ownership, boundary ownership, and active runtime boundary/road/crossing paths.

## Evidence

Structured evidence is recorded in `docs/certifications/evidence/V797-county-runtime-source-path-correction.json`.

## Validation

- `node tests/county-runtime/v797CountyRuntimeSourcePathCorrection.test.js`
- `node tests/county-runtime/v796CountyRuntimeSourceActivation.test.js`

## Final Determination

`PASS_V797_COUNTY_RUNTIME_SOURCE_PATH_CORRECTION`
