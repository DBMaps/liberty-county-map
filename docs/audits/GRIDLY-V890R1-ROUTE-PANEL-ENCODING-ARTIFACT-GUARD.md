# GRIDLY V890R.1 — Route Panel Encoding Artifact Guard

## Problem
Stray encoding/artifact characters such as `Â`, `Ã`, `�`, and mojibake punctuation sequences were recurring in user-facing route text after route setup. The visible risk was highest in the Route panel, Route Watch setup hints, route status cards, and route-related HTML snippets that render text assembled from saved-place labels and route status copy.

## Suspected cause
The recurring pattern looks like display-boundary mojibake rather than a single typo. Text assembled from mixed sources can contain UTF-8 punctuation that was previously decoded as Windows-1252/Latin-1, leaving sequences such as `â€¢`, `â€™`, `â€œ`, `â€`, `â€“`, and `â€”` in the UI.

## What changed
- Added a conservative display-text cleanup helper for known encoding artifacts.
- Routed user-facing road/route display normalization through that helper before existing road-name normalization.
- Routed HTML text escaping through the same cleanup helper so route-related `innerHTML` presentation snippets suppress known artifacts before escaping.
- Added `window.gridlyRoutePanelEncodingArtifactAudit?.()` as a non-mutating, console-safe audit helper.

## What did not change
- Route logic was not changed.
- Route geometry was not changed.
- Route matching was not changed.
- Route Watch internals were not changed.
- Search logic was not changed.
- Map rendering was not changed.
- Alert generation, reporting, weather, Supabase, and hazard lifecycle behavior were not changed.

## Protected systems confirmation
Protected systems remain unchanged: route calculation, route polyline drawing, route matching, Route Watch state, Search, map rendering, alerts, reporting, weather, Supabase sync, hazard lifecycle, and alert generation.

## Route panel validation checklist
1. Set a route.
2. Open the Route panel/details.
3. Confirm no stray encoding letters appear.
4. Start Route Watch.
5. Stop/clear Route Watch.
6. Confirm Route Watch wording still reads naturally.
7. Confirm route geometry and map rendering are unchanged.
8. Run:
   - `window.gridlyRoutePanelEncodingArtifactAudit?.()`
   - `window.gridlyAndroidMapBreathingRoomAudit?.()`
   - `window.gridlyMobileMapThumbNavigationAudit?.()`
   - `window.gridlyControlledBetaReadinessAudit?.()`

## Known artifact patterns
- `Â`
- `Ã`
- `�`
- `â€¢`
- `â€™`
- `â€œ`
- `â€`
- `â€“`
- `â€”`
- malformed bullet, dash, and quote characters matching those sequences

## Remaining risks
- This guard intentionally covers known presentation artifacts only. Unknown mojibake sequences may need to be added later if they appear in beta validation.
- The cleanup is display-only and should not be used to mutate stored saved-place data or route state.
- Manual device validation is still required because route-panel content can vary by saved-place names and route status.
