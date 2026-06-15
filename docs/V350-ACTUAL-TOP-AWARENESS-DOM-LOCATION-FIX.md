# V350 — Actual Top Awareness DOM Location Fix

## Goal

V350 fixes the actual rendered top Awareness Area DOM path that could still show a weak fallback crossing fragment under an authoritative road-hazard title:

```text
Flooding on FM 1960 -
US 90 at Waco Street
```

V350 is a targeted production bug fix for the visible mobile Awareness Area card only.

## Actual DOM Path Fixed

The visible top Awareness Area card is the mobile destination command card:

- Container: `.mobile-destination-command.is-awareness-panel`
- Primary/title text: `#mobileDestinationCommandTitle`
- Secondary/status text: `#mobileDestinationCommandMeta`
- Companion awareness lines: `#mobileAwarenessPanelCrossings` and `#mobileAwarenessPanelIssues`

The direct DOM writer is `syncMobileDestinationCommandCard()`, specifically its `awarenessPanelMode` branch. V350 applies the cleanup immediately before writing `#mobileDestinationCommandTitle` and `#mobileDestinationCommandMeta` so the live screen path is fixed rather than only the shared localized-intelligence snapshot.

## Behavior Change

For road hazards, when the primary/top line contains an authoritative road identity such as `FM 1960`, V350 prevents a weaker fallback or crossing fragment such as `US 90 at Waco Street` from rendering as the continuation, subtitle, suffix, or second line.

Accepted visible output:

```text
Flooding on FM 1960
1 Mile West of Dayton
```

or:

```text
Flooding on FM 1960
```

Rejected visible output:

```text
Flooding on FM 1960 -
US 90 at Waco Street
```

## Preservation

V350 does not change Tap Map payload preservation, alert card copy, markers, Route Watch, crossings, Supabase schema, lifecycle rules, DriveTexas work, bridges, recursive ownership lookup, or alert snapshots.

The V347 FM 1960 identity and V348 alert-card secondary copy remain preserved. V350 only guards the rendered top Awareness Area DOM card path.

## Audit

V350 adds:

```js
window.gridlyActualTopAwarenessDomLocationAudit?.()
```

The audit reads the actual rendered DOM text from the mobile Awareness Area card rather than internal snapshot variables. It returns:

```js
{
  available: true,
  policyVersion: "V350",
  productionBehaviorChanged: true,
  renderedTopAwarenessText,
  renderedPrimaryText,
  renderedSecondaryText,
  fm1960Rendered,
  us90WacoRendered,
  badCombinedFragmentRendered,
  actualDomPathChecked: true,
  snapshotOnlyPath: false,
  topAwarenessDomPass,
  v347Preserved,
  v348Preserved,
  v343Preserved,
  findings,
  recommendations,
  notes
}
```

## Required Manual Validation

With active FM 1960 flooding visible, run:

```js
window.gridlyActualTopAwarenessDomLocationAudit?.()
```

Expected key values:

```js
{
  policyVersion: "V350",
  actualDomPathChecked: true,
  snapshotOnlyPath: false,
  fm1960Rendered: true,
  us90WacoRendered: false,
  badCombinedFragmentRendered: false,
  topAwarenessDomPass: true,
  v347Preserved: true,
  v348Preserved: true,
  v343Preserved: true
}
```

Also visually confirm the top Awareness Area no longer shows `US 90 at Waco Street` under or after `Flooding on FM 1960`.
