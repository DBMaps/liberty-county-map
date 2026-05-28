# Gridly

**Know Before You Go.**

Gridly is a real-time mobility and hazard intelligence platform built to help people understand what may slow them down before they travel.

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