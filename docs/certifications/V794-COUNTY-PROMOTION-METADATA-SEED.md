# V794 — County Promotion Metadata Seed Certification

## Scope

V794 adds an explicit deterministic metadata seed for county promotion. The seed is intentionally separate from production package contents and is consumed by `tools/CountyPromotion/Promote-GridlyCounty.ps1` before the deterministic writer can approve write mode.

## Implemented Controls

- Added `tools/CountyPromotion/county-promotion-metadata.seed.json` as the explicit metadata seed.
- Seeded Jefferson, Polk, and Harris first.
- Required seeded values include county name, slug, county id, Texas county GEOID, boundary source reference, bounds, local communities, community coordinates, default awareness area, search/home-area values, and awareness-area definitions.
- Updated `Promote-GridlyCounty.ps1` so missing or incomplete seed data blocks with a county-specific deterministic metadata reason.
- Preserved all-or-nothing write behavior: write mode still applies only after every requested county passes readiness and deterministic metadata gates.
- Preserved V793 safety posture: the writer does not geocode, infer, or guess missing local anchors.

## Protected-System Statement

V794 does not intentionally modify production package contents, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, or Supabase Sync.

## Validation Status

PowerShell is not installed in this Linux container, so the requested PowerShell runtime validations could not be executed here. Static JSON validation and protected-system diff checks were executed, and the blocked runtime commands are recorded in machine-readable evidence for handoff execution in an environment with Windows PowerShell or PowerShell Core.

## Required Handoff Runtime Commands

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris -WhatIf
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Promote-GridlyCounty.ps1 -County Jefferson,Polk,Harris
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Jefferson
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Polk
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Harris
```
