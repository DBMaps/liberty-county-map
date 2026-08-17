# LP211 Statewide Roadway Runtime Activation

## Decision

**STATEWIDE_ROADWAY_RUNTIME_ACTIVE**

LP211 explicitly applied the committed LP210 portable certificate to the roadway runtime manifest. Conservation is exact: 28 protected entries plus the disjoint 226-county LP210 cohort equals all 254 Texas counties. The canonical manifest moved from SHA-256 `56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd` to `e4c9ac7168ec84dc462695a93ea4561dbd62486131f3f78b70ed05ab5ba39a0c`.

## Architecture audit and activation surface

`data/roadway-runtime-manifest.json` is fetched without caching, sanitized, and selected by active county in `js/app.js`. Local and LP030 single-package entries retain their established URLs. Harris retains its LP032.2 adaptive spatial manifest implementation. LP210 single-package entries use the exact certified object URL. The seven LP210 partitioned counties use a generic LP210 manifest-and-parts contract; every required response must succeed before geometry becomes active.

Only the roadway manifest and its loader changed as production surfaces. LP211 did not alter crossings, community/place identity, ZIP resolution, DriveTexas, weather, hazard ingestion, Supabase, or any remote object.

## Protected existing cohort

All 28 original manifest values were copied byte-for-value as JSON values. This preserves Liberty and San Jacinto local sources, Montgomery's governed compressed package and digest behavior, LP030 remote packages, and Harris LP032.2 partition selection. LP210 certification remains exactly the complementary 226 counties.

## Runtime safety and trust boundary

County activation clears prior geometry before retrieval. Activation-sequence and active-county checks reject stale completions. Single-package HTTP, parsing, or geometry failures leave no successful roadway state. Generic partition activation first retrieves the certified manifest identity, then retrieves every governed part; a missing manifest, missing part, network error, invalid JSON, or empty line geometry fails the whole activation closed. Harris continues to use its specialized viewport-aware implementation.

The browser does not hash the large LP210 packages. Exact URL, byte, and SHA-256 identities remain recorded in the runtime entry and LP210 certificate, while LP210 portable certification is the publication trust boundary. No 1.86 GB recertification was performed.

## Accounting

| Measure | Result |
|---|---:|
| Existing protected | 28 |
| LP210 activated | 226 |
| Runtime after | 254 |
| Single-package active | 246 |
| Partitioned active (Harris + LP210) | 8 |
| Local active | 3 |
| Remote active | 251 |
| Duplicate FIPS / county IDs | 0 / 0 |
| Missing / extra Texas counties | 0 / 0 |
| Supabase uploads / remote mutations / database writes | 0 / 0 / 0 |

## Modes

The PowerShell entry point defaults to `WhatIf`. `Apply` is explicit, baseline guarded, atomic per file, immediately reproducible, and idempotent. `Verify` is read-only and requires the exact committed 254-county target. Final reports are written only by the first successful apply, preventing WhatIf/Verify downgrade.
