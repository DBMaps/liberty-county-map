# LP114 — Complete County Asset Manufacturing Pipeline

## Startup verification

LP114 began on branch `work` at commit `4b03cb56edb021d1d3e8cf254bdb2fd9e054abdf`. The only startup worktree entries were the permitted generated directories `android/.gradle/`, `android/build/`, and `node_modules/`. No applicable `AGENTS.md` was present.

## Command and bundle contract

`tools/lp114/manufacture-county-bundle.mjs` accepts an explicit comma-separated selection from the maintained 254-county Texas inventory. It rejects duplicates and unknown/non-Texas identities before writing output. Each county is processed independently, and an atomic checkpoint is written after that county's asset steps. A failed address step is recorded as `FAILED`; it does not prevent another requested county from running.

The command evaluates county identity, address package and sidecar, address certification, candidate runtime certificate, railroad source and production crossing packages, crossing certification, roadway geometry and manifest, community/locality coverage, ZIP coverage, curated destinations, search evidence, candidate runtime identity, and Storage planning. Every entry uses exactly one of:

* `GENERATED`: created during this run.
* `RESUMED`: an integrity-verified prior output was reused under `--resume`.
* `VERIFIED_EXISTING`: existing governed evidence was checked without rebuilding it.
* `NOT_APPLICABLE`: authoritative source evidence proves the asset does not apply. LP114 never uses this merely because input is missing.
* `REQUIRES_OWNER_SOURCE`: an existing pipeline cannot run without an owner-held source or prior package.
* `NO_EXISTING_PIPELINE`: repository tooling has no authoritative arbitrary-county generator.
* `FAILED`: an attempted step failed; its diagnostic is retained and processing continues where safe.
* `NOT_AUTHORIZED`: the operation is outside this candidate-only milestone.

## Existing pipelines reused and parameterization

LP114 reuses the LP104.4 TxGIO builder's existing `--fips`, `--gdb`, `--gdal`, `--output`, and `--force` interface. It invokes that executable only when a package is absent and an owner source was supplied. It calls the exported LP113-generalized `certifyCountyPackage` function directly and calls LP107's exported certificate construction and validation functions directly. No existing pipeline required modification or cohort parameterization.

The address builder requires the immutable TxGIO 2026 geodatabase and GDAL/`ogr2ogr`. Existing address packages require their LP104.4 `.json` sidecars. LP114 verifies sidecar county/FIPS identity, byte size, and SHA-256 before reuse. It writes certification and runtime-certificate evidence only below the LP114 candidate reports directory; it never changes the address runtime manifest.

## Supported and unsupported assets

The currently supported manufacturing path is the certified address bundle: package, metadata sidecar, LP113 certification, and an inactive local candidate runtime certificate. County identity and inactive candidate identity evidence are also emitted.

The repository contains production/static artifacts for crossings, roadways, communities, ZIP awareness, destinations, and search, but no authoritative runnable arbitrary-county manufacturing pipeline was found for those families. LP114 therefore reports `NO_EXISTING_PIPELINE` rather than copying static data, inferring coverage, or fabricating success. Storage planning is `NOT_AUTHORIZED`; no upload tool is called. A zero-crossing county is not classified `NOT_APPLICABLE` unless a future authoritative source pipeline supplies explicit zero-crossing evidence.

## Resume, recovery, and outputs

Default candidate output is `reports/lp114/`. Each FIPS has `checkpoint.json`, `candidate-manifest.json`, and, when address inputs exist, `address-certification.json` plus an inactive runtime certificate. The aggregate report is `reports/lp114/county-bundle-manufacturing-report.json`. `--reports` and `--address-dir` override those locations.

Use `--resume` to verify and reuse matching address outputs. Use `--force` only to rebuild through LP104.4; it is mutually exclusive with `--resume`. `--skip-addresses` requires reusable local address evidence and never rebuilds it. `--addresses-only` retains truthful statuses for all contract families while limiting attempted manufacture to addresses. `--dry-run` records missing owner prerequisites without invoking the builder. Rerunning atomically replaces candidate evidence and never deletes a verified package.

If a checkpoint reports `FAILED`, correct its exact source/input problem and rerun with `--resume`. If it reports `REQUIRES_OWNER_SOURCE`, provide the documented source path or make the existing owner-local package directory accessible. `NO_EXISTING_PIPELINE` is an implementation boundary, not evidence that an authentic asset does not exist.

## Production boundary

Every candidate manifest has `activated: false` and `productionAuthorization: false`. Upload, deployment, Storage mutation, production runtime activation, production cohort expansion, and production-manifest writes are absent from the orchestrator. The governed 28-county cohort and all consumer selectors remain unchanged.

## Owner execution (PowerShell)

The authentic Burleson, Trinity, and Victoria packages are owner-local and were not available in the Codex workspace. Run this block from the repository root; adjust only the two source paths if needed:

```powershell
$ErrorActionPreference = 'Stop'
$TxGioGdb = 'C:\GridlyData\TxGIO\Texas-2026.gdb'
$AddressDir = '.\data\generated\lp104\txgio-addresses'
node .\tools\lp114\manufacture-county-bundle.mjs --fips 48051,48455,48469 --resume --gdb $TxGioGdb --address-dir $AddressDir --reports .\reports\lp114
if ($LASTEXITCODE -ne 0) { throw "LP114 manufacturing failed with exit code $LASTEXITCODE" }
```

Existing packages and matching sidecars are resumed; `--gdb` permits truthful manufacture only where one is absent. Add `--gdal 'C:\Program Files\QGIS 3.44.11\bin'` if `ogr2ogr` is not on `PATH`.

## Remaining blockers, cleanup, and merge recommendation

Authentic owner execution remains required to produce the three-county report and reveal actual owner-source availability. Non-address families remain blocked by the exact `NO_EXISTING_PIPELINE` entries above; LP114 does not initiate a new audit or invent replacements.

To roll back local candidates, remove `reports/lp114/`. Do not remove owner address packages. LP114 is recommended for merge after its tests and the preserved LP112/LP113 and runtime-certificate contracts pass; authentic owner execution is operational follow-up and does not authorize launch.
