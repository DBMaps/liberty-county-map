# GRIDLY County Promotion Toolkit

## Purpose

The County Promotion Toolkit introduces a reusable, audit-first foundation for controlled county promotion. Its first command is `Test-GridlyCountyPromotionReadiness.ps1`, which inspects package, manifest, asset, registry, and enablement state for a requested county without changing repository files or application behavior.

This foundation supports the long-term goal of a governed command such as `Enable-GridlyCounty.ps1 -County Chambers`, but V787 is intentionally conservative and preflight-only.

## Current scope

V787 adds only a readiness check and command-center entry point. It does not promote Chambers or any other county, does not enable any county, and does not modify runtime registrations, production packages, community packages, crossing packages, or application behavior.

Chambers is the first expected test candidate because prior regional-package work left it with promotion-relevant artifacts while it remains disabled for consumer operation.

## Command examples

Run the readable console report:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Chambers
```

Run the structured JSON report:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\CountyPromotion\Test-GridlyCountyPromotionReadiness.ps1 -County Chambers -Json
```

Run from the command center:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Gridly.ps1
```

Then choose **County Promotion Readiness** and enter the county name.

## What the tool checks

For the requested county, the readiness script checks:

- Community package manifest presence.
- Crossing package manifest presence.
- Production crossing package presence.
- Production crossing manifest entry presence.
- Application asset package presence under `assets/county-implementation/<county>/runtime-assets`.
- Existing registry/reference status.
- Search/selectability enablement status.
- Awareness enablement status.
- Consumer/production enablement status.
- Certification evidence in standard package evidence locations when available.
- Known remaining gaps based on failed checks and optional evidence warnings.

## What the tool does not do

The V787 tool does not:

- Copy files.
- Edit manifests.
- Register counties.
- Enable counties.
- Promote counties.
- Modify production packages.
- Modify community packages.
- Modify crossing packages.
- Modify application runtime behavior.
- Change Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Synchronization, Production Crossing Runtime, or the Community Package Pipeline.

## Relationship to V784, V785, and V786

- **V784** identified regional enablement status and clarified which counties were operational, staged, planned, or disabled.
- **V785** reconciled the deployment pipeline so package and runtime promotion decisions could be evaluated consistently.
- **V786** defined the standard county promotion process and the protected boundaries around promotion.
- **V787** converts that process into a reusable audit/preflight toolkit foundation while preserving non-activation discipline.
