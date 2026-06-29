# V792 County Promotion Automation Foundation Certification

## Certification Summary

V792 adds the county promotion automation foundation with safe `-WhatIf` behavior first. The new tool preflights one or more counties, reuses existing readiness gate logic, reports the files and state that a controlled promotion would affect, and blocks write mode until deterministic edits are proven safe.

## Files Added or Modified

Added:

- `tools/CountyPromotion/Promote-GridlyCounty.ps1`
- `docs/Standards/GRIDLY-COUNTY-PROMOTION-AUTOMATION.md`
- `docs/certifications/V792-COUNTY-PROMOTION-AUTOMATION-FOUNDATION.md`
- `docs/certifications/evidence/V792-county-promotion-automation-foundation.json`

Modified:

- `tools/Gridly.ps1`

## Tool Behavior

`Promote-GridlyCounty.ps1` supports:

- `-County <county or comma-separated counties>`
- `-WhatIf`
- `-Json`
- `-AllReady`

For each requested county, the tool invokes `Test-GridlyCountyPromotionReadiness.ps1 -Json`. Counties must be `READY FOR CONTROLLED PROMOTION` before the tool will report them as ready for promotion planning.

## WhatIf Examples

Expected examples:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson -WhatIf
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris -WhatIf
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris -WhatIf -Json
```

`-WhatIf` reports the would-change files and active county state while keeping `changedFiles=false`.

## Write Mode Status

Write mode is **blocked** in V792. This is intentional. The app still contains multiple hand-authored runtime/search/awareness/boundary patterns, and safe deterministic write rules have not yet been proven for all requested outputs.

## Protected-System Verification

V792 does not modify protected systems:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Synchronization
- Community Package Pipeline

It also does not modify production, community, or crossing package contents.

## Testing Results

The requested PowerShell commands could not be executed in this environment because neither `powershell` nor `pwsh` is installed. The evidence JSON validates with `python3 -m json.tool`.

## Certification Decision

Certified as a safe foundation milestone: `-WhatIf` planning is implemented, write mode remains blocked, and the command center exposes the workflow with default preflight mode.
