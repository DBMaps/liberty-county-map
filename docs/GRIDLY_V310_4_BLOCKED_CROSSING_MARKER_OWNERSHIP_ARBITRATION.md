# Gridly V310.4 — Blocked Crossing Marker Ownership Arbitration

## Root cause

The same active rail/crossing report was flowing through two visual marker systems:

- `renderCrossings → crossingMarkers → crossingLayer`
- `getConsolidatedIncidents → getUnifiedIncidents → renderUnifiedIncidents → unifiedIncidentLayer`

That left the rail/crossing data correct, but produced two Leaflet markers for one blocked crossing report.

## Ownership decision

For active rail/crossing reports, `crossingLayer` is the visual owner of the blocked-crossing map marker. Unified incidents continue to carry the rail incident record for alerts, summaries, diagnostics, and Route Watch / awareness intelligence.

## What was suppressed

`renderUnifiedIncidents` now suppresses only the duplicate Leaflet marker for unified rail/crossing incidents when the same crossing report is already represented by an active `crossingLayer` marker.

The arbitration key prefers:

1. `crossingId + reportId`
2. `crossingId + incident type` when a report id is unavailable

Coordinates are not used for this ownership decision.

## What was preserved

- FRA ingestion, normalization, coordinates, and review overrides were not changed.
- Crossing reporting, popup behavior, popup buttons, and report saving were not changed.
- Supabase sync and hazard lifecycle logic were not changed.
- Road hazard marker rendering and popups remain owned by `unifiedIncidentLayer` and are not suppressed by this rail/crossing arbitration.
- Route Watch, Active Route Context, route calculations, alert data, awareness filtering, and incident data models were not changed.
- Marker hierarchy is preserved because active crossing markers and active hazard markers remain marker layers above the route line.

## Regression risks checked

Programmatic checks completed:

- `git diff --check`
- `node --check js/app.js`

Manual validation focus:

- One active blocked crossing report should render one blocked-crossing marker.
- The remaining marker should be tappable and open the crossing popup.
- Alert cards and Route Watch awareness should still see the unified rail incident data.
- Road hazard markers and popups should continue to render normally in `unifiedIncidentLayer`.
- Route line should remain visually below markers.
