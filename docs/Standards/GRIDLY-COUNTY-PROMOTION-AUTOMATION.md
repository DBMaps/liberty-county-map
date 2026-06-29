# GRIDLY County Promotion Automation

## Purpose

V792 created the reusable county promotion automation foundation, V793/V794 added the deterministic writer and metadata seed gates, and V795 fixes write-mode replacement safety. `Promote-GridlyCounty.ps1` now supports readiness-gated `-WhatIf` planning and deterministic actual promotion when every requested county passes the preserved safety gates.

## Scope

The tool is scoped to promotion orchestration only. It does not manufacture packages, alter package contents, alter existing operational counties, or change protected systems.

In scope for `-WhatIf` planning:

- package registry active production metadata
- runtime registration
- search/home-area registration
- awareness bounds/areas
- boundary overlay registration when a county GEOID can be discovered
- certification/evidence files for the eventual promotion run

Out of scope for deterministic write mode:

- changing production/community/crossing package contents
- promoting counties without explicit operator intent

## Commands

Single-county preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson -WhatIf
```

Multi-county preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris -WhatIf
```

Machine-readable multi-county preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris -WhatIf -Json
```

Optional all-ready inventory preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -AllReady -WhatIf
```

## WhatIf Behavior

`-WhatIf` mode runs the same readiness and deterministic safety checks as write mode without writing files. It runs readiness checks for every requested county and reports:

- the readiness status returned by `Test-GridlyCountyPromotionReadiness.ps1`
- whether the county would be refused, ready, or blocked
- exact files that would change in a future write-enabled milestone
- the county state that would become active
- whether package contents or protected systems would be changed

`-WhatIf` never writes to `js/app.js`, `js/gridlyPackageRegistry.js`, package directories, or certification output paths.

## JSON Behavior

`-Json` emits a single object containing:

- `title`
- `version`
- `mode`
- `writeModeEnabled`
- `changedFiles`
- `packageContentsChanged`
- `protectedSystemsChanged`
- per-county `results`

The per-county result includes readiness output, the planned active state, and the files that would be changed by the deterministic writer.

## Readiness Gate Behavior

For each county, the promotion tool invokes the existing readiness script with `-Json`. A county is eligible for promotion planning only when the readiness result is exactly:

```text
READY FOR CONTROLLED PROMOTION
```

The tool refuses counties that are:

- `BLOCKED`
- missing required promotion prerequisites
- `ALREADY OPERATIONAL`

The promotion writer does not introduce `-Force`; already operational counties are read-only references and are not re-promoted.

## Write-Mode Safety Rules

Write mode is enabled only after the V793/V794 deterministic safety gates pass for every requested county. The writer must prove deterministic edits for all expected outputs before any file is written:

1. package registry production metadata
2. runtime registration
3. search/home-area registration
4. awareness bounds/areas
5. boundary overlay registration
6. certification/evidence generation

The writer must also prove that it does not alter:

- production package contents
- community package contents
- crossing package contents
- existing operational counties except as read-only pattern references
- protected systems

## Current Limitations

- The writer still refuses any county that is not exactly `READY FOR CONTROLLED PROMOTION`.
- The writer still refuses missing or incomplete deterministic metadata seed values.
- Boundary GEOID discovery is best-effort and depends on the state boundary overlay asset being present and containing the county name and `GEOID` property in discoverable proximity.
- Runtime/search/awareness edits remain deterministic-anchor based and are refused if expected anchors are missing.

## Relationship to V784-V791

- V784 identified the regional county inventory.
- V785 reconciled the deployment pipeline.
- V786 defined the promotion process.
- V787 added readiness checks.
- V788 manually promoted Chambers through controlled runtime/search/awareness configuration.
- V789 proved batch gates should skip counties that are not production-package ready.
- V790 added production package manufacturing.
- V791 fixed absolute path handling.
- V792 added safe promotion preflight and reusable operator entry points.
- V793/V794 added deterministic writer and metadata seed gates.
- V795 fixes replacement-string handling in actual promotion write mode and normalizes quoted or unquoted comma-separated county input.

## Package Manufacturing vs Runtime Enablement

Package manufacturing and runtime enablement remain separate by design. Manufacturing creates or validates production crossing artifacts. Runtime enablement changes application behavior by making a county active, selectable, searchable, awareness-enabled, and boundary-overlay-ready. Keeping these steps separate prevents package availability from automatically becoming a production user-facing county activation.
