# GRIDLY V602 — Asset Normalization Execution Strategy

## Status

**Final determination: V602 EXECUTION PATH IDENTIFIED**

V602 can proceed without modifying, normalizing, or activating the newly acquired county asset packages inside this milestone. The smallest safe path is to treat V602 as an execution-strategy and governance milestone that defines how normalization will be performed in a later controlled pass while preserving the already committed source packages as immutable acquisition evidence.

## Scope Confirmation

This strategy intentionally does **not** perform any of the following actions:

- Modify committed GIS source packages.
- Normalize source road assets, FRA crossing GeoJSONs, county boundaries, or runtime assets.
- Activate Chambers, Harris, Jefferson, Polk, San Jacinto, Montgomery, or any additional county.
- Change runtime registry state, feature flags, county selection behavior, storage policy, or consumer-visible behavior.
- Rewrite repository history.

The acquired packages are treated as source evidence only. Any later generated runtime artifacts must be produced through a separate approved milestone with explicit containment, validation, and review gates.

## Problem Statement

The V601/V601.5 acquisition work placed multi-county GIS source packages and FRA crossing GeoJSONs into repository history. Some files now exceed Codex diff extraction and review limits, especially large county road shapefiles and large FRA crossing GeoJSONs.

That creates a practical execution risk for V602 if the milestone attempts to normalize those files directly in-repo: small intentional changes can become unreviewable, generated artifacts may be too large for safe diff review, and asset mutation could blur the distinction between original source evidence and normalized runtime products.

V602 therefore needs a path that completes the strategy milestone while avoiding high-risk asset diffs.

## Determination 1 — Smallest Safe Path To Complete V602

The smallest safe path is:

1. **Complete V602 as documentation-only strategy.** Record the normalization execution model, source-retention decision, batching model, artifact policy, and readiness gates.
2. **Do not touch committed source assets in V602.** Leave existing GIS and FRA files byte-stable.
3. **Do not create normalized artifacts in V602.** Generated artifacts should be produced only in a future milestone with known output sizes, manifests, and validation reports.
4. **Use manifest-driven review instead of raw large-file review.** Future normalization should review small, deterministic manifests, checksums, row counts, schema summaries, and validation outputs rather than raw geospatial diffs.
5. **Separate acquisition evidence from runtime products.** Source packages remain provenance inputs; generated runtime assets become distinct outputs with traceable lineage.

This path satisfies the V602 decision requirement while avoiding additional large diffs or accidental county activation.

## Determination 2 — Where Normalization Should Occur

### Recommended Mode: Local, Batched, Generated-Artifact Workflow

Normalization should occur **locally in batches**, producing **generated artifacts** through a controlled pipeline. The working normalization process may happen outside direct review of raw asset diffs, but the repository should receive only bounded, reviewable outputs and metadata when approved.

| Option | Determination | Reason |
| --- | --- | --- |
| Locally | **Yes, as the primary execution environment.** | Local execution can process large shapefiles and GeoJSONs without relying on Codex diff extraction. It also allows GIS tools, streaming parsers, and validation scripts to run against full assets. |
| In batches | **Yes, required.** | County-by-county and asset-type-by-asset-type batches keep generated diffs small, isolate failures, and avoid cross-county leakage. |
| Outside repository history | **Partially.** | Intermediate working files, extracted temporary datasets, caches, and failed normalization outputs should stay outside repository history. Final accepted artifacts may be committed only if size, licensing, and review gates pass. |
| Through generated artifacts | **Yes, required.** | Runtime should consume deterministic generated artifacts, not mutated source packages. Each artifact should have provenance, checksums, counts, schema metadata, and validation evidence. |

### Batch Unit

The safest batch unit is one county plus one asset family:

- `county + boundary`
- `county + roads`
- `county + rail crossings`
- `county + crossing overrides`
- `county + manifest/provenance`

Roads and FRA crossing inventories should not be normalized together in the same batch unless their individual outputs are already proven small and reviewable.

### Batch Ordering

Recommended order for future execution:

1. Build and validate the normalization harness against a small existing baseline or fixture.
2. Process the smallest non-active county crossing set first.
3. Process a small road source package next.
4. Process Montgomery only as a compatibility check, not as a county activation action.
5. Process Harris last because its road and crossing source assets are the largest observed package and carry the highest diff/review risk.

## Determination 3 — Whether Source Assets Should Remain Committed

### Immediate Decision

**Source assets should remain committed for now.**

They were already acquired and committed as source packages. Removing them in V602 would create a large reverse diff, risk losing provenance traceability, and potentially turn a strategy milestone into a repository-history remediation milestone. Because V602 is constrained not to modify assets, deletion is not appropriate here.

### Long-Term Governance Decision

A future repository-storage policy should decide whether large source packages remain in Git permanently. That policy should evaluate:

- License and redistribution terms for each source package.
- Repository size and clone performance.
- Whether Git LFS, release artifacts, object storage, or an external evidence bucket is required.
- Whether committed source files are immutable provenance records or replaceable acquisition cache files.
- Whether normalized generated outputs can fully reconstruct runtime behavior without retaining raw sources in normal clones.

Until that policy exists, the safest near-term stance is **retain but freeze**:

- Keep committed source assets unchanged.
- Do not edit source assets in place.
- Do not delete source assets in V602.
- Add future policy controls before acquiring more large county packages.

## Recommended V602 Execution Plan

### Phase 0 — V602 Strategy Closure

- Commit this strategy document only.
- Do not touch assets or runtime code.
- Declare V602 complete once the execution path is documented.

### Phase 1 — Future Normalization Harness Design

Create a future milestone that defines the normalization harness before processing any county package. The harness should specify:

- Input discovery by county, source type, and manifest.
- Read-only source asset handling.
- Deterministic output naming.
- Streaming parsing for large GeoJSONs.
- GIS conversion support for shapefile components.
- Stable schema for generated road, boundary, and crossing artifacts.
- Output-size budgets and split rules.
- Checksum generation for every input and output.
- Validation summaries suitable for small diffs.

### Phase 2 — Repository Storage Policy

Before committing generated outputs for large counties, decide storage class per artifact:

| Artifact class | Preferred storage | Notes |
| --- | --- | --- |
| Raw source packages already committed | Git, frozen until policy changes | Do not mutate. |
| Temporary extraction files | Outside Git | Never commit caches, scratch files, failed outputs, or local indexes. |
| Small generated manifests | Git | Reviewable and useful for governance. |
| Small normalized runtime artifacts | Git if under size limits | Must be deterministic and validated. |
| Large normalized runtime artifacts | Git LFS, release artifact, or external object storage | Commit only pointer/manifest if raw diff is not reviewable. |
| Validation reports | Git if concise | Prefer summaries, counts, checksums, and failure lists over full data dumps. |

### Phase 3 — County-by-County Normalization Batches

For each county batch:

1. Freeze source inputs and record checksums.
2. Generate normalized artifact(s) outside source directories.
3. Validate geometry bounds, county containment assumptions, required fields, duplicate handling, null handling, and schema shape.
4. Emit a small manifest with input checksums, output checksums, feature counts, bounding boxes, schema version, warnings, and known exclusions.
5. Review only generated artifacts and manifests that are within size limits.
6. If outputs are too large, store them outside Git or in Git LFS and commit only pointers plus validation manifests.
7. Keep the county inactive unless a later activation milestone explicitly authorizes activation.

### Phase 4 — Runtime Integration Gate

Runtime integration should happen only after normalized artifacts pass review. A future integration milestone must separately prove:

- Registry entries remain inactive until authorized.
- Liberty County behavior remains unchanged.
- Non-active counties cannot be selected by production users.
- Legacy/null county policy does not leak into future counties.
- Generated road and crossing assets are county-scoped.
- Rollback can remove generated outputs from runtime use without deleting provenance evidence.

## Review and Diff-Safety Rules

Future normalization work should obey these review rules:

- Never review large raw geospatial diffs as the primary validation mechanism.
- Prefer counts, checksums, bounding boxes, schema summaries, sample records, and deterministic validation output.
- Split generated outputs when a single artifact exceeds review limits.
- Keep source and generated folders separate.
- Never overwrite acquired source files.
- Never commit temporary GIS workspace output.
- Never infer county activation from successful normalization.

## Naming Recommendation For Future Generated Outputs

Use a generated-output namespace distinct from source packages, for example:

```text
assets/county-implementation/<county>/generated/
  <county>-roads-normalized-v<schema>.geojson
  <county>-rail-crossings-normalized-v<schema>.geojson
  <county>-normalization-manifest-v<schema>.json
  <county>-normalization-validation-v<schema>.json
```

If generated artifacts are too large for Git review, commit only:

```text
assets/county-implementation/<county>/generated/
  <county>-normalization-manifest-v<schema>.json
  <county>-normalization-validation-v<schema>.json
  <county>-generated-artifact-pointers-v<schema>.json
```

The pointer file should identify external artifact location, checksum, byte size, generation timestamp, source checksums, schema version, and retrieval policy without embedding the large artifact itself.

## Final Recommendation

V602 should close as a strategy-only milestone. Normalization should be deferred to a future controlled pipeline that runs locally, executes in small county/asset batches, preserves source assets as immutable provenance inputs, and commits only bounded generated artifacts or artifact pointers with concise validation evidence.

**Final determination: V602 EXECUTION PATH IDENTIFIED**
