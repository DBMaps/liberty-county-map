# LP205 — Statewide Source Health and Quiet-State Truthfulness Audit

> **Audit only.** This milestone changes no production copy, provider behavior, source activation, or crossing behavior. It diagnoses absence of evidence being presented as evidence of absence.

## 1. Executive Summary

- **“Community is quiet.” is ambiguous, not comprehensively proven.** It can be truthful when read strictly as a community-only statement after a successful, fresh, correctly scoped report read. The rendering decision receives a zero count, not proof of that lifecycle.
- **“Travel normally today.” is not currently truthful under known gaps.** It is **FALSE_UNDER_KNOWN_SOURCE_GAP** because DriveTexas and NWS alerts default inactive, current/forecast weather capabilities are missing, and report health is not an input.
- **Yes, source inactivity and failure can look quiet.** DriveTexas/NWS disabled, successful-zero, and failed states all expose empty record arrays to consumers. Report unavailability/failure can leave startup empty or retained/local collections without conveying health.
- **P0:** broad travel-normal, clear, no-official-advisory, and no-weather-impact statements can render without the upstream awareness needed to support them.

## 2. Source Health Matrix

| Source | Runtime | Observable health | Freshness | Zero semantics | Failure semantics | Visible to quiet decision |
|---|---|---|---|---|---|---|
| reports | STATEWIDE_CAPABLE_UNVERIFIED | HEALTHY, LOADING, FAILED, UNKNOWN, UNVERIFIED | no quiet-copy stale threshold | A rendered zero is not proof that Supabase was queried successfully | Failure can leave startup [] or retained/local data indistinguishable to quiet presentation | No: presentation receives arrays/counts, not report read health |
| crossings | GOVERNED_254_COUNTIES | HEALTHY, LOADING, FAILED, INTENTIONAL_ZERO | no age threshold | governed evidence of no crossings, never all-transportation quiet | does not collapse to crossing quiet | Partial: Community Pulse coverage guard consumes crossing availability only |
| drivetexas | INACTIVE_BY_DEFAULT | INACTIVE, NOT_CONFIGURED, HEALTHY, FAILED, UNKNOWN | no consumer stale threshold | inactive and healthy-zero both appear [] | failure becomes [] | No |
| nws_alerts | INACTIVE_BY_DEFAULT | INACTIVE, HEALTHY, FAILED, UNKNOWN | alert records carry times but quiet consumers receive no source-age gate | inactive and healthy-zero both appear [] | failure becomes [] | No |
| weather_products | NOT_IMPLEMENTED | MISSING_CAPABILITY | none | null/no impact is rendered as no travel-impacting weather | missing capability is hidden | No |
| road_geometry | 28_COUNTY_COHORT | HEALTHY, LOADING, FAILED, MISSING_CAPABILITY | package identity, not live-condition freshness | absence of geometry says nothing about road conditions | not incorporated into calm claim | No broad quiet gate |

There is **no shared source-health model**. Crossings provide the strongest provider-specific control; official providers expose runtime fields, reports keep a private network audit, and road loading has separate state. Quiet builders primarily receive arrays/counts/nulls.

## 3. Quiet Copy Matrix

| Statement/state | Owner | Actual evidence | Missing evidence | Classification |
|---|---|---|---|---|
| Community is quiet. | getGridlyHomeCommunityPulseCopy / top Awareness Card and Community Pulse | zero selected community count plus crossing coverage not failed | report query success/freshness; DriveTexas; NWS; weather products | **AMBIGUOUS** |
| Travel normally today. | getGridlyHomeCommunityPulseCopy / top Awareness Card | zero community activity and crossing coverage not failed | inactive DriveTexas/NWS, missing current weather/forecast, report health | **FALSE_UNDER_KNOWN_SOURCE_GAP** |
| No active community reports need attention. | gridlyStoryCommunityEvidence / Awareness Brief | community record array length zero | whether Supabase read succeeded and is fresh | **AMBIGUOUS** |
| No official roadway advisories nearby. | gridlyTravelBriefDriveTexasLines / Travel Brief | DriveTexas record array has no impactful records | provider enabled/connected/fetched successfully | **FALSE_UNDER_KNOWN_SOURCE_GAP** |
| No travel-impacting weather. | gridlyTravelBriefWeatherLines / Travel Brief | no meaningful impact in nullable weather model | inactive NWS alerts and all missing current/forecast products | **FALSE_UNDER_KNOWN_SOURCE_GAP** |
| Travel normally and stay aware. | Awareness Story, Community Pulse decision, Travel Brief | no active records/recognized official or weather impacts | health, success and freshness of those inputs | **OVERSTATED** |
| Your area is clear right now | Awareness Brief interaction fallback | fallback only when DOM text is unavailable | all source evidence | **FALSE_UNDER_KNOWN_SOURCE_GAP** |
| No active local issues reported | related local-awareness/microline semantics | available produced records | inactive/failed/missing producer status | **SUPPORTED_WITH_SCOPE** |
| zero alert cards | unified incident / alert rendering | no eligible incidents produced | provider health and missing capabilities | **AMBIGUOUS** |

## 4. Community Reports

The initial active report arrays are empty. The asynchronous loader can prove a successful query internally through diagnostics and last-success time, then normalizes and county-filters rows. If Supabase is unavailable it returns without changing those collections. A query exception is caught, updates only sync/diagnostic presentation, and retains the prior collections. Local accepted reports may be merged after a successful read. Thus zero visible reports can mean successful fresh zero, not-yet-loaded startup, unavailable client, failed read with an empty prior collection, or a locally retained view. Quiet presentation cannot distinguish them. Root cause: **REPORT_FAILURE_COLLAPSES_TO_ZERO** / **STARTUP_UNKNOWN_PRESENTED_AS_QUIET**.

## 5. Crossings

Crossings are the positive control: all 254 counties have governed state; 202 are ACTIVE_POSITIVE and 52 ACTIVE_EMPTY. Runtime coverage distinguishes LOADING, TEMPORARILY_UNAVAILABLE, hydrated ACTIVE_EMPTY, ACTIVE_POSITIVE with no local crossings, and ACTIVE_POSITIVE with local crossings. The home Community Pulse uses unavailable crossing coverage to suppress its zero-evidence quiet branch. This protection is only crossing-specific: an ACTIVE_EMPTY county proves no governed crossings, not quiet roads/weather, and other aggregate builders do not consume a complete health model.

## 6. DriveTexas

The provider requires explicit enablement plus an API key and makes no request while disabled. Disabled refresh reports connected=false but healthy=true and returns the same empty normalized array consumed by stories and Travel Brief. On fetch failure it clears the store/count, records lastError, but also leaves runtimeHealthy=true. The Travel Brief converts that array to “No official roadway advisories nearby.” Neither it nor Awareness/Community Pulse/Alerts receives inactive or failed status. Therefore DriveTexas can have never run and still contribute apparent quiet.

## 7. Weather

NWS alert ingestion similarly defaults disabled and provides [] while inactive; a failure clears records and is not visible to quiet surfaces. Alerts have event timestamps, but no common last-success/stale gate protects quiet copy. Separately, current conditions, observations, point/grid forecasts, temperature, precipitation, wind, and visibility are missing capabilities. A null weather model nevertheless becomes “No travel-impacting weather.” This is absence of capability, not observed normal weather.

## 8. Awareness Brief / Community Pulse / Travel Brief / Alerts

- **Awareness Story/Brief:** combines community records, empty DriveTexas records and nullable weather; its default is “Community is quiet,” and broad recommendation/confidence copy is produced without source health.
- **Community Pulse / top/mobile Awareness Card:** crossing failure/loading has a partial coverage guard, but report/official/weather health does not. Its quiet pair directly joins community language to “Travel normally today.”
- **Travel Brief:** always creates Community, Official Roadways and Weather sections. Empty/null dependencies become affirmative no-advisory/no-impact copy. This is the clearest false-under-known-gap path.
- **Alerts:** zero cards means no eligible records produced by active inputs, not all alert sources healthy with zero events. Unavailable providers are invisible.

## 9. Startup / Switching / Freshness

The HTML shell and Community Pulse first paint use loading placeholders, which is good. Crossing hydration is blocking before the first composed desktop render; report hydration is explicitly non-blocking and is not awaited. Other builders have empty-array/default fallbacks, so startup unknown can become calm outside the guarded placeholder path. On Liberty → Sherman → Dallas → Andrews → Tyler, crossing generation/owner guards reject stale commits and reports refilter on county changes. Official provider lifecycle remains global and hidden, so no county switch creates proof of health. No shared stale threshold or last-success age is used by quiet decisions; retained/local/connector data can appear current.

## 10. Statewide Impact

The generated matrix evaluates **254 counties**. Cohorts: **28** with roadway packages / **226** without; **202** ACTIVE_POSITIVE / **52** ACTIVE_EMPTY crossing counties; **3** legacy seeded metadata counties / **251** without. The PLACE projection includes 1859 unique places and 2058 county memberships; multi-county and ordinary contexts share the same missing official-source-health problem. Every county has DriveTexas INACTIVE, NWS INACTIVE, reports UNVERIFIED, and current/forecast weather MISSING_CAPABILITY in this repository audit. Road and crossing cohorts change local detail, not the truthfulness of broad calm copy.

## 11. Root Causes

- **INACTIVE_SOURCE_COLLAPSES_TO_EMPTY**
- **MISSING_CAPABILITY_NOT_VISIBLE**
- **TRAVEL_COPY_SCOPE_OVERSTATEMENT**
- **NO_SHARED_SOURCE_HEALTH_MODEL**
- **REPORT_FAILURE_COLLAPSES_TO_ZERO**
- **STARTUP_UNKNOWN_PRESENTED_AS_QUIET**
- **SOURCE_FAILURE_COLLAPSES_TO_EMPTY**
- **STALE_DATA_NOT_DISTINGUISHED**
- **QUIET_COPY_SCOPE_OVERSTATEMENT**

## 12. Priority Findings

- **P0:** Travel-normal, no-official-advisory, and no-weather-impact copy can render while DriveTexas/NWS are inactive and live weather products do not exist. (INACTIVE_SOURCE_COLLAPSES_TO_EMPTY, MISSING_CAPABILITY_NOT_VISIBLE, TRAVEL_COPY_SCOPE_OVERSTATEMENT)
- **P1:** Presentation cannot prove a successful fresh report read and cannot combine source lifecycle truth across all 254 counties. (NO_SHARED_SOURCE_HEALTH_MODEL, REPORT_FAILURE_COLLAPSES_TO_ZERO, STARTUP_UNKNOWN_PRESENTED_AS_QUIET)
- **P2:** Official provider failures clear arrays; provider/connector cache freshness is not a quiet-state input. (SOURCE_FAILURE_COLLAPSES_TO_EMPTY, STALE_DATA_NOT_DISTINGUISHED)
- **P3:** Community-scoped wording is semantically narrower, but data availability is not stated and adjacent copy expands its meaning. (QUIET_COPY_SCOPE_OVERSTATEMENT)
- **P4:** Current conditions and forecast products remain intentionally unimplemented for this audit and must not be inferred quiet. (MISSING_CAPABILITY_NOT_VISIBLE)

## 13. Recommended LP205.1 Repair Boundary

LP205.1 should make the smallest safety repair first: gate broad travel/all-clear/no-official/no-weather conclusions on an explicit presentation-facing completeness result, while preserving narrowly scoped community zero copy only after report-read state is known. Reuse crossing coverage and provider runtime facts behind that boundary; centralize the durable shared health model immediately afterward. Do not activate providers as part of the copy-scope repair. This audit does **not** implement that repair.

## 14. Files Changed

Only the LP205 audit builder, generated LP205 report/matrix, and LP205 test are changed. Production application/provider files are fingerprinted inputs and remain untouched.

## 15. Tests

Run the LP205 builder in verify mode, its Node test, and LP204 verification as regression. Exact results belong in the change/PR execution record rather than this deterministic generated artifact.

## 16. Merge Recommendation

**Safe to merge as audit evidence.** It is deterministic, audit-only, and does not authorize activation or claim quiet-state truthfulness is fixed. Production release remains blocked on the P0 repair.
