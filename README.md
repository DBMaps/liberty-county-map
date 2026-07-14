# Gridly

**Know Before You Go.**

Gridly is a real-time mobility and hazard intelligence platform built to help people understand what may slow them down before they travel.

## Project Constitution

`THE-GRIDLY-BLUEPRINT.md` is the governing architectural document for Gridly. All future architectural decisions should align with the Blueprint. Implementation may evolve, but the Blueprint defines the long-term direction of the platform.

## Current Version

**Gridly V7 Hybrid Dashboard**

## Pilot Coverage

Liberty County, Texas

## Protected Main Baseline

**V178-RECOVERY.1** is the protected stable main baseline. Keep the runtime guardrails active: no full crossing runtime scans, no crossing enrichment during UI runtime, no source joins during interactions, and no pulse rebuilds inside click handlers. Future intelligence should remain lightweight, cached, deferred, interaction-safe, mobile-first, place-aware, and route-first.

## Core Features

- Live map interface
- Public FRA railroad crossing data
- Community blocked / cleared reports
- Supabase shared report storage
- Active report summary
- Use My Location
- Saved Home / Work / School places
- Local route impact summary
- Crossing visibility categories
- Local crossing override support
- Mobile-responsive dark interface

## Important Boundary Rule

Do not modify:

```text
data/liberty-county-boundary.geojson
```

## Local DriveTexas API Key Setup

For local DriveTexas testing, keep the real key on your machine only. Paste this one command into VS Code PowerShell from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Setup-GridlyLocalDriveTexas.ps1
```

The setup script privately prompts for the DriveTexas API key, creates `js/gridly.local.js`, confirms that file is gitignored and untracked, and then tells you to refresh Gridly. The generated file configures both `window.GRIDLY_TXDOT_API_KEY` and `window.GRIDLY_CONFIG.txdot.apiKey`; never commit the generated local file.
