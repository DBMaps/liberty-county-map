# LP215 — 254-county consumer wiring certification

## Scope and result

This is a read-only, fail-closed audit. It changes no production source or package. The JSON matrix is the owner-review artifact and contains exactly one row for every Texas county. Repository-governed identity, camera, roadway-manifest, and authoritative rail-package wiring are evaluated separately from observations which can only be made in a running browser.

`REPOSITORY_WIRING_CERTIFIED` means the committed authorities agree. `LIVE_SOURCE_CERTIFIED` remains false until an owner browser run supplies settled camera, provider lifecycle, consumer publication, Alerts DOM, crossing marker-ID parity, and predecessor cleanup evidence. `NOT_STARTED` is deliberately not rewritten as `HEALTHY_EMPTY`.

## Deterministic representative selection

Counties are ordered by ascending five-digit FIPS. Within each county, the harness filters to governed `PLACE_GEOID` communities which have a GEOID, include that county in their governed memberships, and have a production presentation target. It selects the lexicographically smallest canonical key. A countywide fallback is explicit if that set is empty; the current result has no fallback counties.

The transition predecessor for row *n* is row *n − 1*; the predecessor for row 1 is row 254. This makes repeated executions use the same wraparound sequence.

## Evidence boundary and owner live procedure

1. Serve the trusted checkout through the normal owner production-like HTTPS/browser environment with DriveTexas configuration available.
2. Feed the JSON matrix `rows`, in `sequence` order, to the owner's browser automation as its itinerary; do not type community names manually.
3. For each row, select `canonicalKey`, wait for semantic-camera and source lifecycles to settle, and capture fields which are `null`/`NOT_STARTED` in the repository matrix.
4. Capture stable IDs—not only counts—for Alerts eligibility/display and rail policy-visible/Leaflet/DOM collections. Require exact rail ID-set equality under Repair 007.
5. Retain the current county's IDs as the next row's predecessor set. Fail if a predecessor county, roadway, DriveTexas area record, rail record/marker, awareness record, or alert card survives after the next row settles.
6. Treat provider failure as `FAILED`, `UNAVAILABLE`, or `STALE_RETAINED`, as applicable. Never record it as `HEALTHY_EMPTY`. Keep repository-wiring and live-source conclusions separate.

The matrix is intentionally not marked live-certified merely because its repository inputs are internally coherent. This is the smallest truthful stopping point without owner production configuration and live connector evidence.

## Fredericksburg / Gillespie control

The governed representative is Fredericksburg (`place-4827348`). Its production semantic camera is latitude `30.2752011`, longitude `-98.8719843`, zoom `13`. Gillespie's authoritative crossing state is `ACTIVE_EMPTY` with governed count `0`; therefore the repository classification is `RAIL_EXPECTED_EMPTY`, not a missing/failing package. The roadway manifest is activated with 3,725 features. DriveTexas, Alerts rendering, settled state, marker parity, and transition isolation remain owner-browser work and fail closed in this artifact.

## Commands

```bash
npm run build:lp215
npm run test:lp215
npm run verify:lp215
```

The generated matrix contains every failing county and its classification; no county is silently omitted.
