# Gridly V313 Road Hazard Location Description Implementation

## What changed

V313 moves the approved V312.4 road-hazard location policy from audit guidance into the production road-hazard wording path. Production road-hazard headlines now avoid promoting a proximity-only road reference into intersection wording.

The implementation adds evidence-aware selection for road hazards:

- Verified intersection wording (`on <road> at <reference>`) is only allowed when an explicit intersection-style source is present.
- Coordinate resolver output, nearest-road fields, nearby-road fields, and generic primary-road/reference-road pairings remain proximity evidence only.
- Major corridors prefer community-distance wording when a complete community, distance, and direction anchor is available.
- Local roads continue to use clean nearest-road fallback wording with `near` instead of `at` when only proximity evidence exists.

## What did not change

V313 does not change crossing data or crossing presentation. The implementation intentionally avoids changes to:

- Crossing names
- Crossing popups
- Crossing labels
- Crossing review overrides
- Crossing markers
- FRA crossing data
- Route Watch
- Directional display
- Awareness filtering
- Supabase sync
- Hazard lifecycle
- Marker rendering
- Popup layout
- Alert panel layout

## Approved policy applied

The V313 policy is evidence-gated:

1. **Tier 1 — Verified Intersection** may use `at <road>` only with explicit or geometry-confirmed intersection/cross-street evidence.
2. **Tier 2 — Crossing Landmark** remains reserved for reviewed nearby crossing landmarks and is not inferred from generic proximity.
3. **Tier 3 — Community-Distance Reference** is preferred for major corridors when Tier 1 and Tier 2 are unsupported and community-distance evidence is complete.
4. **Tier 4 — Nearest-Road Fallback** is preferred for local/neighborhood roads with only proximity reference evidence.

Major corridors include at minimum:

- US 90
- US 59
- FM 1960
- FM 1409
- TX 321

## Examples before and after

### Proximity-only major corridor reference

Before:

```text
Road Closed on US 90 at Sawmill Road
```

After, when community-distance evidence is complete:

```text
Road Closed on US 90 1 mile west of Dayton
```

After, when community-distance evidence is incomplete but nearest-road evidence is available:

```text
Road Closed on US 90 near Sawmill Road
```

### Proximity-only local road reference

Before:

```text
Construction on Cleveland Street at Linney Street
```

After:

```text
Construction on Cleveland Street near Linney Street
```

### Proximity-only neighborhood traffic backup reference

Before:

```text
Traffic Backup / Heavy Delay on Young Street at Colbert Street
```

After:

```text
Traffic Backup / Heavy Delay on Young Street near Colbert Street
```

## Regression protections

V313 adds production and audit protections so that:

- `coordinate.resolveNearestRoadName` cannot by itself support Tier 1 wording.
- Nearest-road and nearby-road fields cannot by themselves support Tier 1 wording.
- Unsupported Tier 1 candidate rows are counted and should remain zero for promoted production selections.
- Proximity-only intersection wording is counted and should remain zero.
- Crossing rows remain excluded from the road-hazard audit scope.
- Crossing naming changes are explicitly out of scope.

## Browser validation commands

Run this in the browser console after loading active road hazards:

```js
window.gridlyRoadHazardLocationShadowAudit?.()
```

Confirm the returned object includes:

```js
{
  productionPolicyVersion: "V313",
  tier1UnsupportedPromotedCount: 0,
  proximityOnlyIntersectionWordingCount: 0,
  crossingsExcluded: true,
  noCrossingNamingChanges: true
}
```

Also visually confirm:

- Road hazards still render.
- Road hazard alert cards still render.
- Road hazard popups still render.
- Crossing markers still render.
- Crossing popups are unchanged.
- Route lines are unchanged.
- Awareness filtering is unchanged.
