# Gridly V263 Bottom Dock Simplification Audit

## Goal

Remove the primary Portrait V2 bottom-dock **Route** button while preserving route creation, Route Watch, Route Details, Saved Places, Manage Places, and active-route controls.

## Route-button action inventory before patching

| Route-button action currently reachable | Existing alternate access path | Access remains after Route removal? | Hidden dependency found? |
| --- | --- | --- | --- |
| Open route setup / quick route panel | Destination Search owns one-off route creation; Route Watch strip and Route Details manage monitoring/setup | Yes | No. Runtime binders tolerate the Route button being absent. |
| Create route to searched destination | Destination Search → search/select destination → route preview/current route details | Yes | No. Route preview functions are destination-search owned. |
| Current Location → Home | Destination Search saved Home result/chip; Route Watch saved selectors | Yes | No. Saved Home remains managed in Settings/Manage Places. |
| Current Location → Work | Destination Search saved Work result/chip; Route Watch saved selectors | Yes | No. Saved Work remains managed in Settings/Manage Places. |
| Favorite → Destination | Destination Search saved-place/favorite result; Settings/Manage Places edits favorites | Yes | No. Saved-place results are generated independently of the dock button. |
| Search → Destination | Destination Search surface and mobile destination command | Yes | No. Search entry points do not depend on the Route dock button. |
| Route Details for an active route | Destination impact/details pane, destination command impact line, active route details controls | Yes | No. Details pane and controls are standalone DOM/actions. |
| Show Full Route | Route Details → Show Full Route; desktop Route Watch strip → Show Full Route | Yes | No. Control IDs and handlers remain. |
| Clear Route | Route Details → Clear Route; desktop Route Watch strip → Clear Route | Yes | No. Control IDs and handlers remain. |
| Stop Route Watch | Route Details → Stop Watch; desktop Route Watch strip → Stop Route Watch | Yes | No. Route Watch lifecycle remains independent. |
| Route Watch monitoring | Dashboard/mobile Start Route Watch, desktop Route Watch strip, route-related V2 actions, Settings place prerequisites | Yes | No. Monitoring state and start/stop functions remain. |
| Manage Places | Settings → Route & Places → Manage Saved Places; Route Details → Route Watch / Manage Route; route setup modal | Yes | No. Manage Places adapter and settings buttons remain. |
| Saved Places | Settings saved places section; Destination Search saved Home/Work/Favorite results; route setup modal saved selector | Yes | No. Storage and saved-place result generation remain. |
| Route intelligence / awareness | Awareness Brief, destination route preview card, Route Details context summary, Route Watch strip | Yes | No. Awareness ownership was not changed. |

## Patch notes

- Removed the primary Portrait V2 bottom-dock `data-v2-sheet="route"` button.
- Changed the Portrait V2 bottom dock from five equal slots to four equal slots.
- Added `window.gridlyBottomDockSimplificationAudit?.()` for V263 validation.

## Expected audit result

```js
window.gridlyBottomDockSimplificationAudit?.()
```

Should return a passing V263 result with:

- `routeButtonRemoved: true`
- `routeButtonPresent: false`
- `reportButtonPresent: true`
- `alertsButtonPresent: true`
- `historyButtonPresent: true`
- `settingsButtonPresent: true`
- `routeCreationStillAvailable: true`
- `routeDetailsStillAvailable: true`
- `routeWatchStillAvailable: true`
- `managePlacesStillAvailable: true`
- `consumerFriendlyPass: true`
- `findings: []`
