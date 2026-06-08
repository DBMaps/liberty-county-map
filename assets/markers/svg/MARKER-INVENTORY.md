# Gridly Marker Inventory

This directory contains standalone SVG assets for **Gridly Marker System V1**. The assets are intentionally not wired into Leaflet or runtime rendering yet.

## Design Standard

All marker SVGs follow the approved V1 visual system:

- 32px marker diameter with a 44px total SVG height including pointer.
- Premium dark circular base with a compact bottom pointer.
- White center glyphs for strong map contrast.
- Status ring support via `--gridly-marker-status` with a built-in fallback color per incident type.
- Standalone SVG markup with title and description metadata.
- No emoji artwork, no Google-style pin body, and no Waze/cartoon styling.

## Asset Inventory

| File | Marker Role | Glyph Concept | Notes |
| --- | --- | --- | --- |
| `marker-train.svg` | Train / rail incident | Train face with rail base | Hazard-oriented rail marker. |
| `marker-flooding.svg` | Flooding / high water | Layered water waves | Blue fallback status ring. |
| `marker-crash.svg` | Crash / collision | Vehicle impact with burst marks | Orange fallback status ring. |
| `marker-disabled.svg` | Disabled vehicle | Car with wrench | Purple fallback status ring. |
| `marker-construction.svg` | Construction | Road barrier | Amber fallback status ring. |
| `marker-debris.svg` | Debris / roadway obstruction | Alert cone / debris warning | Yellow fallback status ring. |
| `marker-road-closed.svg` | Road closed | No-entry closure | Red fallback status ring. |
| `marker-power-line.svg` | Power line / utility hazard | Utility pole and sagging lines | Yellow utility fallback status ring. |
| `marker-livestock.svg` | Livestock | Cow / livestock silhouette | Green fallback status ring. |
| `marker-emergency.svg` | Emergency | Shield / beacon cross | Rose fallback status ring. |
| `marker-other.svg` | Other / general alert | Alert triangle | Slate fallback status ring. |
| `marker-crossing.svg` | Railroad crossing infrastructure | Crossbuck and pole | Distinct infrastructure marker, not a hazard marker. |
| `GRIDLY-MARKER-SYSTEM-V1.svg` | System reference | Full marker family sheet | Visual reference only. |

## Implementation Status

- Asset creation is complete for the V1 marker family.
- Application behavior has not been changed.
- Leaflet marker wiring has not been changed.
- JavaScript rendering has not been changed.
