# Liberty County Spatial Intelligence System

## Version

V5.2.1 hotfix - FRA loading restored

## Purpose

This project maps known public rail/street crossings in Liberty County, Texas, supports shared community reporting through Supabase, and adds a local data governance workflow for reviewing questionable crossing records.

## Live Site

https://dbmaps.github.io/liberty-county-map/

## Core Rules

Do not modify:

```text
data/liberty-county-boundary.geojson
```

The Liberty County boundary file is intentionally protected.

## Data Sources

Official FRA crossing data:

```text
https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY
```

Shared live reports:

```text
public.crossing_reports
```

Supabase project:

```text
https://nhwhkbkludzkuyxmkkcj.supabase.co
```

## V5.2.1 Hotfix Notes

This hotfix restores the known-working FRA loading sequence and makes crossing overrides safe.

Important behavior:

- FRA crossings load even if `crossing-overrides.json` is missing or invalid.
- Boundary loading is independent.
- Supabase report loading is independent.
- Leaflet pane stacking fixes are included in CSS.
- Active blocked reports render as red markers.
- Cleared reports resolve active state.
- Active Reports counter reflects active blocked crossings.
- Review Console lets you stage local override decisions.

## Crossing Overrides

File:

```text
data/crossing-overrides.json
```

Starter content:

```json
{}
```

Supported override values:

```text
verified_public
private_visible
needs_review_visible
hidden_closed
relocate_needed
```

Example:

```json
{
  "123456A": "verified_public",
  "778899X": "hidden_closed",
  "445566Q": "private_visible"
}
```

## How To Use Review Console

1. Open app through VS Code Live Server.
2. Turn Review Mode on.
3. Click Next Needs Review.
4. Choose:
   - Verify Public
   - Mark Private
   - Hide Closed
   - Relocate Needed
5. Click Generate Override JSON.
6. Copy the generated JSON.
7. Paste it into `data/crossing-overrides.json`.
8. Save and refresh.

## Commit Message

```text
V5.2.1 hotfix restore FRA loading
```
