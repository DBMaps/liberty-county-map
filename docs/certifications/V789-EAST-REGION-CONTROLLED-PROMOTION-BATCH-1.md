# V789 — East Region Controlled Promotion Batch 1

## Decision

Jefferson, Polk, and Harris were inspected for controlled promotion readiness under the V786 promotion plan and the V787 county promotion readiness model. No county in this batch is promoted because the required readiness gates did not pass.

## Scope

The authorized batch included only:

- Jefferson
- Polk
- Harris

No unrelated counties were enabled. Liberty, Montgomery, San Jacinto, and Chambers behavior remains unchanged.

## Readiness Method

The V787 readiness checks were statically applied because this Linux execution environment does not include `powershell` or `pwsh`. The readiness gate requires, at minimum, community package presence, crossing package presence, production package presence, production manifest presence, application asset presence, runtime registration, and disabled pre-promotion search/awareness/consumer state.

## Repository State Inspected

| County | Community package | Crossing package | Expected production package | Production manifest entry | Application runtime assets | Runtime registered | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Jefferson | PASS | PASS | FAIL | FAIL | PASS | PASS | BLOCKED |
| Polk | PASS | PASS | FAIL | FAIL | PASS | PASS | BLOCKED |
| Harris | PASS | PASS | FAIL | FAIL | PASS | PASS | BLOCKED |

### Blocking Gaps

- Jefferson does not have `Crossing-Packages/jefferson/Production/jefferson-production-crossings.geojson` and is not represented in `Crossing-Packages/production-crossing-manifest.json`.
- Polk does not have `Crossing-Packages/polk/Production/polk-production-crossings.geojson` and is not represented in `Crossing-Packages/production-crossing-manifest.json`.
- Harris does not have `Crossing-Packages/harris/Production/harris-production-crossings.geojson` and is not represented in `Crossing-Packages/production-crossing-manifest.json`.

## Promotion Work Completed

No runtime, search, awareness, boundary, package-registry, crossing-package, production-package, or community-package promotion changes were made for Jefferson, Polk, or Harris.

## Counties Promoted

None.

## Counties Skipped

- Jefferson — blocked by missing production package and missing production manifest entry.
- Polk — blocked by missing production package and missing production manifest entry.
- Harris — blocked by missing production package and missing production manifest entry.

## Regression Scope

The following existing counties remain operational through their established configuration paths:

- Liberty remains the default and reference operational county.
- Montgomery remains operational-maintenance/selectable through its existing runtime path.
- San Jacinto remains operational through its existing runtime path.
- Chambers remains controlled-enabled through the V788 runtime/search/awareness/boundary configuration paths.

## Package Preservation

V789 did not modify:

- Production crossing package contents.
- Community package contents.
- Crossing package contents.

## Protected Systems

V789 did not modify the following protected systems:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Synchronization
- Community Package Pipeline

## Validation Commands

Required PowerShell commands for a Windows or PowerShell-capable environment:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Jefferson
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Polk
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Harris
powershell -ExecutionPolicy Bypass -File .\tools\Runtime\Invoke-GridlyRuntimeValidation.ps1
powershell -ExecutionPolicy Bypass -File .\tools\Validation\Invoke-GridlySmokeTest.ps1
powershell -ExecutionPolicy Bypass -File .\tools\Runtime\Invoke-GridlyProductionReadiness.ps1
```

In this environment, PowerShell execution is blocked because neither `powershell` nor `pwsh` is installed. Equivalent static repository inspection and JSON/syntax validation were performed and recorded in the evidence file.

## Certification Result

**PASS — CONTROLLED PROMOTION WITH NO COUNTIES ENABLED.** The batch was evaluated, all three requested counties failed mandatory readiness gates, package contents were preserved, protected systems were not modified, and no unrelated county was enabled.

## Evidence

Structured evidence: `docs/certifications/evidence/V789-east-region-controlled-promotion-batch-1.json`.
