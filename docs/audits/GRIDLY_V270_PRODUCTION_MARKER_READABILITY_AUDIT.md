# Gridly V270 Production Marker Readability Follow-up Audit

Scope: audit the remaining V270 production marker rendering issues before patching marker size, active opacity, badge placement, and rail asset selection. No Supabase, lifecycle, reporting, alerts, or Route Watch logic is in scope.

## Findings before patch

1. **Production marker display size was still fixed at 46x46.** The Leaflet `L.divIcon` path used `iconSize: [46, 46]` and `iconAnchor: [23, 23]`, while both static CSS and the runtime hazard stylesheet forced the wrapper, marker node, and image to `46px` square. This made normalized 256x256 PNG artwork appear too small.
2. **Active production PNG markers could inherit readability-reducing opacity.** The production marker node kept freshness/proximity classes such as `gridly-freshness-aging` and `far-faded`; later CSS could reduce active marker opacity to values such as `0.78` or lower even when the marker was still active.
3. **Blocked train/crossing delay asset selection could be overridden by rail normalization.** `normalizeGridlyIncidentCategory()` can normalize explicit `rail_blockage_delay` incidents to the broader `rail` visual category before raw production marker category selection, which allowed `rail-crossing.png` to win instead of `train-front.png`.
4. **Badge treatment was too aggressive.** The previous late production-marker reset hid direct child badges (`small` age and `b` report count), avoiding overlap but not preserving badge behavior.

## Patch plan

- Introduce a single production marker display size constant and test `64px` first.
- Keep Leaflet marker ownership, popup binding, and click behavior unchanged by only changing icon dimensions/anchor and CSS presentation.
- Resolve explicit blocked/train delay categories before broader rail visual normalization so `rail_blockage_delay` uses `train-front.png`.
- Keep `road_closed` on `road-closed.png` and `flooding` on `water-over-road.png`.
- Reserve `rail-crossing.png` for rail/crossing infrastructure categories; generic `rail_issue` should not use it.
- Restore age/count badges as small outboard badges so they remain available without covering the center PNG identity.
- Override active production marker opacity back to `1` unless the marker is cleared/expired/inactive or explicitly stale/unknown.
