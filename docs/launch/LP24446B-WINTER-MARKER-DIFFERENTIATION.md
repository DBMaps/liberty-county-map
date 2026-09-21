# LP244.46B — Winter marker differentiation

Status: **READY FOR OWNER VISUAL REVIEW**. Starting commit: 78241632. This replaces the unaccepted shared winter symbol without changing the normalized model.

## RCA and scope

LP244.46 mapped all seven winter conditions to winter-road.svg. A remaining CSS selector also grouped ice with flooding/standing water at 1.4× artwork scale; the 89.6 px Ice image was a historical asset adjustment, not a justified severity distinction. Ice is removed from that selector. Severity, selection, source attribution and route calculations remain untouched.

## Design and mapping

All assets retain the navy pin, high-contrast interior symbol, common outline and existing shadow pipeline. The source of truth is GRIDLY_WINTER_MARKER_ASSETS in js/app.js. The existing category asset map, master asset inventory and anchors derive their winter entries from it. Both community and official marker builders resolve that map, retaining the existing official source badge. Legacy icy aliases use the same resolver. The normalized markerFamily remains winter; this repair changes only the visual asset selected within that family.

| Condition | Asset | Symbol |
|---|---|---|
| ICE | icy-road.svg | Ice crystal |
| BLACK_ICE_SUSPECTED | black-ice-suspected.svg | Slippery/dark road with uncertainty mark |
| BRIDGE_OVERPASS_ICING | bridge-overpass-icing.svg | Bridge span and ice crystal |
| SNOW_COVERED_ROAD | snow-covered-road.svg | Perspective road with snowbanks |
| SLEET_FREEZING_RAIN | sleet-freezing-rain.svg | Cloud, precipitation and frozen pellets |
| REDUCED_VISIBILITY | reduced-visibility.svg | Eye and horizontal fog bands |
| WINTER_ROAD_HAZARD | winter-road.svg | Winter caution triangle with ice crystal |

Production assets reside under assets/markers/png/; the existing pipeline supports SVG reliably. Each uses a 256 × 256 viewBox and the existing 64 px icon box / 244-of-256 tip anchor. No external fonts, raster screenshots or runtime asset generation. Lookup remains a small constant-time map operation.

## Validation

94 targeted tests pass: 7 marker tests, 22 LP244.46 normalization tests, 29 LP244.45 context tests and 36 relevant label, lifecycle, weather and official-marker tests. The old LP045.2 test fails its alert-focus source assertion both before and after this change; baseline substitution evidence is local under the preview directory. No new failure was found.

Actual renderUnifiedIncidents output was inspected on the Dayton basemap. At 320, 360, 390 and 440 px, all seven winter assets render at 64 × 64 px, remain within the viewport and are distinguishable in nearby groups. Every real picker selection was exercised; actual popup-model labels match the unchanged authority-safe wording. Cluster identity, aggregation functions, lifecycle, normalization module, protocol, admission and provider modules are unchanged. Synthetic input includes overlapping grouped/raw fallback layer entries already produced by the renderer; no unrelated deduplication repair was made.

## Owner preview

Local screenshots are in .artifacts/lp24446b-winter-marker-preview/: winter-marker-family-distinct.png, winter-marker-comparison.png and winter-marker-mobile-scale.png, plus winter-mobile-320.png / 360 / 390 / 440. The family/comparison images use a numbered preview-only legend and include flooding, construction, generic hazard and the existing official closure asset. Source badges remain those of the existing renderer. The mobile images use normal map scale rather than enlarged artwork.

Run node tools/lp24446b/preview.mjs from the repository root. It uses a disposable browser context and synthetic in-memory observations only. Public basemap tile GET requests are permitted for the real-map backdrop; reporting/backend requests are blocked. No moderation gate or reporting activation is modified. Preview screenshots remain local in the ignored artifact directory; the compact evidence and test log are tracked under reports/.

## Noninterference

No taxonomy, authority, severity, lifecycle, geometry, moderation, retention, database, notification, Route Watch, Around Me, native, public-site, Dispatch or production-data change. No backend writes, push, merge or deployment. One local follow-up commit is requested: Differentiate winter hazard markers. Owner visual acceptance remains pending.
