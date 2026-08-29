# Cienegas Terrace final acceptance repair

## Watched-count authority

The Location Context phrase means crossings in the current governed county
inventory that pass the existing LP037.2 consumer visibility/reportability and
canonical awareness-area geography selector. It is an awareness-radius count,
not the viewport marker count and not exact canonical PLACE polygon membership.

The zero was caused by `getGridlyBottomPanelAwarenessCrossingCount` returning
LP233 exact canonical PLACE membership before running that selector. Cienegas
Terrace has zero exact PLACE-member crossings, while 19 of Val Verde's 47
governed crossings are eligible within its governed seven-mile awareness area.
The consumer now retains the shared selector contract. The post-hydration
surface invalidation remains the publication boundary, and a positive current
count clears an earlier `active_county_inventory_empty` diagnostic.

## Presentation authority decision

The coordinate `29.3674511, -100.9437068` is OSM node `151364615`, classified
by LP201.1 as the single high-confidence, exact-name eligible named-place anchor
inside canonical PLACE GEOID `4814927`. LP201.2 certified it and LP201.3 promoted
it from the Census internal point. It is therefore neither an LP201 fallback nor
a geometry centroid, and it is inside the Cienegas Terrace PLACE geometry.

No alternate repository coordinate is certified as a better presentation
anchor. The governed geometry centroid, point-on-surface, and former Census
internal point are geometry/administrative candidates rather than certified
cartographic anchors; substituting one would be a Cienegas-specific visual
tweak. No coordinate is changed by this repair. If the promoted named-place
anchor remains visually unacceptable, changing it requires the existing
statewide presentation recertification/owner-review process (or a separately
governed generic usable-viewport framing policy), not a magic-number patch.
