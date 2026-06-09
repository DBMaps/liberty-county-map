# V271 Crossing Visibility Refinement Audit

## Scope
- Presentation-only refinement for rail crossing inventory marker visibility.
- Protected systems: crossing ownership, reporting, awareness filtering, hazard lifecycle, alert generation, Route Watch, and Supabase data paths.

## Findings
- Crossing inventory markers are rendered only in `renderCrossings()` on `crossingLayer`; their Leaflet marker handles are stored in `crossingMarkers`.
- Active train-delay markers are identified from the existing crossing report lifecycle (`getIncidentLifecycleState(report) === "active"`) before marker artwork is selected.
- Non-active crossing inventory markers currently share the `crossing_infrastructure` production marker category, including normal and recently cleared crossing states.
- Road hazard markers are rendered through separate hazard/unified incident paths and CSS classes, so crossing-only CSS/JS selectors can avoid hazard lifecycle or hazard marker presentation changes.
- Zoom/move events already schedule crossing re-rendering, so a zoom-threshold visibility gate can be implemented without altering reporting, Route Watch, Supabase, or alert generation pipelines.

## Patch Plan
1. Add crossing-specific constants for town/street-level marker visibility and infrastructure opacity.
2. Gate non-active crossing infrastructure markers below town/street-level zoom while preserving active train-delay markers regardless of zoom.
3. Apply opacity only to `crossing_infrastructure` marker images, leaving active train-delay and road hazard markers unchanged.
