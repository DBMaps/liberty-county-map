# LP223 — Blocked-Crossing Consumer Policy Reconciliation

## Decision

An active, current, geographically eligible user report that a railroad crossing is blocked is a community travel-awareness condition. It is eligible for Location Context, the map and crossing popup, Community Pulse, KBYG/Travel Brief, and Alerts. It is not official-roadway evidence. A cleared report is excluded from every active surface and retained by crossing history when its identity remains available.

This contract is statewide and evidence-driven. It contains no city, county, crossing, or report fixture identifiers.

## Pre-LP223 production ownership audit

Report submission and persistence already create a crossing report in the crossing-specific report system. LP219.3 independently normalizes that runtime record into governed lifecycle evidence. Before LP223 the paths then diverged:

| Surface | Pre-LP223 production path | Finding |
| --- | --- | --- |
| Location Context | active reports plus active hazards; LP219 governed count audit | Blocked crossings were policy-eligible and could appear through the shared summary. A governed omission could be a real identity/observation gap, but was not proof that the crossing path failed. |
| Map | `activeReports` → crossing inventory → `crossingMarkers`/`crossingLayer` | Legitimate crossing-specific owner. The unified incident renderer already suppresses its duplicate blocked-crossing marker. LP219's governed-only observation could therefore mislabel a working marker as propagation failure. |
| Crossing popup | crossing marker → crossing popup | Legitimate crossing-specific owner, coupled to the canonical crossing marker and report. |
| Community Pulse | shared active-community summary | Governed summary owner; a blocked report was already eligible. |
| KBYG / Travel Brief | relevant-condition authority plus LP219.4 governed community projection | Fragmented: Travel Brief could recognize the condition while LP219.4 declared the compact governed contract undefined. |
| Alerts | established crossing candidate/card path and LP219.4 governed Alerts projection | Fragmented: historical Pecos browser evidence showed **Crossing Blocked**, while governed lineage declared the product contract undefined. Both paths could select the same report, creating contradictory audit results and a duplicate-publication risk. |
| History | crossing report lifecycle/persistence and crossing-history consumers | Crossing-specific owner where a cleared, identified report is retained; it is not active awareness. |
| Official Roadways | DriveTexas projection | Correctly ineligible for a community blocked-crossing report; unchanged. |

Thus the reported `PROPAGATION_FAILURE` values for Location Context, map, and popup were not automatically runtime defects. They could be incomplete audit observation of a separate legitimate publisher. The Alerts and KBYG `PRODUCT_CONTRACT_UNDEFINED` result was a genuine product-policy gap. Map duplication was legacy dual availability with an existing render arbitration to `crossingLayer`.

## Live owner evidence considered

Sulphur Springs is the primary mixed owner control: one current governed `active_hazard/closed_road` and one current governed `community_report/blocked_crossing`. Before LP223, compact governed KBYG scope was one while Travel Brief relevant-condition scope was two. Under the final contract both identities belong to Alerts, Community Pulse, Location Context, and community KBYG; cardinality is two, not three.

Historical Pecos owner evidence demonstrated that the crossing-specific Alerts candidate path can render **Crossing Blocked**. That evidence proves historical behavior, not sole product authority. LP223 makes governed awareness the canonical membership authority for Alerts and KBYG while preserving the existing crossing-specific card/presentation machinery.

## Final surface ownership

| Surface | Active blocked crossing | Publisher / path | Cleared behavior |
| --- | --- | --- | --- |
| Location Context count | Eligible once | Governed awareness over the canonical report identity | Removed from active count |
| Map | Eligible once | Crossing-specific `crossingLayer`; unified marker is suppressed | No stale active blocked marker |
| Crossing popup | Eligible | Crossing-specific marker/popup path | No active blocked state |
| Community Pulse | Eligible once | Governed awareness/shared community summary | Does not contribute active state |
| KBYG / Travel Brief | Eligible once as a community condition | Governed community membership; existing presentation consumes it | Does not force active wording |
| Alerts | Eligible once | Governed membership; existing crossing-specific alert presentation renders the row | No active Alert |
| History | Not an active-history row while active | Crossing-specific lifecycle/persistence | Retained when cleared and identified |
| Official Roadways | Ineligible | DriveTexas remains independent | Unchanged |

## Identity and deduplication contract

The canonical evidence key is the governed community-report identity (`community_report:<report identity>`). The crossing-specific publisher and governed publisher must carry that identity across consumer boundaries. Repeated input with the same key is collapsed before projection and is reported as `DEDUPLICATED_SHARED_EVIDENCE`. Spatial rendering remains arbitrated to the crossing layer. Alerts, KBYG, Community Pulse, and Location Context consume one governed membership row per key. Official roadway evidence remains a separate identity and may coexist without being merged into or attributed to the community report.

Identity-unavailable records fail closed. Stale, inactive, old-area, and old-county records are excluded from active membership. Geographic filtering occurs before publication. These rules prevent count inflation and stale state without changing LP219.3 lifecycle semantics.

## Exact LP223 production changes

1. Defined blocked-crossing eligibility for governed Alerts and community KBYG.
2. Added explicit per-surface publisher ownership and policy statuses to the existing governed-awareness lineage.
3. Added History to that same diagnostic truth and observes cleared crossing records already retained by the report path.
4. Exposed the canonical deduplication identity/status, final consumer membership, omission reason, and publication-path classification.
5. Preserved crossing-layer marker arbitration and every existing crossing popup/presentation path.

No crossing-report persistence, Supabase synchronization, package/provider data, DriveTexas, Weather/NWS, Route Watch, routing, viewport, multi-county identity, or performance code was changed. LP219.3 lifecycle rules, LP219.4 active-hazard propagation, LP222 grammar authority, LP221 Val Verde runtime, and LP220 viewport behavior remain protected.

## Deterministic controls

* **Quiet:** no active membership.
* **One active blocked crossing:** one Location Context issue, map marker/popup condition, Community Pulse condition, KBYG condition, and Alert; no active History projection.
* **Cleared:** zero active-surface membership, one eligible History identity.
* **Stale / old-area / old-county / identity unavailable:** zero active membership.
* **Duplicate:** one canonical membership and a deduplication diagnostic.
* **Blocked crossing + active road hazard:** two community awareness/Alerts/KBYG memberships.
* **Blocked crossing + official roadway evidence:** distinct community and official identities; Official Roadways contains only the official record.

## Acceptance boundary

Owner browser acceptance is still required for Sulphur Springs, Pecos, a quiet control, and a cleared transition. LP223 does not claim browser acceptance and does not authorize a merge.
