# Post-manual statewide certification

> Audit/certification only. No production repair, source-authority change, or county/community patch is authorized.

## Statewide inventory

- 254 counties
- 1859 canonical communities
- 2058 county/community memberships
- 163 multi-county identities

## Contract matrix

| ID | Contract | Classification | Population | Pass | Observed/static fail |
|---|---|---:|---:|---:|---:|
| A | identity / membership conservation | CERTIFIED | 2058 | 2058 | 0 |
| B | presentation coordinate validity | CERTIFIED | 1859 | 1859 | 0 |
| C | multi-county canonical home-area activation | REQUIRES OWNER BROWSER ACCEPTANCE | 163 | 0 | 9 |
| D | multi-county membership resolution | CERTIFIED | 163 | 163 | 0 |
| E | downstream county convergence | REQUIRES OWNER BROWSER ACCEPTANCE | 163 | 0 | 2 |
| F | crossing inventory availability | CERTIFIED | 254 | 254 | 0 |
| G | crossing coordinate validity | NOT DETERMINISTICALLY CERTIFIABLE | 254 | 0 | 0 |
| H | watched-count derivation | REQUIRES OWNER BROWSER ACCEPTANCE | 254 | 0 | 2 |
| I | viewport/render eligibility | REQUIRES OWNER BROWSER ACCEPTANCE | 254 | 0 | 0 |
| J | official roadway consumer eligibility | REQUIRES OWNER BROWSER ACCEPTANCE | 1859 | 0 | 1 |
| K | generated incident consumer eligibility | REQUIRES OWNER BROWSER ACCEPTANCE | 1859 | 0 | 4 |
| L | active-issue count derivation | REQUIRES OWNER BROWSER ACCEPTANCE | 1859 | 0 | 0 |
| M | KBYG grouping semantics | REQUIRES OWNER BROWSER ACCEPTANCE | 1859 | 0 | 0 |
| N | headline count/severity semantics | REQUIRES OWNER BROWSER ACCEPTANCE | 1859 | 0 | 1 |
| O | stale-state transition protections | REQUIRES OWNER BROWSER ACCEPTANCE | 2057 | 0 | 0 |

“Observed/static fail” never extrapolates a manual reproduction to unvisited communities. Zero pass on browser contracts means **not mechanically certified**, not that every row failed.

## Key findings

- Static identity, coordinate, membership-resolution, and crossing-inventory contracts certify cleanly.
- Canonical activation and downstream convergence remain owner-browser contracts across all 163 multi-county identities; the static LP213 model cannot override the Midland/Abilene and canonical-click reproductions.
- Val Verde has seven governed communities; six carry manual findings and require a single countywide transition audit.
- Watched counts, viewport render parity, current official/generated incident propagation, governed active counts, KBYG grouping, headline semantics, and stale transitions are runtime contracts.
- Performance evidence points to repeated resolution/render work, layout-sensitive marker/popup work, retry timers/frames, and independently settling consumer refreshes. Instrument a transaction before repair.

## Positive controls

- Brownfield
- Snyder
- Sweetwater
- San Angelo
- Seguin
- Plainview
- Rankin
- Big Lake
- Stanton
- Pearsall / FM 140 flooding

## Stop point

Preserve this checkpoint and obtain owner browser evidence for contracts C, E, H, I, J, K, L, M, N, O before production repair. The low-water crossing idea remains research backlog only.
