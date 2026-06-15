# V351 — Top Awareness Area Actual Header DOM Fix

## Goal

V351 fixes the actual visible Portrait V2 top Awareness Area header directly under the Gridly logo/header and above the filter buttons. The targeted DOM is the top status pill, not the bottom Location Awareness card and not any snapshot-only alert path.

## Fixed DOM selector

- Primary header: `#gridlyV2TopStatusPrimary`
- Secondary header: `#gridlyV2TopStatusSecondary`
- Owner card: `.gridly-v2-awareness-brief-card`

## Fixed render function

`refreshPortraitV2LocalizedIntelligence` now applies `applyGridlyV351ActualTopAwarenessHeaderDomFix()` immediately before writing the visible top header DOM.

## Road-hazard policy

For road hazards, when the top/header primary text already contains authoritative road identity such as `FM 1960`, V351 does not render weaker fallback or crossing context such as `US 90 at Waco Street` in the top header secondary line.

Accepted visible results include:

- `Flooding on FM 1960`
- `Flooding on FM 1960` with a non-conflicting secondary such as `1 Mile West of Dayton`

Rejected visible result:

- `Flooding on FM 1960 - US 90 at Waco Street`

## Audit

Run in the browser with active FM 1960 flooding visible:

```js
window.gridlyTopAwarenessActualHeaderDomAudit?.()
```

Expected summary:

```js
{
  available: true,
  policyVersion: "V351",
  productionBehaviorChanged: true,
  actualTopHeaderDomChecked: true,
  bottomLocationAwarenessCardChecked: false,
  snapshotOnlyPath: false,
  fm1960Rendered: true,
  us90WacoRendered: false,
  badCombinedFragmentRendered: false,
  topHeaderDomPass: true,
  fixedDomSelector: "#gridlyV2TopStatusPrimary + #gridlyV2TopStatusSecondary",
  fixedRenderFunction: "refreshPortraitV2LocalizedIntelligence"
}
```

## Preservation

- V347 is preserved because FM 1960 remains the authoritative road identity in the rendered top header.
- V348 is preserved because the audit checks that the visible top header does not regress to `Reported on US 90` wording.
- V343 is preserved; lifecycle behavior and non-top-awareness surfaces are not changed.

## Scope boundaries

V351 intentionally does not modify:

- bottom Location Awareness card
- alerts or alert snapshots
- markers
- Tap Map payload preservation
- lifecycle rules
- Route Watch
- crossings
- Supabase schema
- DriveTexas work
