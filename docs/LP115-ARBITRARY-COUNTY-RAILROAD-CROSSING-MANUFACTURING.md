# LP115 — Arbitrary-County Railroad Crossing Manufacturing

## Startup verification

Work began on branch `work` at commit `49eae097829270c0503f93b348051c7970fcf6ef`. `git status --short --branch` contained only the permitted generated `android/.gradle/`, `android/build/`, and `node_modules/` directories. No applicable `AGENTS.md` was present.

## Authoritative path and parameterization

LP115 uses `Crossing-Packages/Texas/fra-crossings-tx.geojson`, the statewide FRA-derived source from which the existing county source packages were selected. Candidate production transformation deliberately mirrors `tools/ProductionPackages/Build-GridlyProductionPackages.ps1` (V790): preserve the source feature, certify it, retain a governed classification when one is already present (otherwise apply the existing `PUBLIC_ROADWAY` rule), derive the display name from `STREET`/`HIGHWAY`, and derive `gridlyId` from `CROSSING`. It does not introduce a competing runtime builder.

The small Node adapter accepts an explicit comma-separated FIPS subset, validates it against the maintained 254-county LP104 inventory, filters on `STCYFIPS` with `CountyCode` fallback, and processes counties independently. Duplicate requested FIPS are rejected. Duplicate FRA identities, missing identities, cross-county leakage, unreadable input, and invalid GeoJSON fail closed.

## Contract and source requirements

Run `tools/lp115/manufacture-candidate-crossings.mjs` with `--candidate`; that flag is mandatory. The default source is the checked-in statewide FRA GeoJSON, and `--source` may select an owner-maintained equivalent. Missing input produces `REQUIRES_OWNER_SOURCE`; an unreadable or invalid query produces `FAILED`. Successful manufacture is `GENERATED`, a verified checkpoint is `RESUMED`, and a completed authoritative query returning no county rows is `NOT_APPLICABLE`.

Each `reports/lp115/<FIPS>/` directory contains an inactive candidate source package, inactive candidate production package, crossing certification, candidate crossing manifest, and atomic checkpoint. Evidence includes source identity/hash/size, FIPS filter, selected and production counts, classification/public/hidden counts, duplicate/rejected counts, package hash/size/path, and safety flags. The aggregate report is `reports/lp115/crossing-manufacturing-report.json`.

## Classification, zero crossings, and certification

LP115 preserves all currently governed classifications: `PUBLIC_ROADWAY`, `PRIVATE_ROAD`, `INDUSTRIAL`, `RAIL_YARD`, and `TEMPORARY_ACCESS`. Only `PUBLIC_ROADWAY` remains consumer-visible under the unchanged runtime policy. The current checked-in V790 FRA packages carry its existing public classification rule; LP115 does not silently infer new private/industrial decisions from unrelated FRA fields.

A zero-row authoritative county query writes evidence and certification with `PASS_ZERO_APPLICABLE` but fabricates no package. Certification checks county/FIPS containment, stable `FRA-<CROSSING>` identity, source traceability, duplicate identities, production fields, classification counts, byte size, SHA-256, and candidate manifest agreement. Package existence alone is insufficient.

## LP114 integration, resume, and recovery

LP114 now invokes the LP115 module directly (no subprocess) unless `--addresses-only` is selected. `--crossing-source` and `--crossing-reports` override its inputs. Crossing source, package, and certification statuses flow into the county candidate manifest independently of address results. A crossing failure cannot erase an address result and an address failure cannot erase crossing evidence.

`--resume` accepts a checkpoint only when its FIPS and authoritative source SHA-256 still agree. Writes use same-directory temporary files followed by atomic rename. Delete only the affected `reports/lp115/<FIPS>/` directory to rebuild one county, or delete `reports/lp115/` to clean all candidate evidence.

## Production safety boundary

Outputs live only below the requested reports directory. Every artifact records `productionAuthorized: false` and `activated: false`; aggregate reports also record upload, deployment, and activation disabled. The tool has no Storage, deployment, activation, production-package copy, or production-manifest write path. Existing 28 runtime packages, the production manifest, and consumer behavior are untouched.

## Authentic Burleson, Trinity, and Victoria command (PowerShell)

```powershell
$ErrorActionPreference = 'Stop'
Set-Location '<GRIDLY_REPOSITORY_ROOT>'
node .\tools\lp115\manufacture-candidate-crossings.mjs `
  --fips 48051,48455,48469 `
  --candidate `
  --resume `
  --source .\Crossing-Packages\Texas\fra-crossings-tx.geojson `
  --reports .\reports\lp115
if ($LASTEXITCODE -ne 0) { throw "LP115 crossing manufacture failed with exit code $LASTEXITCODE" }
Get-Content .\reports\lp115\crossing-manufacturing-report.json -Raw
```

Interpret `GENERATED`, `RESUMED`, and evidenced `NOT_APPLICABLE` as candidate-review outcomes. Resolve the stated prerequisite for `REQUIRES_OWNER_SOURCE`; investigate the county-local reason for `FAILED`. Neither outcome authorizes promotion. Merge is recommended only while the complete regression suite remains green and production hashes remain unchanged.
