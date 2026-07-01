# GRIDLY V710 — Directional Incident Context Readiness Audit

## Executive Summary

**Mission:** Know Before You Go  
**Product posture:** Awareness Platform First; Route Intelligence Second  
**Scope:** Audit only. No runtime, UI, alert, route, navigation, rendering, county, Supabase, extraction, candidate, or location-builder changes were made.

**Final determination: READY WITH OBSERVATIONS**

The current production incident pipeline is structurally capable of carrying a roadway string such as `US 90 Westbound` through the principal location-text surfaces because those surfaces consume plain display labels rather than a strongly typed road/direction object. However, the current directional candidate inventory is **not broad enough** for production incident enrichment across the requested Liberty-area corridors. Existing directional runtime evidence is limited to the `US 59 / I-69` corridor inventory, where 164 of 245 extracted segments are eligible runtime candidates and 81 are review-excluded. No current candidate inventory was found for US 90, TX 146, TX 321, FM 1960, FM 1409, or FM 1011.

Implementation planning can proceed only as a governed planning phase, not as production enrichment enablement. The recommended next step is to expand corridor extraction/validation coverage and define a fail-closed incident-location enrichment adapter that preserves current wording unless a strong, county-contained candidate exists.

## Current State

Gridly currently has directional infrastructure from the V684–V704 sequence, but the production incident pipeline remains disconnected from directional labels for alerts, Awareness Brief ownership, Route Watch, and map rendering. Directional runtime candidate evidence remains audit-visible and user-facing display remains disabled.

Relevant runtime state:

- Directional runtime candidates are generated from V686 confidence evidence and V694 architecture evidence.
- Runtime candidate prototype outputs report candidate generation as available, with user-facing display disabled and alerts/awareness not connected.
- V704 directional awareness can render an internal Top Awareness directional card in harness contexts, but V705/V706 visibility semantics show no DOM-visible production directional wording after Awareness Brief ownership hydration.
- Production incident wording remains based on existing location strings, road lookup payloads, active hazard fields, and crossing labels.

## Directional Infrastructure Review

| Capability | Evidence | Readiness |
|---|---:|---|
| Segment inventory available | 245 total segments in directional candidate prototype | Ready with observations |
| Runtime-eligible directional candidates | 164 | Ready for prototype corridor only |
| Review-excluded candidates | 81 | Correctly excluded |
| Bearing-only runtime candidates | 0 | Ready |
| User-facing directional display | disabled | Protected |
| Alerts connected to directional runtime | false | Not connected by design |
| Awareness connected to directional runtime | false | Not connected by design |
| Route Watch connected to directional runtime | false | Protected |

The infrastructure is suitable for **candidate evaluation** but not yet for broad **incident enrichment** because the extracted corridor set is narrow and the production incident pipeline has no approved adapter that decides when to append direction inside a location phrase.

## Incident Coverage Readiness

This audit assessed current incident categories against the fields already used in the production pipeline: road name, route/corridor, location label, crossing name, coordinate-backed road lookup, and community/awareness area fields. The categories below can carry directional context only when they already include a specific roadway/corridor and a matching strong directional candidate.

| Incident type | Eligible | Ineligible | Unknown | Assessment |
|---|---:|---:|---:|---|
| Road hazard | Yes, when road/corridor or coordinates resolve to a roadway | Generic community-only reports | Reports with only area/place labels | **Unknown overall** — structurally eligible, data varies by report |
| Flooding / high water | Yes, especially official records with `route_name`/`roadway` | Countywide/weather-only notices | Community flooding without road field | **Unknown overall** |
| Disabled vehicle | Yes, when official/source record includes route or coordinates | Non-roadside/area-only records | Stale/expired records without location detail | **Eligible for records with route context** |
| Crash / wreck | Yes, when route/coordinates exist | Area-only crash notes | Records missing route/cross street | **Eligible for records with route context** |
| Construction / lane closure | Yes, when official records include route/corridor | Project notices without segment detail | Long-duration work with vague description | **Eligible for records with route context** |
| Traffic backup | Yes, if tied to a named roadway | General congestion/community area reports | Reports with only narrative text | **Unknown overall** |
| Crossing blocked | Yes, if crossing has roadway/crossing label and nearby corridor candidate | Crossing-only without corridor direction | Railroad/crossing records missing road context | **Ready with observations** |
| Crossing cleared | Same as crossing blocked, but direction should normally remain suppressed unless the active/cleared wording policy authorizes it | Cleared records with no active incident context | Low-quality crossing labels | **Ready with observations** |

**Coverage conclusion:** Existing incident types are semantically compatible with directional location text, but production enrichment coverage depends on per-record roadway specificity and corridor candidate availability. The current codebase does not expose a live production incident corpus in-repo that can provide exact percentages by active incident type, so the type-level readiness is classified using pipeline capability and fixture/evidence coverage rather than live Supabase counts.

## Location Builder Readiness

Question: Can current location builders accept `US 90 Westbound` without structural changes?

| Surface | Primary path reviewed | Classification | Notes |
|---|---|---|---|
| Alert cards | `normalizeGridlyAlertCardLocationLabel` → `buildGridlyAlertCardConsumerModel` | **Ready with observations** | Location line is a string selected from alert/road/crossing fields. It can carry `US 90 Westbound`, but upstream enrichment must avoid duplicating `on`/`at` grammar. |
| Awareness Brief | `buildGridlyLightweightActiveAwareness` | **Ready with observations** | Headline/location text uses active item fields and selected incident detail. It can display a directional road string, but V706 ownership displacement means directional awareness is not owner of final Awareness Brief content. |
| Hazard popups | `buildGridlyHazardPopupConsumerModel` | **Ready** | Popup model consumes title/description/location strings. Direction inside location can pass through as plain text. |
| Crossing popups | Crossing popup/location label paths and crossing labels | **Ready with observations** | Crossing wording can include road/crossing names; adding corridor direction requires careful grammar so crossing identity remains primary. |
| Localized intelligence | `refreshPortraitV2LocalizedIntelligence` and location/audit helpers | **Ready with observations** | Localized intelligence consumes rendered/string location context. Direction can appear if supplied as part of the accepted location label. |
| Community awareness | active awareness/community hazard inputs | **Ready with observations** | Community reports may be generic or place-based; directional enrichment must be suppressed unless road specificity and candidate confidence are present. |

**Builder conclusion:** No structural changes appear necessary for the string `US 90 Westbound` itself. The missing piece is not string capacity; it is an approved upstream enrichment decision layer with fail-closed behavior and duplication safeguards.

## Directional Candidate Readiness

### Aggregate candidate metrics

| Metric | Count |
|---|---:|
| candidateCount | 164 |
| reviewExcludedCount | 81 |
| directionallyReadyCandidateCount | 164 |
| protectedCorridorCandidateCount | 164 |
| totalSegmentsEvaluated | 245 |
| blockedCandidateCount | 0 |
| bearingOnlyRuntimeCandidateCount | 0 |

### Coverage by required corridor

| Corridor | Candidate availability | Candidate count | Review-excluded count | Directionally ready | Protected corridor readiness |
|---|---|---:|---:|---:|---|
| US 90 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |
| I-69 | Available as `US 59 / I-69` inventory | 164 | 81 | 164 | Ready with observations |
| TX 146 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |
| TX 321 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |
| FM 1960 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |
| FM 1409 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |
| FM 1011 | No extracted directional inventory found | 0 | 0 | 0 | Not eligible |

**Candidate conclusion:** Directional candidates are production-confidence-ready only for the currently extracted I-69/US 59 package. The requested incident-context corridors are mostly uncovered.

## Confidence Readiness

| Confidence class | Count | Production enrichment interpretation |
|---|---:|---|
| High confidence | 164 | Eligible for future enrichment planning, corridor-limited |
| Medium confidence | 0 | No medium tier available in current evidence |
| Review required | 81 | Must remain excluded |
| Excluded / blocked | 81 review-excluded, 0 blocked | Not eligible for production wording |

Production confidence coverage is **insufficient for broad production incident enrichment** because strong candidates exist only in the extracted `US 59 / I-69` inventory. The confidence model itself is strong enough to support a future gated enrichment adapter, but the corridor inventory is not broad enough.

## Corridor Eligibility Review

| Protected corridor | Eligibility | Rationale |
|---|---|---|
| US 59 / I-69 | **Ready with observations** | 164 strong candidates and 81 review exclusions; county containment passes in runtime prototype evidence, but incident enrichment adapter is not connected. |
| US 90 | **Not eligible** | No directional candidate inventory found for V710. |
| TX 146 | **Not eligible** | No directional candidate inventory found for V710. |
| TX 321 | **Not eligible** | No directional candidate inventory found for V710. |
| FM 1960 | **Not eligible** | No directional candidate inventory found for V710. |
| FM 1409 | **Not eligible** | No directional candidate inventory found for V710. |
| FM 1011 | **Not eligible** | No directional candidate inventory found for V710. |

Current protected corridors satisfy V709 requirements only for planning around the existing `US 59 / I-69` package. They do not yet satisfy V709 for broad incident location enrichment on the listed corridors.

## Fail-Closed Review

**Classification: Pass**

Current production wording remains unchanged because directional incident enrichment is not implemented or connected. If no directional candidate exists, the current builders continue to use existing road/location labels such as:

- `Disabled Vehicle on US 90 at Waco Street`
- `Crash / Wreck on I-69`
- `Flooding on FM 1409`

The V695 runtime candidate prototype explicitly defines fail-closed behavior: missing source, missing evidence, missing confidence, or invalid containment returns `candidateCount = 0` and `failClosedState = true`; degraded directional intelligence is not allowed. Therefore, no blank, degraded, or broken wording is expected from the current non-connected state.

## County Containment Review

**Classification: Pass with observations**

| County | countyContainmentPass | crossCountyLeakageDetected | directionalLeakageDetected | Notes |
|---|---:|---:|---:|---|
| Liberty | true | false | false | Runtime containment audit reports county-contained candidates and excludes invalid candidates. |
| Montgomery | true | false | false | Strong candidates exist in Montgomery for I-69/US 59; runtime prototype validation reports containment pass. |
| San Jacinto | true | false | false | Limited strong candidate evidence exists; review-required records remain excluded. |

Observation: Prior confidence evidence includes Harris and missing-county segments in the source inventory. These are not a runtime leakage finding because review buckets and containment rules exclude invalid candidates, but any future production incident adapter must preserve active-county filtering and never infer direction across county boundaries.

## Production Impact Assessment

If directional incident context were enabled today under the required fail-closed, high-confidence-only posture, the likely share of incidents receiving directional enrichment would be:

**0–25%**

Supporting rationale:

1. Strong directional candidates currently cover the extracted `US 59 / I-69` package only.
2. Six of the seven minimum-review corridors have no in-repo directional candidate inventory for V710.
3. Incident types are structurally compatible, but many active/community records can be area-only, crossing-only, or generic.
4. Production surfaces are not connected to the directional runtime, so enabling would require a new adapter and strict candidate matching.

## Risk Review

| Risk | Severity | Mitigation required before implementation |
|---|---|---|
| Corridor undercoverage causes inconsistent enrichment | High | Expand extraction and confidence validation to US 90, TX 146, TX 321, FM 1960, FM 1409, and FM 1011. |
| Directional wording could imply navigation guidance | Medium | Keep direction embedded in location only; no route instructions, no alternate-route language. |
| Awareness Brief ownership displacement | Medium | Enrichment must integrate with the actual Awareness Brief owner, not the displaced directional awareness card. |
| Grammar duplication | Medium | Add wording tests for `on US 90 Westbound at Waco Street`, no `on on`, no dangling direction. |
| County leakage | High | Require active county containment pass for every enrichment decision. |
| Review-bucket promotion | High | Keep review-required, missing-county, HOV/HOT, reversible, construction, missing-oneway candidates excluded. |

## Protected Systems Verification

Protected systems remain unchanged in the audited evidence and runtime code state:

| Protected system | Required value | Verified value | Status |
|---|---:|---:|---|
| historicalReadsEnabled | false | false | Pass |
| historyUiEnabled | false | false | Pass |
| DriveTexasPaused | true | true | Pass |
| TransportationIntelligenceEnabled | false | false | Pass |
| TransportationIntelligenceDisplay | false | false | Pass |
| TransportationIntelligenceActivation | false | false | Pass |

## Final Determination

**READY WITH OBSERVATIONS**

Gridly is ready for **implementation planning** of directional incident context, but not ready for direct production enrichment. The existing location builders can accept direction embedded in a road string, and the runtime directional confidence model can produce strong, fail-closed, county-contained candidates. However, corridor availability is currently too narrow, confidence coverage is corridor-limited, and production incident surfaces are intentionally not connected to directional candidates.

### Implementation readiness recommendation

Proceed with a planning milestone that defines:

1. A fail-closed incident-location enrichment adapter.
2. Corridor extraction/validation expansion for US 90, TX 146, TX 321, FM 1960, FM 1409, and FM 1011.
3. A high-confidence-only production gate.
4. County-contained matching requirements.
5. Surface-specific copy tests for alert cards, Awareness Brief, hazard popups, crossing popups, localized intelligence, and community awareness.
6. Explicit protection that no route, navigation, alert priority, or UI behavior changes occur when direction is unavailable.
