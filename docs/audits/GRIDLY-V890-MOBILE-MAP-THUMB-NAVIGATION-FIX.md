# GRIDLY V890 — Mobile Map Thumb Navigation Fix

## Problem
Real-device Android and iPhone testing found the Home map uncomfortable to pan with one thumb. Because Gridly's map is the primary exploration surface, any fixed portrait chrome, bottom dock/sheet capture, oversized transparent hitbox, or browser scroll gesture competing with Leaflet is a controlled-beta blocker candidate.

## Suspected causes reviewed
- Bottom dock and bottom dock shell hitboxes.
- Collapsed and hidden Portrait V2 bottom sheets/backdrops.
- Community Pulse / top briefing / filter strip fixed-position areas.
- Map controls, floating control rail, zoom controls, layer button, and layer menu.
- Transparent or oversized fixed-position elements covering the map.
- `pointer-events` rules on overlay shells versus actual buttons.
- `touch-action` and `overscroll-behavior` on the map, Leaflet panes, and portrait overlay layers.
- Leaflet gesture ownership for drag and pinch zoom.
- iOS Safari / Android Chrome viewport and body-scroll competition around fixed portrait UI.

## Fix applied
V890 applies a narrow interaction-contract CSS patch for mobile portrait:

1. The Portrait V2 shell becomes non-interactive by default so transparent space over the map does not steal drags.
2. Actual controls, cards, filter buttons, dock buttons, sheets, markers, popups, zoom controls, and the layer button retain `pointer-events: auto`.
3. The control rail wrapper no longer acts as a tall draggable blocker; only its contained buttons are interactive.
4. Hidden sheets/backdrops explicitly cannot capture input.
5. The map and Leaflet panes are configured with `touch-action: none` so Leaflet owns pan and pinch gestures while surrounding buttons use `touch-action: manipulation`.
6. Leaflet control containers are non-interactive except for actual controls and markers/popups.

## What changed
- Added V890 mobile portrait CSS to constrain overlay hitboxes and keep the map as the primary gesture owner.
- Added `window.gridlyMobileMapThumbNavigationAudit?.()` as a console-safe, non-mutating audit helper.
- Added optional `window.gridlyMapInteractionHitboxDebug?.()` to report element rectangles, `pointer-events`, `touch-action`, positioning, and z-index. It does not mutate the UI unless called with `{ debugFlag: true }`, which only prints a console table.
- Added a static regression test for the V890 audit helper, layer button preservation marker, protected systems marker, and absence of broad protected logic edits.

## What did not change
- No Home redesign.
- No map data changes.
- No marker changes.
- No report placement logic changes.
- No Search or routing logic changes.
- No Route Watch logic changes.
- No Alerts, Community Pulse, Know Before You Go, Weather, Settings, Supabase, hazard lifecycle, alert generation, or protected-system logic changes.
- The layer button and map controls remain preserved for beta.

## Protected systems confirmation
Protected systems are unchanged. V890 is limited to mobile portrait interaction CSS, audit/debug helpers, documentation, and static regression coverage. The audit helper returns `protectedSystemsUnchanged: true` and `layerButtonPreserved: true`.

## Android validation checklist
1. Open Gridly in Chrome.
2. Fresh reload.
3. Pan map with right thumb from center, lower center, and lower-right.
4. Pan map near dock without opening dock/sheets accidentally.
5. Pinch zoom.
6. Tap markers.
7. Tap layer button.
8. Open/close Alerts/Search/Report/Settings sheets.
9. Return to Home and pan again.
10. Confirm no accidental UI activation while dragging.

## iPhone validation checklist
1. Open Gridly in Safari/Chrome.
2. Fresh reload.
3. Pan map with right thumb from center, lower center, and lower-right.
4. Pan near dock/safe area.
5. Pinch zoom.
6. Tap markers.
7. Tap layer button.
8. Open/close sheets.
9. Return to Home and pan again.
10. Confirm no body scroll or sheet capture fights the map.

## Browser checklist
Run:

```js
window.gridlyMobileMapThumbNavigationAudit?.()
window.gridlyMapInteractionHitboxDebug?.()
window.gridlyControlledBetaReadinessAudit?.()
window.gridlyMobileBetaReadinessAudit?.()
window.gridlySettingsExperienceAudit?.()
window.gridlySearchDiscoveryAudit?.()
await window.gridlyRunSearchCertificationAudit?.()
```

Expected V890 audit shape:

```js
{
  available: true,
  version: "V890-mobile-map-thumb-navigation-fix",
  pass: true,
  mapPrimaryInteractionPreserved: true,
  thumbPanZoneAvailable: true,
  pinchZoomPreserved: true,
  bottomDockNotBlockingMapDrag: true,
  bottomSheetNotBlockingCollapsedMapDrag: true,
  controlRailHitboxesContained: true,
  layerButtonPreserved: true,
  noFullScreenTransparentBlockers: true,
  pointerEventsReviewed: true,
  touchActionReviewed: true,
  protectedSystemsUnchanged: true
}
```

## Known remaining risks
- Real-device browser chrome, dynamic viewport resizing, and safe-area behavior can still differ by device and must be validated on target beta Android and iPhone hardware.
- If a future Home surface adds a full-screen fixed element with `pointer-events: auto`, it could regress the thumb pan zone unless it follows the V890 interaction contract.
- The static audit confirms the helper and markers; final acceptance still depends on manual pan/pinch validation on real devices.
