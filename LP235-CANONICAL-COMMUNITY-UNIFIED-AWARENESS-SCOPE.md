# LP235 — Canonical Community Unified Awareness Scope

## Product contract

A selected Texas city or town is one user-facing awareness scope identified by its governed Census PLACE GEOID (`place-48xxxxx`). County membership remains an internal governance and persistence choice; it does not create another search result or redefine PLACE evidence. County selections remain county-scoped. No display-name join, county union, county auto-switch, or community-specific branch is permitted.

## Before and after

| Path | Before | LP235 |
|---|---|---|
| Place search | One membership row per county (Austin and Dallas repeated) | One `City` row (`Austin, TX`, `Dallas, TX`) keyed by PLACE GEOID |
| County search | One countywide row | Unchanged |
| Place selection | Canonical resolution plus a visible membership choice | Canonical identity/presentation plus all memberships; current governed membership is silently preserved when valid |
| Crossing map | Active-county inventory fed the renderer | Exact LP233 IDs resolve through a parse-once 9,094-record runtime index; the existing viewport and representative-marker policies receive that bounded PLACE set |

## Authority matrix

| Family | Authority | LP235 behavior |
|---|---|---|
| Search/selection | Governed PLACE GEOID and county FIPS registry | Consolidate by GEOID only; retain distinct same-name GEOIDs |
| Crossings | LP232 attribution → LP233 ID membership → governed FRA runtime record | Exact lookup; fail closed if any ID cannot resolve |
| DriveTexas | LP201 presentation coordinate and existing LP234 distance/radius authority | Unchanged; no county equality and no radius change |
| Local hazards | Existing report PLACE attribution/source lineage | Use only certified attribution; otherwise audit reports `authorityAvailable: false` |
| Blocked crossing | Report lifecycle plus canonical crossing ID | Join through exact LP233 membership; lifecycle is unchanged |
| Weather | Existing provider point, polygon, zone, and county-warning semantics | Observe provider result; never union membership counties |
| Alerts | Governed consumer projection and final writer lineage | Every eligible identity must have presentation lineage or appear in `alertsUnaccountedIds` |
| KBYG | Existing official/community source separation | Official roadway and community counts remain separate |
| Top Awareness / Community Pulse | Governed active evidence | Passive reconciliation; positive evidence must not be quiet |
| Location Context | Governed production evidence and identity deduplication | Production count is observed without raw-cardinality coercion |

## Crossing root cause and repair

Dallas selected with Collin governance previously sent the 185-record Collin inventory to `renderCrossings`; all records were outside the Dallas viewport although LP233 had certified and resolved 415 Dallas IDs. LP235 adds a static, cacheable runtime record index derived from the same governed statewide FRA inventory. Selection performs an O(PLACE crossing count) exact-ID projection. That projection replaces the county inventory only for a canonical PLACE and only when every ID resolves. All later filters, viewport bounds, clustering, and marker caps are unchanged. The repair does not union county packages and does not render all 415 records indiscriminately.

## Family semantics and fail-closed cases

`gridlyLP235CanonicalCommunityScopeAudit()` is passive. It reports canonical identity, membership/governance, search cardinality, crossing certification/resolution/map counts, DriveTexas, local and blocked reports, weather, Alerts lineage, KBYG, Top Awareness, Community Pulse, and Location Context. If exact local-report PLACE attribution, blocked-crossing identity, weather provider authority, or crossing resolution is unavailable, its `familyAuthority` entry is false with the precise gap. An unavailable family is never approximated with county inventory, name, center, nearest place, or newly invented radius.

Alerts completeness is not inferred from grouped card count. The LP234 production lineage audit supplies governed IDs, explicit grouped-presentation evidence rows, writer mappings, and unaccounted IDs. LP235 passes Alerts only when all governed evidence is accounted for and no canonical evidence was removed by a county/community filter. Existing count wording is unchanged pending owner certification of grouping lineage.

## Performance

The 9,094 compact crossing records are fetched once with `force-cache`, parsed once, and indexed by ID. A selection resolves only its certified ID array (Dallas: 415; Austin: 154), followed by existing bounded viewport and representative policies. Search uses a `Map` keyed by PLACE GEOID. LP235 adds no provider fetch, polling, recurring timer, browser polygon processing, raw TIGER geometry, or per-render statewide scan.

## Protected systems and exclusions

LP201 coordinates, LP232 attribution, LP233 membership/watched counts, LP234 DriveTexas radius/provider lifecycle, active-county persistence, weather provider rules, LP226 Alerts writer, LP227 KBYG source separation, report lifecycle, routing, service-worker architecture, and provider connectors are unchanged. Katy FM0529 remains excluded by the existing seven-mile DriveTexas rule. No active county is switched to retrieve evidence.

## Owner browser acceptance

Do not merge before owner acceptance. In a production-data browser:

1. Search Austin, Dallas, Katy, and Corpus Christi; confirm exactly one PLACE row (`<community>, TX`, `City`). Search Travis County and confirm one county row.
2. Select each governed membership for Austin, Dallas, Katy, Corpus Christi, Abilene, and Midland without changing the canonical evidence identities. Repeat Sulphur Springs, Liberty, Fredericksburg, and Pecos as single-county controls.
3. Center Dallas at the LP201 anchor and run `gridlyLP235CanonicalCommunityScopeAudit()`. Confirm canonical `place-4819000`, certified/resolved/map input 415, and a positive rendered count only when canonical crossings are inside the viewport.
4. Confirm Austin/Dallas DriveTexas positives survive through Alerts, KBYG Official Roadways, Pulse, Top Awareness, and Location Context. Confirm Katy FM0529 remains outside.
5. Inspect `alertsUnaccountedIds`; it must be empty, and every grouped card must carry identity-backed lineage. Do not interpret six cards as nineteen records.
6. Confirm weather follows provider point/polygon/zone semantics under membership changes and does not union county warnings.
7. Confirm local and blocked-crossing fixtures retain canonical identity and lifecycle across membership changes; an unavailable authority must fail closed visibly in the audit.
8. Record timing for search, crossing resolution, and projection, and confirm no repeated network request or timer.

Recommendation after automated certification: **LP235 READY FOR OWNER BROWSER ACCEPTANCE; DO NOT MERGE UNTIL OWNER BROWSER ACCEPTANCE.**
