# LP043 — DriveTexas Geometry Preservation and Authority Repair

## 1. Executive result
LP043 preserves trusted DriveTexas GeoJSON `Point`, `LineString`, and `MultiLineString` geometry during provider normalization and carries that geometry into LP039 selected-awareness authority. Geometry-qualified records now can become consumer-visible when the trusted provider geometry intersects the active awareness radius and all existing identity, freshness, category, duplicate, and fallback protections pass.

## 2. Production problem
DriveTexas roadway events are commonly line geometries, but the prior normalization contract reduced a line to a compatibility midpoint. LP039 authority then evaluated only that point, creating false negatives when the affected roadway crossed the selected awareness area but the derived midpoint sat outside the radius.

## 3. Previous midpoint-only contract
The previous contract kept latitude and longitude for marker placement and point containment. It did not preserve full provider roadway paths as trusted authority evidence, so downstream selection could not evaluate the affected roadway itself.

## 4. New geometry preservation contract
Normalization now stores only validated source geometry in `sourceGeometry`, along with `sourceGeometryType`, `sourceGeometryValid`, `sourceGeometryCoordinateCount`, `sourceGeometryBounds`, and `sourceGeometryProvenance`. GeoJSON coordinate order remains `[longitude, latitude]`. Raw features and raw properties are not retained.

## 5. Geometry validation
The validator accepts only `Point`, `LineString`, and `MultiLineString`. Coordinates must be finite longitude/latitude pairs. `LineString` requires at least two pairs. Every `MultiLineString` member requires at least two pairs. Malformed geometry is rejected as a whole and does not invalidate an otherwise valid trusted point.

## 6. Line-to-awareness intersection method
LP039 projects each line segment into a local miles-based coordinate plane centered on the selected awareness anchor. It computes the minimum distance from the anchor to each segment, detects crossings where that distance is within the configured radius, and stops after the first accepted segment. A geometry bounding-box precheck skips distant line work.

## 7. LP039 ownership changes
Selected-awareness ownership now has layered precedence:

1. Valid source point inside the radius: `valid_source_point_inside_awareness_radius_miles`.
2. Else trusted source `LineString` or `MultiLineString` intersects the radius: `trusted_source_geometry_intersects_awareness_radius`.
3. Else geographic ownership is not established.

The geometry method does not bypass provider identity, freshness, category eligibility, deduplication, or retained-only fallback rejection.

## 8. Consumer projection
Geometry-qualified authority records flow through `gridlySelectDriveTexasAuthority()` into `gridlySelectConsumerVisibleDriveTexasSituations()`. Consumer wording remains presentation-oriented and continues to use Official Roadways language; technical geometry terms are not introduced to user-facing content.

## 9. Performance protections
The repair uses normalized geometry metadata, validated geometry cloning in the adapter, awareness bounding boxes, geometry bounding-box rejection, segment iteration with early exit after an accepted intersection, and per-authority-pass evaluation stats. No arbitrary record cap, extra fetch, polling change, storage write, or rendering-time geometry evaluation was added.

## 10. Switching safety
Authority is recomputed from the current selected awareness area on each selector call. Geometry-qualified records are not cached as visibility decisions, so changing communities or counties recalculates ownership and avoids stale inclusions.

## 11. Test results
The LP043 fixture test validates geometry preservation, malformed geometry rejection, line and multiline intersection authority, strict freshness/category/fallback behavior, deduplication, switching recalculation, and performance counters. Regression commands were run as part of implementation; live browser validation remains pending owner execution.

## 12. Live validation status
No live browser session was available in this environment, so Dayton live success is not claimed from fixtures. Use the final browser-console block in the implementation response after selecting Dayton.

## 13. Known limitations
LP043 does not render roadway lines, move markers to an intersection point, add polygon support, widen radii, or use certified roadway route-name matching. Marker placement remains the existing normalized point/midpoint contract.

## 14. Merge recommendation
Do not merge until the owner completes the live browser audit and manual visual switching validation. After those pass, this repair is suitable for merge as a focused production authority fix.
