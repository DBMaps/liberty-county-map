# LP229 — Statewide Canonical Community Awareness Scope Audit

## Decision

**Overall classification: `MIXED_AUTHORITY — LAUNCH_SAFE_WITH_KNOWN_LIMITATIONS`.** No existing certified authority proves that current behavior is hiding evidence which must be shown, so LP229 finds no launch-blocking defect. It also does not authorize a production repair.

## Evidence-family certification

| Family | Current relevance authority | Membership limited? | Safe canonical aggregation today? | Classification |
|---|---|---:|---:|---|
| Community reports / hazards | Lifecycle-active records are passed to `isGridlyRecordInAwarenessArea`: governed area geometry if present; otherwise county-qualified canonical/text match; otherwise record coordinate (or crossing-inventory coordinate fallback) within the selected presentation radius. | Acquisition/runtime inventory can be active-county limited; the final coordinate-radius predicate itself is not a county union. | Not as a currently available collection. Coordinate-bearing sibling records have sufficient relevance evidence, making a future bounded acquisition/consumer reconciliation plausible; missing-coordinate records must fail closed. | `NARROW_REPAIR_SAFE` |
| Blocked-crossing active evidence | The same report predicate, with direct report coordinates preferred and the currently loaded crossing coordinate as fallback. Report/canonical evidence identity governs lifecycle/dedup inside the governed projection. | Yes for multi-county source loading and crossing fallback. | No. A coordinate-bearing report may be relevant without asserting static PLACE ownership, but statewide cross-membership coverage and fallback crossing attribution are not certified. | `REPAIR_REQUIRES_NEW_AUTHORITY` |
| DriveTexas | Statewide/shared acquisition, provider normalization, connector selected-awareness projection, then `isGridlyRecordInAwarenessArea` and official-situation projection. Coordinates are retained; LineStrings are reduced to a midpoint. | The source is not county-partitioned. Selected awareness uses presentation coordinate/radius or text, not membership-county union. | Yes for the existing presentation-radius meaning of “nearby,” using provider incident ID to deduplicate before downstream re-keying. This is not PLACE-boundary certification. | `COMMUNITY_SCOPE_ALREADY_CERTIFIED` |
| Weather | NWS/provider geography owns alerts. The loaded connector path filters travel-impact records using radius/text fallback; no certified community polygon, NWS polygon, county/forecast-zone intersection, or canonical-community advisory model exists. | Not proven to vary by membership, but consumer projections diverge. | No county-membership union is safe. Preserve provider scope rather than flattening it. | `CURRENT_BEHAVIOR_INTENTIONALLY_PROVIDER_SCOPED` |

County membership is lineage/governance context only. None of these findings permits unioning an entire sibling county into a community.

## Records and identity retained

Community records may retain governed/canonical evidence IDs, report/incident IDs, canonical community/key, county/source county, coordinates, presentation locality, and lifecycle fields. Presence varies by source. The governed-active projection owns lifecycle eligibility and stable evidence identity; locality fields never override the geography predicate without its existing safeguards. Blocked-crossing reports are report evidence first: a crossing link can recover coordinates, but does not certify that the static crossing belongs to a Census PLACE.

DriveTexas normalization retains provider ID, roadway and point coordinates but does not reliably preserve county. That is consistent with its statewide-shared-source design. Deduplication is strongest at provider incident ID; downstream official-situation IDs can be presentation re-keys and must not be treated as new source incidents.

## Downstream divergence

* **Alerts** owns an authoritative snapshot and independently applies its selected-awareness filter. LP229 does not change its writer, lifecycle, cache, snapshot, card, or location precedence.
* **KBYG** consumes governed community evidence, while official roadway and weather evidence enter provider-specific sections. It is not one universal canonical collection.
* **Community Pulse** consumes the selected community awareness summary.
* **Top Awareness** reuses the Community Pulse/community-awareness summary.
* **Location Context** reuses active report/hazard summary evidence, but its static crossing count remains the independent active-county/radius selector certified by LP228.
* **Map** markers use independent incident/crossing registries plus viewport publication. Marker presence is not the eligibility authority.

Consequently consumer convergence is **not certified** statewide even where an evidence family has adequate relevance authority.

## Controls

### Katy

Canonical identity is Katy / `place-4838476`; governed memberships are `fort-bend-tx`, `harris-tx`, and `waller-tx`. The known DriveTexas lane closure `official-situation-official-roadways-7BA082B4-5CE6-4036-97FA-C4FADBAA3CCF` on FM0529 at 29.87412353353783, -95.91808992841244 is relevant through incident coordinates and Katy's presentation radius—not because it is a Harris, Fort Bend, or Waller county-wide incident. The statewide connector is not partitioned by those memberships. Therefore the relevance result should remain the same under Katy/Harris, Katy/Fort Bend, and Katy/Waller provided each membership resolves the same governed canonical presentation focus. LP229 did not switch memberships or fabricate a live eligible set.

Reports and active crossing evidence cannot receive the same three-membership certification: only loaded records can be enumerated, sibling county acquisition is not one current collection, and crossing-coordinate fallback depends on the selected county inventory. Weather likewise has no certified three-membership advisory union.

### Other multi-county controls

| Community | Canonical key | Governed memberships | Static result |
|---|---|---|---|
| Abilene | `place-4801000` | Jones, Taylor | Canonical identity/presentation authority is stable. Report inventory and blocked-crossing fallback can fragment by selected membership; shared DriveTexas coordinate relevance should not; weather advisory convergence is unknown/provider-scoped. |
| Midland | `place-4848072` | Martin, Midland | Same authority result as Abilene. No live IDs are fabricated. |
| Austin | `place-4805000` | Bastrop, Hays, Travis, Williamson | Same authority result; county-wide union is specifically unsafe for every family. |

### Single-county controls

Sulphur Springs, Liberty, Fredericksburg, and Pecos exercise the same predicates without sibling-membership fragmentation. Existing evidence remains eligible exactly as before. This audit does not claim live evidence where fixtures/runtime records are absent, and it does not convert presentation-radius relevance into municipal-boundary membership.

## Statewide architecture certification

The LP228/LP217 governed inventory remains **1,859 canonical communities, 2,058 memberships, 163 multi-county identities, and 254 counties**.

| Family | Communities with available community authority | Multi-county safe to aggregate | Multi-county selected-membership limited | Radius authority | County-only authority | Unknown/new authority | Dedup certified | Consumer convergence |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Reports/hazards | 1,859 have the predicate architecture; individual records still require qualifying evidence | 0 as a presently acquired all-membership collection | 163 | 1,859 PLACE presentations when no governed geometry/text match wins | county-wide selections only; not promoted to PLACE | record-dependent | governed evidence identity within current projection; cross-membership collection not certified | No |
| Blocked-crossing active evidence | coordinate-bearing reports only; no fabricated count | 0 | 163 | same report predicate | 0 PLACE claims | all fallback-only cross-membership cases | current report identity only | No |
| DriveTexas | 1,859 presentation scopes can evaluate coordinate records | 163 for the existing nearby/radius contract | 0 at source acquisition | 1,859 PLACE presentations | 0 | live payload completeness remains observational | provider incident ID | No |
| Weather | 0 certified canonical advisory scopes | 0 | 0 proven | connector fallback exists but is not certified advisory ownership | 0 safe promotions | 1,859 for canonical advisory ownership | provider ID only in loaded sample | No |

These are architecture/authority counts, not claims that incidents exist in every community.

## Repair boundary and launch risk

A narrow future candidate is to reconcile coordinate-bearing community report/hazard acquisition across governed membership packages, retain source/governed county lineage, run every record through the unchanged canonical presentation predicate, and deduplicate governed evidence identity. That requires owner approval and runtime proof; LP229 does not implement it.

New authority is required before aggregating fallback-only blocked-crossing evidence, asserting static crossing-to-PLACE ownership, or assigning weather polygons/zones/advisories to canonical communities. Provider weather geography must remain intact. No broad pre-launch rewrite is appropriate.

No launch blocker is established: current fragmentation is understandable, and no existing certified authority plus observed missing active safety evidence proves a required item is hidden.

## Preserved marker finding

The Katy FM0529 DriveTexas alert has valid coordinates and “Show on map” moves the map. The prior diagnostic reported **`markerIdentity: null`** while a matching marker DOM candidate existed. Marker ownership/publication remains an independent open defect; LP229 neither certifies nor repairs it.

## Passive helper

`window.gridlyLP229CanonicalCommunityAwarenessScopeAudit()` observes the selected identity, current summary and already-loaded provider connector records. It performs no DOM writes, map movement, source reload, network request, county/membership change, persistence, timer, polling, or production writer invocation. Missing sibling/live records remain missing rather than being manufactured.

**NO PRODUCTION AWARENESS BEHAVIOR WAS CHANGED.**  
**NO WEATHER BEHAVIOR WAS CHANGED.**  
**NO DRIVETEXAS BEHAVIOR WAS CHANGED.**  
**NO ALERTS BEHAVIOR WAS CHANGED.**  
**NO KBYG BEHAVIOR WAS CHANGED.**  
**NO CROSSING BEHAVIOR WAS CHANGED.**  
**NO MULTI-COUNTY GOVERNANCE WAS CHANGED.**  
**NO UNRELATED PRODUCTION CHANGE WAS APPLIED.**

**DO NOT IMPLEMENT A PRODUCTION REPAIR UNTIL OWNER APPROVAL.**
