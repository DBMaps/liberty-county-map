# Liberty County Spatial Intelligence System

## Current Milestone

**V5.1 shared live reporting cleanup**

This version repairs the display/state layer for shared community crossing reports while keeping the existing Liberty County boundary data untouched.

## Live Site

https://dbmaps.github.io/liberty-county-map/

## Repository

`DBMaps/liberty-county-map`

## Important Rule

Do **not** modify:

```text
data/liberty-county-boundary.geojson
```

The boundary file is intentionally preserved.

## Data Sources

### FRA Crossing Inventory

The app loads Liberty County, Texas crossing inventory from:

```text
https://data.transportation.gov/resource/m2f8-22s6.geojson?$limit=5000&statename=TEXAS&countyname=LIBERTY
```

V5.1 behavior:

- Shows open FRA crossings.
- Hides only closed / abandoned / inactive records.
- Keeps questionable visible records on the map as review categories:
  - `needs_review_visible`
  - `private_visible`
- Does not hide questionable records unless they are clearly closed or invalid.

### Supabase

Project URL:

```text
https://nhwhkbkludzkuyxmkkcj.supabase.co
```

Table:

```text
public.crossing_reports
```

Expected table schema:

```sql
id uuid primary key default gen_random_uuid(),
crossing_id text not null,
report_type text not null check (report_type in ('blocked','cleared')),
status text not null check (status in ('active','resolved')),
road_name text,
railroad text,
city text,
county text,
state text,
lat double precision,
lng double precision,
confidence text default 'community',
source text default 'community_report',
created_at timestamptz default now(),
resolved_at timestamptz,
client_id text,
notes text
```

## What V5.1 Fixes

- Supabase reports are inserted from the browser.
- Supabase reports are read back into the map.
- Active blocked reports render as red map markers.
- Cleared reports resolve active state for that crossing.
- Active Reports counter reflects the number of currently active blocked crossings.
- Active Event Summary lists active blocked crossings.
- Console logs are clear and predictable:
  - `App Version`
  - `Loading reports`
  - `Reports loaded`
  - `Insert success`
  - `Insert failure`
- If Supabase fails, the app continues to run with a safe local fallback for the current browser session.

## Files Replaced in V5.1

```text
index.html
css/styles.css
js/app.js
README.md
```

## Commit Message

```text
V5.1 shared report display cleanup
```

## Manual Test Checklist

1. Open the GitHub Pages live site.
2. Open the browser console.
3. Confirm console shows:
   - `App Version: V5.1 shared report display cleanup`
   - `Loading reports`
   - `Reports loaded: X`
4. Confirm FRA crossings load on the map.
5. Confirm Liberty County boundary loads from the existing GeoJSON file.
6. Click a crossing.
7. Submit **Report Blocked**.
8. Confirm console shows `Insert success`.
9. Confirm the red active report marker appears.
10. Confirm **Active Reports** counter increases.
11. Confirm **Active Event Summary** lists the crossing.
12. Submit **Report Cleared** for the same crossing.
13. Confirm the active report marker clears.
14. Confirm **Active Reports** counter decreases.
15. Confirm the boundary file was not changed.
