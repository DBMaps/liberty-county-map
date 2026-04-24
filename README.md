# Liberty County Spatial Intelligence System

Version: V4.3

Live site:

https://dbmaps.github.io/liberty-county-map/

## Purpose

The Liberty County Spatial Intelligence System is a local-first rail crossing blockage reporting map.

The current focus is Liberty County, Texas, with a fast reporting workflow for known railroad/street crossings.

V4.3 adds official public crossing data from the U.S. Department of Transportation FRA Crossing Inventory dataset so reports attach to official crossing IDs instead of manually maintained or inaccurate crossing points.

## Current Stack

This project intentionally uses only:

- HTML
- CSS
- Vanilla JavaScript
- Leaflet
- Local GeoJSON for the Liberty County boundary
- Official USDOT FRA crossing GeoJSON API
- GitHub Pages

Do not introduce:

- React
- Vue
- Angular
- TypeScript
- Build tools
- Backend servers
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