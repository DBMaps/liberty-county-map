# Statewide rail Location Context / map parity RCA

## Finding

The Addison observation is not a count defect. The two numbers have different, documented owners. `renderCrossings()` starts with the certified active-county inventory, applies reportability/public-roadway, active-county, V829 representative and viewport/bounds policy in `getGridlyPolicyVisibleCrossings()`, and publishes the final unique identities through the `crossingMarkers` map. Leaflet and DOM counts are downstream render evidence for that same marker registry.

Location Context is owned by `getGridlyBottomPanelAwarenessCrossingCount()` and `buildGridlyCrossingWatchPresentationModel()`. Both delegate the crossing membership to `gridlySelectConsumerVisibleCrossings()`: active-county inventory, launch visibility, reportability/public-roadway classification, selected town/area geographic ownership (geometry, with town/radius fallback), and case-insensitive FRA-ID deduplication. It does not use the current Leaflet viewport, marker representative selection, clustering, or DOM.

The frozen LP037.1 contract defines “crossings watched” as certified, policy-visible, reportable crossings geographically owned by the selected awareness area and explicitly says viewport marker performance must not redefine it. Therefore 9 watched and 18 currently represented markers can legitimately differ. The noun “watched,” rather than “shown,” accurately communicates awareness coverage; no production copy or count change is justified.

## Addison evidence and identity capture

Owner production evidence establishes inventory 789, viewport skips 771, and map/Leaflet/DOM parity at 18, while Location Context reports 9. The supplied evidence contains counts but no FRA IDs, so the exact intersection cannot be reconstructed offline. The audit-only `window.gridlyRailLocationContextParityAudit()` now returns `mapVisibleIds`, `locationContextIds`, `intersectionIds`, `mapOnlyIds`, and `locationContextOnlyIds`, with counts, without changing UI or map behavior. Run it in the settled Addison production state for the requested identity sets.

## Statewide result

There is no Addison, Dallas, or numeric special case in either owner. Regression controls cover Addison/Dallas, Dayton/Liberty as a smaller positive community, Abilene/Jones as ACTIVE_EMPTY, Amarillo/Potter as a different positive county/community, community transition cleanup, and duplicate FRA identity handling. The mismatch is a statewide possibility by design, not a statewide defect risk.

No inventory, source asset, county ownership, visibility policy, representative policy, geometry, coordinates, roadway, alerts, route watch, service worker, or production label/count behavior changed.
