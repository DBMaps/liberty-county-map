# GRIDLY V890R — Android Portrait Map Breathing Room

## Problem
Real-device Android Chrome review showed the locked Home experience feeling more vertically compressed than iPhone portrait. V890 already improved thumb map navigation by containing overlay hitboxes, but Android Chrome can expose less usable visual height when browser chrome and fixed viewport assumptions interact.

## Suspected causes reviewed
- `100vh` portrait map sizing that can be less reliable on Android browser chrome transitions than `100dvh`, `100svh`, or the existing `--gridly-visual-vh` visual viewport variable.
- App shell and map container height competing with static Home chrome.
- Top Home chrome height from Community Pulse / Know Before You Go, the status surface, and filter strip spacing.
- Bottom dock and Location Context reservations reducing the perceived open map band.
- Safe-area treatment on devices with different insets.
- Android Chrome visual viewport behavior while the URL bar expands/collapses.
- V890 `pointer-events` and `touch-action` rules so the breathing-room change does not reintroduce map drag blockers.

## What changed
- Added a V890R mobile portrait CSS block that prefers the runtime visual viewport variable with `100dvh` / `100svh` / `100vh` fallbacks for the portrait map surface.
- Added a reliable mobile portrait map min-height token so the map remains the primary visual surface.
- Slimmed only presentation spacing in the locked portrait shell: topbar vertical padding, briefing-card vertical padding, filter-strip offsets, Location Context bottom offset, and bottom dock padding/min-height.
- Added the console-safe, non-mutating `window.gridlyAndroidMapBreathingRoomAudit?.()` helper.

## What did not change
- Home architecture and information ownership remain intact.
- Community Pulse and Know Before You Go remain owned by the established portrait Home surfaces.
- Location Context remains in its established bottom-region role.
- Bottom dock remains present and usable.
- Layer button placement/ownership remains preserved.
- V890 thumb navigation hitbox and touch-action containment remains preserved.
- No map data, markers, reports, alerts, search, routing, Route Watch, Weather, Supabase, hazard lifecycle, alert generation, or protected runtime systems were changed.

## Protected systems confirmation
V890R is presentation-only CSS plus an audit helper. It does not modify data providers, map feature data, marker generation, report submission, alert ranking/generation, routing/search, Route Watch, Weather, Supabase, or hazard lifecycle code.

## Android validation checklist
1. Fresh reload in Android Chrome portrait.
2. Confirm Home no longer feels overly compact and the map has more visual breathing room.
3. Pan map with thumb from center, lower-center, and lower-right.
4. Pinch zoom.
5. Tap the layer button.
6. Open/close sheets.
7. Confirm dock does not block normal map exploration.
8. Confirm Community Pulse / Know Before You Go and Location Context still look correct.
9. Run `window.gridlyAndroidMapBreathingRoomAudit?.()`.
10. Run `window.gridlyMobileMapThumbNavigationAudit?.()`.
11. Run `window.gridlyControlledBetaReadinessAudit?.()`.

## iPhone comparison checklist
1. Fresh reload in iPhone Safari and/or Chrome portrait.
2. Confirm iPhone layout is not degraded.
3. Confirm the map still feels spacious.
4. Confirm V890 thumb pan and pinch improvements remain intact.
5. Confirm layer button, dock, and sheets still work.

## V890 preservation checklist
- `pointer-events` containment remains in the V890 CSS block.
- Leaflet map touch gestures remain owned by the map surface.
- Controls retain `touch-action: manipulation`.
- Bottom dock and collapsed sheet regions do not become full-screen transparent blockers.
- Layer button remains available.

## Known remaining risks
- Android Chrome viewport behavior varies by OS/browser version and URL-bar state; real-device checks remain required.
- Extremely short Android devices may still feel compact because Community Pulse, Know Before You Go, Location Context, and dock are intentionally preserved.
- Browser helper output verifies static/runtime hooks, not subjective visual comfort; device validation is the acceptance source for presentation feel.
