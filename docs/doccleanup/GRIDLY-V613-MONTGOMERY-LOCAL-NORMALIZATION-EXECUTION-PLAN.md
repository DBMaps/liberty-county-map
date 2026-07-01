# GRIDLY V613 — Montgomery Local Normalization Execution Plan

## 1. Executive Summary

V613 creates the first execution-focused planning package for a possible future Montgomery local normalization run. It translates the V610 readiness determination and the V612 execution-readiness checklist into a concrete, ordered workflow that could be followed only if a later milestone separately approves normalization execution.

This milestone is planning only. It does not execute normalization, generate normalized outputs, run GIS conversion, modify source assets, activate Montgomery, register Montgomery into runtime, or modify runtime behavior.

The plan preserves the local-only posture established by prior milestones and keeps generated output handling separate from committed package assets unless a future milestone explicitly authorizes artifact promotion.

## 2. Final Determination

**LOCAL NORMALIZATION EXECUTION PLAN DEFINED**

V613 defines the future local execution workflow, proposed staging structure, validation requirements, rollback strategy, failure conditions, and V602 protection strategy for Montgomery normalization.

This determination does not authorize execution. It only defines the workflow that a later approved execution milestone would use.

## 3. Scope Controls

V613 is limited to documenting a future Montgomery local normalization execution plan.

V613 does not:

- execute normalization;
- normalize roads;
- normalize crossings;
- generate normalized outputs;
- generate staged outputs;
- run GIS conversion;
- create validation reports;
- create conversion logs;
- activate Montgomery;
- register Montgomery into runtime;
- modify runtime behavior;
- modify, replace, delete, or rewrite source assets;
- promote generated artifacts;
- resume DriveTexas;
- enable Transportation Intelligence; or
- enable historical reads, historical UI, historical API, dashboard behavior, or related data behavior.

The only intended repository change for V613 is this documentation file.

## 4. Relationship to V603–V612

| Milestone | Relationship to V613 |
| --- | --- |
| V603 | Provides the passing validation context for Montgomery roads, crossings, and overrides. V613 requires future execution to preserve V603 validation expectations before any promotion can be considered. |
| V604 | Provides the passing committed-boundary validation context. V613 requires future execution planning to keep boundary validation passing and separate from normalization execution. |
| V605 | Provides county package readiness context. V613 remains Montgomery-specific and does not update readiness classifications for other counties. |
| V606 | Defines local boundary acquisition and extraction controls. V613 preserves local-only execution separation and does not perform acquisition or extraction. |
| V607 | Establishes boundary validation and promotion-readiness separation. V613 keeps normalization execution separate from runtime activation and boundary promotion. |
| V608 | Defines evidence expectations for promotion decisions. V613 requires future checksum, validation, provenance, and report evidence before any generated artifact promotion can be considered. |
| V609 | Establishes package normalization review standards. V613 uses those standards as guardrails for the future execution workflow. |
| V610 | Determines Montgomery is `READY_FOR_LOCAL_NORMALIZATION_EXECUTION_WITH_OBSERVATIONS`. V613 converts that readiness posture into an execution plan without executing it. |
| V611 | Defines the local normalization authorization framework. V613 stays within that framework and does not substitute planning for authorization. |
| V612 | Determines Montgomery is `READY_FOR_EXECUTION_AUTHORIZATION_REVIEW_WITH_OBSERVATIONS`. V613 expands the checklist into a command-sequence plan to be reviewed by a later milestone. |

## 5. Montgomery Source Asset Inventory

| Source asset | Current role | Future execution treatment |
| --- | --- | --- |
| Boundary | Montgomery county boundary package input. | Validate as an immutable package reference. Do not extract, rewrite, normalize, promote, or activate as part of road/crossing normalization. |
| Roads | TIGER road source package components under `assets/county-implementation/montgomery/runtime-assets/source/`. | Treat as immutable road normalization input. Verify component presence and checksums before any future conversion command. |
| Crossings | FRA-aligned Montgomery crossing GeoJSON at `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson`. | Treat as immutable crossing validation input. Validate GeoJSON, schema, FIPS, and feature-level expectations before any future staged validation output. |
| Overrides | Montgomery crossing review overrides at `assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json`. | Treat as immutable override posture input. Validate JSON structure before any future workflow applies or records override-aware findings. |

## 6. Proposed Execution Environment

Future Montgomery normalization, if separately approved, should run only in a local workstation environment.

Required environment restrictions:

- local workstation only;
- no Codex Cloud normalization;
- no GitHub Actions normalization;
- no runtime execution;
- no deployment environment execution;
- no application startup requirement;
- no UI, API, dashboard, loader, registry, or activation dependency;
- no broad multi-county batch execution; and
- no generated artifact commits by default.

The local workstation should have GIS tooling available before execution, including an `ogr2ogr` installation suitable for converting the road source package in a future milestone. V613 does not run or validate that tooling.

## 7. Proposed Road Normalization Workflow

A later approved execution milestone should use the following road normalization sequence. These steps are documented for future use only and are not executed by V613.

1. **Source validation**
   - Confirm the Montgomery road source directory exists.
   - Confirm required shapefile components are present, including `.shp`, `.shx`, `.dbf`, and `.prj`.
   - Confirm the source package remains county-scoped to Montgomery.
   - Confirm source files are read-only inputs for the run.

2. **Checksum verification**
   - Calculate or verify SHA-256 checksums for each road source component.
   - Compare checksums with the expected evidence package or record new pre-execution checksums if the future milestone defines that as the approved evidence path.
   - Stop immediately on checksum mismatch.

3. **`ogr2ogr` conversion (future)**
   - Run `ogr2ogr` only after source validation and checksum verification pass.
   - Convert Montgomery road source data into a staged GeoJSON output under the approved local staging path.
   - Capture the exact command, tool version, start time, end time, exit code, and stderr/stdout summary in a future conversion log.
   - Do not write directly to runtime paths or promoted package paths.

4. **Staged GeoJSON output**
   - Write normalized road GeoJSON only to the future local normalization staging directory.
   - Keep the output generated-only and uncommitted by default.
   - Capture output file size, feature count, geometry type summary, bounding box summary, and checksum.

5. **Validation report generation**
   - Generate a future validation report from the staged GeoJSON.
   - Verify geometry validity, schema conformance, county/FIPS consistency, feature counts, and provenance traceability.
   - Treat the report as generated staging unless a later milestone separately approves committing evidence artifacts.

## 8. Proposed Crossing Validation Workflow

A later approved execution milestone should use the following crossing validation sequence. These steps are documented for future use only and are not executed by V613.

1. **GeoJSON validation**
   - Confirm the Montgomery crossing file exists.
   - Parse it as GeoJSON.
   - Confirm it is a `FeatureCollection` with a valid `features` array.
   - Stop on parse failure, missing features, or malformed geometry.

2. **Schema validation**
   - Validate required FRA-oriented crossing properties.
   - Confirm point geometry expectations.
   - Confirm override posture compatibility with the crossing source.
   - Stop on missing required properties, unexpected shape, or invalid override posture.

3. **FIPS verification**
   - Confirm crossing records remain associated with Montgomery County, Texas, using the expected county identity evidence and FIPS/GEOID context.
   - Stop if records appear to cross county scope unexpectedly or cannot be reconciled to Montgomery identity.

4. **Staged validation output**
   - Write any future crossing validation summary only to the local normalization staging directory.
   - Capture feature counts, schema findings, FIPS findings, and checksum evidence.
   - Keep staged validation output generated-only and uncommitted by default.

## 9. Proposed Output Structure

Future generated outputs should be written under a local staging directory such as:

```text
assets/county-implementation/montgomery/generated/local-normalization-staging/
```

Expected future generated outputs may include:

- normalized roads;
- validation reports; and
- conversion logs.

Suggested internal layout for a future approved run:

```text
assets/county-implementation/montgomery/generated/local-normalization-staging/
  roads/
    montgomery-roads.normalized.geojson
  crossings/
    montgomery-crossings.validation-report.json
  reports/
    montgomery-local-normalization-report.json
  logs/
    ogr2ogr-road-conversion.log
    checksum-verification.log
```

These outputs are generated only. They are not committed by default and must not be treated as promoted package artifacts unless a later milestone explicitly approves that promotion.

## 10. Validation Requirements

Before any future promotion of generated Montgomery normalization output, all of the following requirements must be satisfied:

- geometry valid;
- schema valid;
- checksum traceable;
- source provenance documented;
- V603 validations pass;
- V604 validations pass;
- generated output path documented;
- conversion command documented;
- conversion logs retained in staging or evidence location approved by the future milestone;
- feature counts reviewed;
- output size reviewed for unexpected growth or shrinkage;
- source assets confirmed unchanged after execution;
- staged outputs confirmed generated-only unless promotion is explicitly approved; and
- no runtime registration, activation, loader, UI, API, dashboard, or behavior change introduced.

## 11. Rollback Strategy

If future local execution fails or produces unapproved results, the rollback strategy is:

- discard staged outputs;
- retain source assets unchanged;
- do not rewrite repository history;
- do not modify runtime paths;
- do not activate Montgomery;
- do not register Montgomery into runtime;
- remove any accidentally staged generated files from Git before commit;
- preserve failure logs only if the future milestone explicitly authorizes evidence retention; and
- document the failure condition in the applicable future review package.

Because future outputs are expected to be generated-only and isolated under staging, rollback should not require repository rewrite or runtime recovery.

## 12. Failure Conditions

A future Montgomery local normalization run must stop or be rejected if any of the following conditions occur:

- checksum mismatch;
- conversion failure;
- invalid geometry;
- invalid schema;
- Git tracking violation;
- unexpected output size;
- missing source asset;
- missing shapefile component;
- malformed crossing GeoJSON;
- FIPS or county identity mismatch;
- unexpected cross-county data scope;
- source asset mutation;
- generated output written outside the approved staging path;
- runtime registry, loader, UI, API, dashboard, or activation dependency discovered;
- generated artifact committed without explicit approval;
- validation report missing or incomplete;
- conversion log missing or incomplete; or
- inability to prove V603 and V604 validations remain passing.

## 13. V602 Protection Strategy

V613 preserves the V602 strategy by defining local execution controls that avoid large generated diffs and runtime coupling.

| V602 protection concern | V613 protection |
| --- | --- |
| Diff-size failure | Future normalization outputs are directed to generated local staging and are not committed by default. Planning remains documentation-only, so V613 introduces no generated GIS diff. |
| Source/package separation | Source assets remain immutable inputs. Future generated outputs must be isolated from source and package inputs. |
| County-scoped execution | The plan applies only to Montgomery and does not authorize broad multi-county execution. |
| Local-only execution | The proposed environment is a local workstation only, with no Codex Cloud, GitHub Actions, runtime, or deployment normalization. |
| Runtime separation | The plan prohibits activation, runtime registration, loader changes, UI changes, API changes, dashboard changes, and runtime behavior changes. |
| Git safety | Future generated staging must remain uncommitted by default, and Git status must be reviewed before and after any later execution. |

Local execution avoids V602 diff-size failures by keeping heavy GIS outputs out of the committed diff unless a future milestone explicitly approves artifact promotion with a reviewed storage policy.

## 14. Explicit Non-Goals

V613 explicitly does not pursue any of the following goals:

- no normalization execution;
- no artifact generation;
- no runtime registration;
- no activation;
- no road conversion;
- no crossing normalization;
- no source asset modification;
- no generated output promotion;
- no GIS conversion;
- no GitHub Actions normalization;
- no Codex Cloud normalization;
- no runtime execution;
- no DriveTexas resumption;
- no Transportation Intelligence enablement; and
- no historical feature enablement.

## 15. Recommendation

Montgomery should proceed to a focused execution-readiness audit before any normalization execution is approved. That audit should verify the exact local tooling, commands, checksum expectations, staging protections, validation report format, rollback procedure, and Git hygiene requirements that would govern a later local run.

No normalization should occur as part of V613, and no future execution should proceed until the readiness audit confirms that V602 protections remain intact.

## 16. Recommended Next Milestone

**V614 — Montgomery Normalization Execution Readiness Audit**
