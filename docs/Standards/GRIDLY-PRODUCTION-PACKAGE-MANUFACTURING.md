# GRIDLY Production Package Manufacturing

## Purpose

The production package manufacturing toolkit provides a reusable command for creating missing production crossing package outputs for counties that already have both a community package and a crossing package.

## Scope

The toolkit is limited to manufacturing production crossing package files under `Crossing-Packages/<county>/Production/` and maintaining `Crossing-Packages/production-crossing-manifest.json`. It does not enable counties, register runtime assets, change search configuration, change awareness configuration, or alter consumer behavior.

## Commands

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\ProductionPackages\Build-GridlyProductionPackages.ps1 -All
powershell -ExecutionPolicy Bypass -File .\tools\ProductionPackages\Build-GridlyProductionPackages.ps1 -County Jefferson
powershell -ExecutionPolicy Bypass -File .\tools\ProductionPackages\Build-GridlyProductionPackages.ps1 -All -WhatIf
powershell -ExecutionPolicy Bypass -File .\tools\ProductionPackages\Build-GridlyProductionPackages.ps1 -All -Json
```

The command is also available from `tools/Gridly.ps1` as **Production Package Manufacturing** with options for all eligible counties or a single county.

## Inputs

A county is eligible only when both files exist:

- `Community-Packages/<county>/package-manifest.json`
- `Crossing-Packages/<county>/package-manifest.json`

The crossing package manifest identifies the source crossing package file to read. Source package files are preserved.

## Outputs

For each manufactured county, the command writes:

- `Crossing-Packages/<county>/Production/<county>-production-crossings.geojson`

The command also updates:

- `Crossing-Packages/production-crossing-manifest.json`

## Skip behavior

If `Crossing-Packages/<county>/Production/<county>-production-crossings.geojson` already exists, the county is skipped unless `-Force` is supplied.

## Force behavior

`-Force` allows the command to rebuild an existing production package. Source crossing package files are still preserved.

## WhatIf behavior

`-WhatIf` reports the same manufacturing plan and status totals without writing production package files or updating the production crossing manifest.

## Safety rules

- Do not change runtime county registration.
- Do not change search enablement.
- Do not change awareness enablement.
- Do not modify consumer behavior.
- Do not modify existing community packages.
- Do not modify existing crossing package source data.
- Only write production outputs and the production crossing manifest when not running in `-WhatIf` mode.
- Infer consumer visibility fields only from existing production package files.
- If existing production packages do not expose a consistent rule, report `Blocked` instead of guessing.
- Per-county production certification generation remains pending unless a compatible existing certification file pattern is available.

## Relationship to V784/V785/V786/V787/V788/V789

- **V784** audited regional enablement gaps and identified missing production package/manifest coverage.
- **V785** reconciled platform state without changing protected systems.
- **V786** defined the production package promotion plan and gates.
- **V787** added county promotion readiness tooling.
- **V788** performed a controlled promotion for Chambers.
- **V789** documented controlled promotion candidates that remained missing production outputs.
- **V790** adds the manufacturing foundation for those missing outputs while preserving all runtime and consumer enablement boundaries.

## Manufacturing does not equal runtime enablement

Manufacturing creates package artifacts. Runtime enablement is a separate approval path involving runtime county registration, application asset installation, search configuration, awareness configuration, readiness validation, and consumer availability decisions. A manufactured production package must not be treated as enabled until those separate gates are explicitly completed.
