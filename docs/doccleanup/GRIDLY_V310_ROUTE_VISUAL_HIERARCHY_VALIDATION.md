# V310 Route Visual Hierarchy Validation

## Visual changes
- Route origin markers were reduced to a small teal current-location ring with a center dot, without pin or arrow treatment.
- Destination markers were reduced to an outlined target ring with a small center indicator and no pin stem.
- Route line halo, shoulder, and core weights/opacity were reduced while preserving the existing teal route color family and geometry.
- The route pane is kept below the marker pane so active hazard and crossing markers visually sit above route context.

## Zoom levels checked
Presentation was reviewed against the route style values for zoom 10, 11, 12, 13, 14, 15, and 16. The route uses conservative fixed weights so it remains followable at low zoom without growing into an oversized foreground object at high zoom.

## Layering confirmation
Leaflet route presentation remains in `routePane` with pointer events disabled. Hazard and crossing markers remain in the marker pane above the route pane, so the route passes under awareness markers and does not block crossing popup taps.

## Validation limitations
This repository change is presentation-only. Automated syntax and diff checks were run locally; real-device mobile portrait validation across live map tiles and live route data should be completed during QA because external map/tile and routing conditions can vary.
