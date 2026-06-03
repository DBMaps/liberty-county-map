# Gridly V224 – Home Town Awareness Foundation

## Investigation findings

- Home Town options are declared in `GRIDLY_HOME_TOWN_OPTIONS` and rendered by the onboarding town buttons in `index.html`.
- Home Town was stored in Settings under `gridlySettingsV1.community.homeTown`; the user profile store `gridlyUserProfileV1` also had Home Town fields but onboarding did not keep them synchronized.
- Onboarding saved Home Town through `saveGridlyHomeTownPreference()` from the `[data-gridly-town]` button handlers.
- Startup map centering was fixed to `defaultCenter` (Dayton coordinates) before any crossing data was loaded.
- Crossing visibility was driven by `activeGeoFilter`, `getVisibleCrossingsForFilter()`, `getDefaultRelevantCrossings()`, viewport containment, and `shouldShowDistantInactiveCrossing()`.
- The default crossing filter started as `nearby`, and nearby calculations used GPS when available but otherwise fell back to the Dayton `defaultCenter`.
- Town filtering already existed through `activeGeoFilter === "town"`, but it depended on `getMyTownKey()`, which read only `gridlyUserProfile.homeTown`; existing onboarding writes could remain in Settings only.
- Awareness copy already had a Home Town label function, but it read the profile first and could miss Settings-only onboarding selections.

## Changes made

- Added a Home Town awareness anchor resolver so Dayton, Liberty, Cleveland, and Ames resolve to their local coordinates when selected.
- Synchronized onboarding Home Town saves into both Settings and the user profile, including Home Town coordinates, so all existing systems can read one consistent identity.
- Bias startup map centering toward the selected Home Town before GPS is requested, preserving the existing startup geolocation block.
- Fit the initial crossing viewport to Home Town-relevant crossings after crossing data loads, so town crossings are in view before rendering filters apply viewport containment.
- Default the crossing filter to `town` when a Home Town exists, and keep the filter/town key based on Settings first, then profile.
- Updated nearby/default crossing calculations and first-load marker hint logic to use the awareness anchor when GPS is unavailable, while continuing to prefer GPS after the user explicitly enables it.
- Updated awareness briefing town-label resolution to use Settings Home Town first, fulfilling the onboarding promise for existing Settings-only selections.

## Protected systems confirmation

- Route generation, OSRM routing, Route Watch activation, ETA calculations, destination search, and Travel Mode behavior were not changed.
- The V219/V220/V221 visual hierarchy foundations were not redesigned; changes are context/centering/filtering only.
- No new cards, command centers, visual experiments, or route redesigns were introduced.

## Acceptance testing steps

1. Clear local storage or use `window.resetGridlySetup()` and reload.
2. Select `Dayton`, finish/skip onboarding, reload, and confirm the map opens centered on Dayton with Dayton-area crossings visible.
3. Repeat for `Liberty`, `Cleveland`, and `Ames`; each town should become the initial awareness center and should show town-relevant crossings without requiring GPS.
4. Enable location from onboarding/reporting and confirm current-location behavior still uses GPS for nearby calculations after permission is granted.
5. Use the Route Watch controls and confirm route creation, route preview, and route watch behavior remain unchanged.
