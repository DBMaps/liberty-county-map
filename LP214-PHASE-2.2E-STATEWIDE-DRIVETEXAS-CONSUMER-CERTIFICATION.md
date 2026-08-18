# LP214 Phase 2.2E — Statewide DriveTexas consumer certification

## 1. Quick summary

The governed DriveTexas authority is valid for all **1,859** canonical communities in all **254** counties. All use the deterministic seven-mile registry default, all synthetic inside/outside Point and LineString checks pass, and all 163 multi-county PLACE identities remain intact. The audit found one statewide consumer propagation defect: Location Context's broad “active issues nearby” count could omit official hazards and allow the narrower Alerts grouped count to override the shared awareness count. The shared-count reconciliation is repaired without changing Alerts ownership.

## 2. Consumer surface ownership matrix

The machine-readable matrix is `data/generated/lp214-drivetexas-consumer-surface-audit.json`. Primary consumers are KBYG/Travel Brief, Official Roadways, and map markers. Secondary consumers are Awareness Brief evidence, Community Pulse shared summary, official hazard popup, destination awareness, and county/community summary. Quiet state is health-only. Alert cards, Alerts sheet, crossing popup, and route intelligence are intentionally not DriveTexas-owned. Location Context was incomplete and is repaired.

Each matrix row records the exact production path, records/status contract, activity rule, and Dallas disposition. Records, source status, healthy-empty, failed, retained, freshness timestamp, quiet eligibility, and disclosure are governed by `gridlyGetDriveTexasConsumerSourceStatusEnvelope`; official activity remains distinct from community evidence.

## 3. Screenshot findings

* **Awareness Brief:** correct as a secondary evidence consumer. Official hazards may change shared activity/status and trust evidence, but the hierarchy does not make DriveTexas the primary headline owner; generic “Local awareness” is not itself a no-roadway claim.
* **Community Pulse:** correct when its community-only empty copy is visibly scoped to Community. “No community travel conditions reported” does not contradict separately labeled Official Roadways.
* **KBYG / Official Roadways:** correct primary presentation of the eight eligible Dallas conditions.
* **Map markers:** correct primary official-roadway presentation.
* **Alerts sheet:** `EXPECTED_BY_DESIGN`; its community incident registry does not manufacture alerts from DriveTexas.
* **Location Context:** “4 active issues nearby” was not reliable as the broad shared count in the observed Dallas state. It is classified `OTHER_COUNT_CONTRACT_DEFECT`, not proof that every marker must be counted.

## 4–5. Defect and repair

`getGridlyReconciledAwarenessActiveIssueCount` did not directly include `activeHazardsInArea`, although the official publisher adds eligible, lifecycle-active, area-qualified DriveTexas situations there. In addition, a positive grouped Alerts count replaced rather than bounded the shared reconciled count. Location Context now includes shared active hazards and uses the maximum of the narrower grouped count and shared count. It does not recount DOM markers, collapse source labels, create alerts, or introduce geographic special cases.

The publisher already filters cleared/expired/inactive/historical/removed/resolved/cancelled records, deduplicates by canonical record key, rebuilds after initial connector synchronization, and participates in the official-provider refresh bridge. Healthy-empty contributes zero; failure remains non-quiet; retained records retain disclosure.

## 6–8. Statewide certification and geometry

| Measure | Result |
|---|---:|
| Counties | 254 |
| Canonical communities | 1,859 |
| Memberships | 2,058 |
| Explicit-radius communities | 0 |
| Governed-default-radius communities | 1,859 |
| Invalid focus / radius / authority / owner review | 0 / 0 / 0 / 0 |
| Radius propagation failures | 0 |
| Multi-county canonical identities | 163 |

For every community, procedural tests prove an inside Point passes, outside Point fails, intersecting LineString passes, outside LineString fails, `[longitude, latitude]` remains ordered, and malformed/swapped GeoJSON fails closed. No geometry arrays or source payloads are persisted. Dallas retains memberships 48085/48113/48121/48257/48397; Houston retains 48157/48201/48339/48473. Both use canonical focus/radius, never an arbitrary member county.

## 9. Source-health preservation

The shared envelope preserves `HEALTHY_WITH_DATA`, truthful `HEALTHY_EMPTY`, failed-with/without-retained states, unavailable/unknown states, retained timestamp, connectivity, fetch failure, quiet eligibility, and consumer disclosure. The count repair consumes only the already governed shared summary and changes none of those semantics.

## 10–12. Modified and protected surfaces

Modified production: `js/app.js` count reconciliation only. Added deterministic LP214 builder, compact certification/audit artifacts, tests, and this report. Alerts, crossings, route intelligence, weather/NWS, provider/connector ingestion, authority selection, PLACE membership, and awareness hierarchy are unchanged. Weather/NWS and LP215 were not started.

## 13–14. Diff/status

Capture `git diff --stat` and `git status --short --branch` immediately before owner handoff; generated build directories and dependency directories are pre-existing untracked environment output and are excluded from the commit.

## 15. Exact final owner browser sample plan

Run Dallas (`place-4819000`), Houston (`place-4835000`), Liberty (`place-4842568`), Talco (`place-4871840`), El Paso (`place-4824000`), McAllen (`place-4845384`), and Amarillo (`place-4803000`). For each record selected canonical identity; connector/source status; awareness candidate, proof, geography, freshness and final eligible counts; envelope status; official markers; KBYG/Official Roadways; secondary summary/Location Context; and source disclosure. Counts need not equal raw map markers where the map contains non-issue layers, but Location Context must equal its governed shared active-issue scope.

Then transition Dallas→Houston (community and multi-county identity), Houston→Liberty (county), and Liberty→Talco (rural); verify recomputation and no prior-area leakage. Finally use a fresh browser with DriveTexas unconfigured/failing and verify non-quiet unavailable language, then a governed healthy-empty fixture and verify zero without false failure.

### Dallas count control

Compare: (1) visible official active issue markers by record identity (excluding crossing/destination/non-issue markers), (2) eight governed eligible DriveTexas situations, (3) active community reports, (4) active crossing-derived conditions, and (5) other shared hazards. The earlier displayed four came from the narrower grouped Alerts/community contract overriding the shared summary; after repair the displayed broad count must be the deduplicated shared active issue count. Live screenshots did not supply a stable exact total for all other sources, so final browser certification must record those source-specific values rather than invent them.

## 16. Merge recommendation

Code and deterministic statewide certification are suitable for review after automated checks. Do **not** close LP214 or merge automatically: closure remains conditional on the representative browser controls above passing in the owner environment.
