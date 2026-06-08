# Gridly Marker Mapping

This file documents the intended marker asset mapping for a future runtime integration pass. It is reference-only for now; no application behavior is changed by these assets.

## Intended Asset Mapping

| Event / Feature Category | SVG Asset | Runtime Intent |
| --- | --- | --- |
| Train / rail incident | `assets/markers/marker-train.svg` | Use for train-related incidents or rail hazard reports. |
| Flooding / high water | `assets/markers/marker-flooding.svg` | Use for high water, flooding, and water-over-road reports. |
| Crash / collision | `assets/markers/marker-crash.svg` | Use for vehicle crashes and collision reports. |
| Disabled vehicle | `assets/markers/marker-disabled.svg` | Use for stalled or disabled vehicle reports. |
| Construction | `assets/markers/marker-construction.svg` | Use for roadwork, work zones, or construction impacts. |
| Debris / obstruction | `assets/markers/marker-debris.svg` | Use for roadway debris, dropped cargo, or obstruction reports. |
| Road closed | `assets/markers/marker-road-closed.svg` | Use for closures, blocked roads, and no-entry conditions. |
| Power line / utility hazard | `assets/markers/marker-power-line.svg` | Use for downed power lines or utility infrastructure hazards. |
| Livestock | `assets/markers/marker-livestock.svg` | Use for loose livestock or animal roadway hazards. |
| Emergency | `assets/markers/marker-emergency.svg` | Use for emergency response, urgent safety, or active response points. |
| Other / general alert | `assets/markers/marker-other.svg` | Use as the fallback incident marker for uncategorized alerts. |
| Railroad crossing infrastructure | `assets/markers/marker-crossing.svg` | Use for fixed crossing infrastructure, not for incident hazards. |

## Status Ring Contract

Each marker includes a status ring that can be themed in a future integration with the CSS custom property below:

```css
--gridly-marker-status: #38BDF8;
```

If no custom property is provided, each SVG uses its built-in fallback ring color. The center glyph should remain white to preserve contrast against the dark circular base.

## Non-Goals For This Version

- Do not wire these SVGs into Leaflet yet.
- Do not change marker rendering logic yet.
- Do not change incident categorization logic yet.
- Do not change application CSS outside this asset directory for marker behavior.
