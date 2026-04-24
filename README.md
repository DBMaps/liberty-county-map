# Liberty County Spatial Intelligence System

Version: V5.0

Live site:

https://dbmaps.github.io/liberty-county-map/

## Purpose

The Liberty County Spatial Intelligence System is a local-first rail crossing blockage reporting map.

The current focus is Liberty County, Texas.

V5.0 adds shared live reporting so blocked/cleared reports can be seen across multiple phones and devices instead of staying only on one browser.

## Current Stack

This project intentionally uses:

- HTML
- CSS
- Vanilla JavaScript
- Leaflet
- GitHub Pages
- Local GeoJSON for the Liberty County boundary
- USDOT FRA Crossing Inventory GeoJSON API
- Supabase for shared reports

Do not introduce:

- React
- Vue
- Angular
- TypeScript
- Build tools
- Full backend server
- Frameworks

## File Structure

```text
liberty-county-map/
│
├── index.html
├── README.md
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   ├── liberty-county-boundary.geojson
│   └── liberty-county-rail-crossings.geojson