# V328 — DriveTexas Lifecycle Simulation Fixtures

## Executive Summary

V328 defines fixture-only lifecycle expectations for future official-source DriveTexas incidents before any live integration exists. This milestone does not connect to DriveTexas, ingest live data, create alerts, create markers, alter routing, add map layers, or implement Travel Confidence. It uses representative timelines to decide how official incidents should activate, refresh, become stale, expire, be removed, and reopen.

The recommended model keeps Gridly aligned with **Awareness Platform First, Route Intelligence Second**:

- Official DriveTexas evidence is authoritative that an official source published a condition.
- Community evidence can confirm, add current field context, or continue local awareness after official removal, but it should not silently override the official lifecycle.
- Short-duration incidents age aggressively.
- Long-duration official work/closure records depend on schedule and periodic refresh rather than short freshness windows.
- Flood and high-water records are event-driven and should receive faster stale review than planned work because passability can change quickly.

## Lifecycle Classes

| Lifecycle class | Representative categories | Recommended purpose | Default stale window | Default expiration window |
| --- | --- | --- | --- | --- |
| Short Duration | `crash`, `disabled_vehicle` | Fast-moving roadway disruptions that usually clear quickly. | 15-30 minutes for disabled vehicles; 30 minutes for crashes. | 60-90 minutes without refresh, or immediate official removal. |
| Medium Duration | `lane_closure`, `travel_advisory`, `detour` | Temporary restrictions or official context that may persist across part of a day. | 2-6 hours for advisories; 4 hours unscheduled or 24 hours scheduled for lane closures. | 12 hours without refresh for acute unscheduled records, or official end/removal. |
| Long Duration | `construction`, `bridge_closure` | Planned or structural conditions that can last days to months. | 24-72 hours after missed expected refresh or schedule checkpoint. | Official end/removal; schedule-based review instead of aggressive auto-expiration. |
| Event-Driven Duration | `road_closed` flood closure, `flooded_roadway`, `high_water` | Weather/hydrology conditions where current passability changes quickly. | 1-2 hours for high-water/flooded roadway; 2-4 hours for flood closures. | Official clear/removal/reopen reconciliation, or 6 hours without refresh for active flood closures. |

## Fixture Timelines

### Fixture A — Flood Closure

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| 08:00 | Active | Activate `road_closed` with `event_driven_duration`. |
| 09:00 | Still active | Refresh `lastOfficialSeenAt`; remain active. |
| 11:00 | Still active | Refresh; remain active. |
| 14:00 | Removed | Remove from active awareness immediately and retain audit history. |

- **Activation rule:** Activate when the official flood closure first appears.
- **Refresh rule:** Each active official observation refreshes the same awareness record.
- **Stale threshold:** 2 hours without refresh during active flood context; 4 hours maximum when weather context remains unresolved.
- **Expiration threshold:** Expire on official removal/reopen, or after 6 hours without refresh if removal is never observed.
- **Removal behavior:** Remove from active awareness at 14:00; do not continue displaying the official closure as active.
- **Reopen behavior:** If the same closure reappears within 6 hours with matching identity/location/type, mark as reopened.
- **Community interaction behavior:** Community reports can confirm local conditions, but official removal should downgrade official trust unless a new community-only hazard remains independently active.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source` if refresh is missed.
- **Future Travel Confidence consideration:** Active/updated/confirmed/reopened = Severe; stale = High; removed/expired = None.

### Fixture B — Flood Closure Reopened

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| 08:00 | Active | Activate flood closure. |
| 10:00 | Removed | Mark removed; active official awareness stops. |
| 10:30 | Active again | Reopen the same awareness record if identity matches. |

- **Activation rule:** Reactivate when the official source republishes a matching flood closure.
- **Refresh rule:** Reset `lastOfficialSeenAt` and increment a reopen count at 10:30.
- **Stale threshold:** 2 hours after the latest reopened observation.
- **Expiration threshold:** 6 hours without refresh or the next official removal.
- **Removal behavior:** Preserve the 10:00 removed interval in the audit trail.
- **Reopen behavior:** Treat as a reopened incident, not a brand-new record, when source id or strong spatial/type identity matches within 6 hours.
- **Community interaction behavior:** Community reports during the 10:00-10:30 gap can become continuity evidence but should be labeled community-only until official evidence returns.
- **Trust label evolution:** `Official Source` → `Removed Official Source` → `Reopened Official Source` → `Official Source + Community Confirmed` when applicable.
- **Future Travel Confidence consideration:** Reopened = Severe for flood closure passability.

### Fixture C — Crash

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| 08:00 | Active | Activate `crash` as short duration. |
| 08:20 | Active | Refresh official crash evidence. |
| 09:00 | Removed | Retire active awareness immediately. |

- **Activation rule:** Activate on official crash publication.
- **Refresh rule:** Refresh on each official active observation.
- **Stale threshold:** 30 minutes after the last official observation.
- **Expiration threshold:** 90 minutes without refresh, or immediately on official removal with only short recently-cleared memory.
- **Removal behavior:** Retire from active awareness at 09:00.
- **Reopen behavior:** Same awareness record only if the same source id/location reappears within 90 minutes; otherwise new crash.
- **Community interaction behavior:** Community confirmations can strengthen active trust but should age aggressively.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/confirmed = Moderate; stale = Low; removed/expired = None.

### Fixture D — Disabled Vehicle

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| 08:00 | Active | Activate `disabled_vehicle` as short duration. |
| 08:15 | Active | Refresh. |
| 08:45 | Removed | Remove from active awareness immediately. |

- **Activation rule:** Activate on official disabled-vehicle publication.
- **Refresh rule:** Refresh on official active observation only; avoid long extension from community chatter.
- **Stale threshold:** 15-30 minutes after last official observation.
- **Expiration threshold:** 60 minutes without refresh, or immediate official removal.
- **Removal behavior:** Retire from active awareness at 08:45.
- **Reopen behavior:** Usually a new incident unless the same source id reappears within 60 minutes at the same location.
- **Community interaction behavior:** Community reports can confirm, but should not keep the official disabled-vehicle record active after removal.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/confirmed = Low; stale/removed/expired = None.

### Fixture E — Construction Closure

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| Day 1 | Active | Activate planned-work/closure awareness. |
| Day 7 | Active | Continue as current if schedule or refresh supports it. |
| Day 30 | Active | Continue as long duration, not stale by age alone. |

- **Activation rule:** Activate at official start time or first active observation.
- **Refresh rule:** Daily or periodic official observations keep status current; published end dates govern expiration.
- **Stale threshold:** 24-72 hours after missed expected refresh, depending on schedule.
- **Expiration threshold:** Official end/removal, or 7 days after expected end without refresh for review.
- **Removal behavior:** Remove from active awareness on official removal/end.
- **Reopen behavior:** Same project if schedule/source id match; new phase if location/time scope changes materially.
- **Community interaction behavior:** Community reports can describe current impact but cannot cancel official planned work.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/confirmed = Moderate; stale = Low; removed/expired = None.

### Fixture F — Lane Closure

| Time | Official state | Recommended Gridly state |
| --- | --- | --- |
| 08:00 | Active | Activate `lane_closure`. |
| 12:00 | Active | Refresh. |
| 17:00 | Removed | Remove active lane restriction. |

- **Activation rule:** Activate during the official lane-restriction window.
- **Refresh rule:** Refresh on each official active observation or schedule checkpoint.
- **Stale threshold:** 4 hours for unscheduled lane closures; 24 hours for scheduled work-zone lane restrictions.
- **Expiration threshold:** Official removal/end, or 12 hours without refresh for unscheduled restrictions.
- **Removal behavior:** Remove active restriction immediately at 17:00.
- **Reopen behavior:** Same record if same lane/work-zone identity reappears in the same operating window; otherwise new restriction.
- **Community interaction behavior:** Community reports can confirm impact severity but should not convert lane closure into road closure.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/confirmed = Moderate; stale = Low; removed/expired = None.

### Fixture G — Travel Advisory

| Event | Official state | Recommended Gridly state |
| --- | --- | --- |
| Appears | Active | Activate contextual advisory. |
| Updated | Updated | Refresh text/scope/time. |
| Removed | Removed | Remove active advisory. |

- **Activation rule:** Activate when an official advisory appears with roadway or area scope.
- **Refresh rule:** Update text, scope, and `lastOfficialSeenAt` when advisory changes.
- **Stale threshold:** 2-6 hours without refresh; shorter for weather-driven advisories.
- **Expiration threshold:** Official removal/end, or 12 hours without refresh for acute advisory.
- **Removal behavior:** Remove advisory from active awareness on source removal.
- **Reopen behavior:** Same advisory if same official id/scope returns within the same event window; otherwise new advisory.
- **Community interaction behavior:** Community reports can add local observations, but advisory remains context rather than closure proof.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/updated/confirmed = Moderate; stale = Low; removed/expired = None.

### Fixture H — Bridge Closure

| Event | Official state | Recommended Gridly state |
| --- | --- | --- |
| Long duration | Active | Activate `bridge_closure`. |
| Periodic updates | Updated | Keep active while official updates continue. |

- **Activation rule:** Activate on official bridge closure publication.
- **Refresh rule:** Periodic official updates maintain current status; bridge/structure id is the primary dedupe key.
- **Stale threshold:** 24-72 hours depending on expected update cadence and end date.
- **Expiration threshold:** Official reopen/end/removal; no automatic expiration while official long-duration closure remains refreshed.
- **Removal behavior:** Remove active awareness on official reopen/removal while retaining historical closure record.
- **Reopen behavior:** Same bridge closure if same bridge/source id returns after a short administrative gap; new closure if cause/project changes.
- **Community interaction behavior:** Community confirmations can strengthen confidence, but official bridge closure remains authoritative.
- **Trust label evolution:** `Official Source` → `Official Source + Community Active` → `Official Source + Community Confirmed` → `Stale Official Source`.
- **Future Travel Confidence consideration:** Active/updated/confirmed/reopened = Severe; stale = High; removed/expired = None.

## Activation Rules

1. Activate only from simulated official fixture records, never live calls.
2. Require a canonical type from the V326/V327 normalizer vocabulary.
3. Use source id when available; otherwise match by type, road/bridge identity, direction, geometry, jurisdiction, and timestamp proximity.
4. Preserve official and community evidence separately; derive any future awareness record only after lifecycle evaluation.

## Refresh Rules

- A repeated active official observation updates `lastOfficialSeenAt`.
- An official update with changed text, scope, severity, or schedule becomes `updated` rather than a duplicate.
- Community confirmation can improve confidence but should not reset official freshness unless future policy explicitly creates a separate community freshness clock.
- Detours inherit the parent closure/work-zone lifecycle and should not become routing instructions.

## Stale Rules

| Category | Recommended stale threshold |
| --- | --- |
| `road_closed` flood closure | 2-4 hours without refresh. |
| `flooded_roadway` | 1-2 hours without refresh. |
| `high_water` | 1-2 hours without refresh. |
| `travel_advisory` | 2-6 hours without refresh. |
| `construction` | 24-72 hours after missed expected refresh. |
| `crash` | 30 minutes without refresh. |
| `disabled_vehicle` | 15-30 minutes without refresh. |
| `lane_closure` | 4 hours unscheduled; 24 hours scheduled. |
| `detour` | Inherits parent; review if parent is stale. |
| `bridge_closure` | 24-72 hours after missed expected refresh. |
| `other_official` | Review-required; do not assign active impact beyond current fixture evidence. |

## Expiration Rules

| Category | Recommended expiration threshold |
| --- | --- |
| `road_closed` flood closure | Official removal/clear/reopen reconciliation, or 6 hours without refresh. |
| `flooded_roadway` | Official clear/removal, or 4 hours without refresh. |
| `high_water` | Official clear/removal, or 4 hours without refresh. |
| `travel_advisory` | Official removal/end, or 12 hours without refresh. |
| `construction` | Official end/removal; schedule review if 7 days past expected end without refresh. |
| `crash` | Official removal, or 90 minutes without refresh. |
| `disabled_vehicle` | Official removal, or 60 minutes without refresh. |
| `lane_closure` | Official removal/end, or 12 hours without refresh for unscheduled restrictions. |
| `detour` | Expires with parent closure/work zone/advisory. |
| `bridge_closure` | Official reopen/end/removal. |
| `other_official` | Expire conservatively unless taxonomy review assigns a class. |

## Reopen Rules

A removed official incident should be marked `reopened` rather than duplicated when all of the following are true:

1. The official source id matches, or a strong identity match exists by type, road/bridge, direction, geometry, and jurisdiction.
2. The recurrence occurs within the lifecycle-specific reopen window.
3. The new active record does not materially change cause, scope, or project phase.

Recommended reopen windows:

- Short Duration: 60-90 minutes.
- Medium Duration: Same operating window or same official id.
- Long Duration: Same project/structure id unless cause or phase changes.
- Event-Driven Duration: Same flood/high-water closure within 6 hours.

## Trust Evolution

Recommended trust transitions:

1. `Official Source` — official fixture is active and fresh.
2. `Official Source + Community Active` — nearby current community reports exist but are not yet enough for confirmation.
3. `Official Source + Community Confirmed` — community reports confirm the same condition with recent, matching evidence.
4. `Stale Official Source` — official record has missed its stale threshold; confidence should be reduced and reviewed.
5. `Expired Official Source` — official record exceeded expiration threshold without refresh.
6. `Removed Official Source` — official source removed or ended the incident.
7. `Reopened Official Source` — a removed record reappears within the reopen window and identity match rules.

Community evidence should never erase the official-source lifecycle state. It can add a second evidence lane that future awareness logic may present as community-only or community-confirmed.

## Travel Confidence Considerations

This milestone does not implement Travel Confidence. Recommended future impact only:

| Lifecycle state | Future impact guidance |
| --- | --- |
| Active | Use category default: Low for disabled vehicle, Moderate for crash/advisory/lane/construction/detour, High for flooded roadway/high water, Severe for road/bridge/flood closures. |
| Updated | Same as active unless update reduces scope. |
| Confirmed | Same or slightly strengthened narrative; do not exceed category maximum. |
| Stale | Reduce one level where possible; closures may remain High until resolved. |
| Expired | None. |
| Removed | None for active confidence; historical context only. |
| Reopened | Restore active category default and label as reopened. |

## Risks

- Live DriveTexas fields may have different identifiers, timestamps, or removal semantics than these fixtures assume.
- Missing official removals could cause stale closures to linger without strict expiration.
- Community evidence may appear to contradict official removal; future product policy must label that separately.
- Long-duration construction may become noisy if refresh cadence is not understood.
- Detour records could be misread as route guidance unless they remain parent-context only.

## Future Integration Notes

- Keep this fixture framework audit-only until sanctioned sample payloads or approved API access are available.
- Future integration should log lifecycle decisions before creating production awareness behavior.
- Store official evidence, community evidence, derived awareness state, and trust labels as separate concepts.
- Add source terms and update-cadence review before choosing final stale/expiration constants.
- `window.gridlyDriveTexasShadowNormalizerAudit?.()` now exposes fixture-only lifecycle simulation recommendations under `lifecycleSimulation`, `fixtureResults`, `staleRecommendations`, `expirationRecommendations`, `reopenRecommendations`, and `trustEvolutionRecommendations`.

## Recommended Next Milestone After V328

**V329 — DriveTexas Sanctioned Sample Payload Lifecycle Contract.** Use only approved, non-live sample payloads or exported fixtures to validate actual source identifiers, timestamps, removal semantics, and update cadence against the V328 lifecycle simulation rules before any shadow ingestion or production behavior is considered.
