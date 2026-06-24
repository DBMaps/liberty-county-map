# GRIDLY V731 — Liberty Mobile Certification Blocker Audit

## Final determination

**LIBERTY MOBILE CERTIFICATION BLOCKER AUDIT — BLOCKED**

Liberty mobile certification is currently blocked. The audit found two independent launch blockers:

1. **Road attribution is not trustworthy today.** A Tap Map submission can preserve the user's raw TX 146 coordinate for payload/marker placement while simultaneously carrying a resolver-derived `selectedRoadName`/`primaryRoad` from a different nearby or cached road into display metadata. Awareness, Alerts, Popups, and route-related surfaces do not all use one canonical display-location owner.
2. **Mobile interaction latency is most likely caused by synchronous post-submit render/refresh work running inside the click-to-submit path, compounded by immediate marker rendering plus scheduled re-renders and full refresh chains.** The code has background refresh protections, but the local-immediate path still runs expensive UI refreshes before the handler returns.

## Scope and constraints

Audit only. No runtime behavior, UI behavior, county status, directional systems, Dispatch Board, or county onboarding changes were made.

## Protected systems confirmation

| Protected system | Required state | Audit result |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Confirmed unchanged by this audit. |
| `historyUiEnabled` | `false` | Confirmed unchanged by this audit. |
| `DriveTexasPaused` | `true` | Confirmed unchanged by this audit. |
| `TransportationIntelligenceEnabled` | `false` | Confirmed unchanged by this audit. |
| `TransportationIntelligenceDisplay` | `false` | Confirmed unchanged by this audit. |
| `TransportationIntelligenceActivation` | `false` | Confirmed unchanged by this audit. |

## County boundaries confirmation

| County | Required operating posture | Audit result |
| --- | --- | --- |
| Liberty | Launch Focus | Unchanged. |
| Montgomery | Maintenance Mode | Unchanged. |
| San Jacinto | Maintenance Mode | Unchanged. |
| Jefferson | Deferred | Unchanged. |

## Required Audit Area #1 — Road Attribution / Location Resolution

### Submission path observed

`handleHazardPlacementMapClick()` captures the raw tap coordinate, calls `snapHazardToRoad()`, then intentionally submits the raw tap coordinate as `finalPlacement` while passing resolver outputs as diagnostic/display options including `selectedRoadName`, `primaryRoad`, and `roadName`.

`createSharedHazardReport()` then locks `lat`/`lng` to `tapMapUserSelectedCoordinate`, but builds location metadata using `gridlyBuildRoadHazardSubmissionLocationPayload()` from option road names and cached resolver state. The inserted row and local preview row are therefore capable of combining one coordinate owner with a different road-name owner.

### Root cause: why TX 146 became US 90 / Waco Street

The highest-confidence explanation is **split ownership between coordinate placement and display road-name attribution**:

- Tap Map placement preserves the raw user tap coordinate for the submitted row and rendered marker.
- The same flow also passes `snapped.selectedRoadName` as `selectedRoadName`, `primaryRoad`, and `roadName` into report creation.
- `gridlyBuildRoadHazardSubmissionLocationPayload()` is allowed to consider `options.roadName`, `options.primaryRoad`, `options.selectedRoadName`, `lastRoadSnapDebug.selectedRoadName`, cached primary road, cached coordinate, and a resolved road name. That means a nearby/cached resolver road can become the display metadata even when the submitted coordinate remains the raw tap coordinate.
- `resolveNearestRoadName()` can fall back from roadway segments to the nearest crossing within 0.8 miles and can pair the selected road with another nearby road through `resolveNearbyRoadPair()`. A TX 146-area tap near a crossing/candidate associated with US 90/Waco Street can therefore acquire a US 90/Waco display phrase if the resolver or fallback data chooses that candidate.
- Awareness appears to have selected the road-display builder output (`Flooding on/near US 90 at Waco Street` style wording), while the Alert surface preserved or exposed a TX 146 phrase plus a separate `Reported on US 90 at Waco Street` metadata line. That is a symptom of multiple display builders reading different fields from the same incident object.

### Road candidate ranking and fallback paths

`collectNearbyRoadCandidates()` scans every loaded roadway segment, keeps the closest candidate per normalized road key, sorts by distance, and returns the nearest candidates. `resolveNearbyRoadPair()` then uses those candidates to form a primary/secondary pair if a distinct secondary road exists within 0.35 miles.

`resolveNearestRoadName()` first scans roadway geometry within 1.2 miles. If it finds a valid segment, it may return either the selected segment road or a paired road phrase. If no valid roadway candidate is found, it scans crossings within 0.8 miles and can return a crossing-linked road label or a paired crossing/road phrase. This fallback is platform-wide because the resolver is shared, but the observed US 90/Waco symptom is Liberty-specific in data and launch impact because Liberty has the active launch roadway/crossing corpus.

### Surface comparison

| Surface | Observed owner/path | Attribution risk |
| --- | --- | --- |
| Awareness | `refreshPortraitV2LocalizedIntelligence()` reuses a shared active-awareness model, which can call localized label/road display builders through shared snapshot state. | High: can promote road-display wording built from resolver metadata rather than raw tap intent. |
| Alerts | `renderAlerts()` groups corridor intelligence and uses localized summaries; recently cleared rows call `buildLocalizedIncidentLabel()`. | High: can show both selected corridor wording and a separate reported-on phrase when fields disagree. |
| Road hazards list | `renderRoadHazards()` directly calls `buildRoadHazardDisplay()`. | High: reads `getSharedResolvedRoadLookup()` and location context. |
| Popups / markers | `renderUnifiedIncidents()` renders from unified incidents and popup-generation paths. | Medium/high: marker coordinate can be correct while popup text uses resolver-derived road names. |
| Route surfaces | `renderAlerts()`, route relevance checks, and `gridlyRouteIntelligenceDebug()` consume unified incidents/route hazard assessments. | Medium: route relevance may be correct spatially, while wording can inherit display resolver disagreement. |

### Multiple location builders competing

Yes. The audit identified several competing location owners:

- Raw tap coordinate owner in `handleHazardPlacementMapClick()` and `createSharedHazardReport()`.
- Submission metadata owner in `gridlyBuildRoadHazardSubmissionLocationPayload()`.
- Shared resolver/cache owner in `getSharedResolvedRoadLookup()` and `resolveNearestRoadName()`.
- Road display owner in `buildRoadHazardDisplay()`.
- Localized label owner in `buildLocalizedIncidentLabel()`.
- Corridor/directional owner in `resolveGridlyAuthoritativeIncidentDisplayLocation()` and `applyGridlyDirectionalIncidentContextToRoadHazardTitle()`.
- Awareness and alert model owners that consume shared active awareness/corridor models.

### Stale resolver data risk

Stale resolver reuse is plausible. `createSharedHazardReport()` reads from `lastRoadSnapDebug` and `lastMobileReportSubmitDebug` while also accepting options. The shared road lookup layer uses coordinate/index caches keyed to rounded coordinates or incident identity. Those are useful for performance, but they increase risk when the selected coordinate, diagnostic coordinate, and display metadata are not treated as one atomic location contract.

### V727 directional contribution

V727 is not the primary cause. `resolveGridlyAuthoritativeIncidentDisplayLocation()` can append direction only when an authorized corridor, safe consumer state, confidence threshold, and candidate direction are all present. It does not select the underlying road candidate by itself. However, V727 increased the number of display layers participating in road/corridor text, so it can make an existing attribution mismatch more visible across surfaces.

### Liberty-only or platform-wide?

The bug class is platform-wide because the resolver, fallback, cache, and display builders are shared. The observed failure is Liberty launch-critical because Liberty is the primary launch county and its road/crossing data made the TX 146 vs US 90/Waco conflict visible during Denise mobile certification.

## Required Audit Area #2 — Mobile Performance

### Submission-to-render chain observed

The critical chain is:

1. `handleHazardPlacementMapClick()` performs pointer/tap capture.
2. It awaits `snapHazardToRoad()` before submission.
3. It awaits `createSharedHazardReport()`.
4. `createSharedHazardReport()` awaits Supabase insert / fallback insert.
5. After insert, it normalizes a local preview row, registers it, mutates `activeHazards`, forces visibility changes, then synchronously calls `refreshReportHazardViews()`, `renderUnifiedIncidents()`, and `scheduleHazardMarkerAutoRender()`.
6. The deferred UI-reset branch starts `runPostSubmitRefreshInBackground()`, but only after the local-immediate synchronous refresh/render sequence has already run.
7. `handleHazardPlacementMapClick()` then performs additional marker/UI cleanup work and returns.

### Why click handlers exceeded 16–23 seconds

The highest-confidence cause is that expensive work remains on the synchronous click handler critical path after Supabase insert succeeds. In particular:

- `refreshReportHazardViews()` runs a large refresh chain: community pulse shared model, portrait localized intelligence, unified incident rendering, crossing scheduling, daily habit status, mobile alerts mirror, smart alerts banner, movement intelligence, corridor summary cards, and more.
- `renderUnifiedIncidents()` clears and rebuilds incident layers, rebuilds/filter/sorts incident lists, creates markers, generates popups, synchronizes alert/awareness state, and records render audits.
- `scheduleHazardMarkerAutoRender()` calls the marker renderer immediately, then schedules two more renders at 500ms and 1500ms.
- `createSharedHazardReport()` already called `refreshReportHazardViews()` and `renderUnifiedIncidents()` before the Tap Map handler adds its extra visual tap marker and performs sheet/map cleanup.

The code has instrumentation for refresh breakdown and post-submit background refresh, but the user-observed browser warning reports the total event handler duration; any awaited network insert plus synchronous refresh/render work before the handler returns can accumulate into a 16–23 second click handler.

### Runtime consumption hypothesis by stage

| Stage | Likely runtime contribution | Confidence |
| --- | --- | --- |
| Before submit / tap capture | Low, except `snapHazardToRoad()` if roadway geometry scan is cold or large. | Medium |
| During submit | Variable; Supabase insert/fallback retry can add network time. | Medium |
| Local post-insert refresh | High; `refreshReportHazardViews()` invokes many child render/update functions synchronously. | High |
| Marker render | High; `renderUnifiedIncidents()` clears/rebuilds layers and popup content. | High |
| Alert render/open | Medium/high; Alert surfaces can trigger corridor grouping and localized summary builders. | Medium |
| Background refresh | Not supposed to block UI after started, but can compete for main-thread/render work when results return. | Medium |

### Liberty-specific, mobile-specific, browser-specific, or platform-wide?

- **Platform-wide bug class:** shared refresh/render functions are global.
- **Mobile-amplified:** mobile certification uses Tap Map, portrait Awareness, and sheet/dock transitions; mobile hardware/browser main-thread budgets make synchronous refresh chains more noticeable.
- **Liberty launch-critical:** Liberty is the current launch focus and uses the active county data path.
- **Not proven browser-specific:** no code evidence ties the delay to one browser engine; the click-handler warnings are browser diagnostics for long main-thread tasks.

### Smallest likely V732 fix path

Audit-only recommendation for V732:

1. Establish a single post-submit display-location contract: raw user-selected coordinate owns marker placement; display road name must come from the accepted road candidate only if it passes a tight distance/identity confidence gate against the raw tap coordinate. Otherwise display should fall back to coordinate/area pending rather than a different road.
2. Invalidate or isolate `lastRoadSnapDebug`/shared lookup cache per tap submission and pass a single immutable location object through Awareness, Alerts, Popups, and Route wording builders.
3. Move local post-submit UI refresh/render work off the click handler path: acknowledge/close sheet first, render only the new marker or schedule one coalesced render in `requestAnimationFrame`/idle task, and run full `refreshReportHazardViews()` after the handler returns.
4. Coalesce `renderUnifiedIncidents()` calls by removing the immediate duplicate `renderUnifiedIncidents()` + immediate `scheduleHazardMarkerAutoRender()` render pairing in the post-submit path.
5. Use existing diagnostics (`gridlyRefreshBreakdownAudit`, `gridlyPostSubmitRefreshAudit`, `gridlyAuditPerformanceReview`, render audit state) to confirm the slowest child functions before broad refactors.

## Runtime helper inventory

| Helper | Status | Use for V731/V732 |
| --- | --- | --- |
| `gridlyUiSmokeTest` | Present. | Confirm dock/sheet/action binding and visible alert surface state after mobile report. |
| `gridlyActiveHazardCountReconciliationAudit` | Present. | Confirm active hazard count and cleared suppression are not causing missing/new marker confusion. |
| `gridlyReportVisibilityPipelineAudit` | Present. | Trace report visibility from submitted row to hazard/alert/marker surfaces. |
| `gridlyRefreshBreakdownAudit` | Present. | Identify slowest child in `refreshReportHazardViews()`. |
| `gridlyPostSubmitRefreshAudit` | Present. | Confirm post-submit refresh calls, duplicate risks, lifecycle guard state, and call sources. |
| `gridlyRoadNameResolverDebug` | Present. | Inspect last road resolver source, fallback reason, candidate source, paired roads, and samples. |
| `gridlyReferenceRoadResolverAudit` | Present. | Validate expected reference-road resolver behavior. |
| `gridlyBackgroundLoopAudit` | Present. | Detect background intervals/timeouts/animation frames and repeated top-panel writes. |
| `gridlyAuditPerformanceReview` | Present. | Inventory audit helper runtime cost and helpers called during report submit/render loops. |
| `gridlyRouteIntelligenceDebug` | Present. | Inspect route-relevant hazard counts and route-pressure state. |
| Additional relevant diagnostics | Present. | `gridlyPlacementPipelineTraceAudit`, `gridlyGeometryAwarePlacementAudit`, `gridlySnapRejectionDecisionAudit`, `gridlyPortraitIntelligenceBreakdownAudit`, `gridlyReflowAudit`, marker/popup visual audits, and network audit state are already available. |

## Required final answers

1. **Why TX146 became US90/Waco Street:** Because Tap Map coordinate ownership and display road-name ownership are split. The row/marker can preserve the raw TX 146 tap coordinate while submission/display metadata can use resolver/cached/fallback road candidates, including crossing fallback and nearby-road pairing that can produce US 90/Waco wording.
2. **Whether location attribution is trustworthy today:** No. It is not launch-trustworthy until one canonical post-submit location contract owns all user-facing surfaces.
3. **Why mobile click handlers exceeded 16–23 seconds:** The submit click path awaits network insertion and then runs local-immediate refresh/render work synchronously, including full hazard/report refresh, unified incident rendering, marker generation, awareness/alert synchronization, and immediate plus scheduled marker re-renders.
4. **Highest-confidence root cause:** Split location ownership for blocker #1; synchronous post-submit refresh/render chain on the click handler path for blocker #2.
5. **Smallest recommended V732 fix scope:** Canonicalize post-submit display location and confidence-gate road names; isolate per-tap resolver state; defer/coalesce full refresh/render work after immediate UI acknowledgment; instrument with existing helper audits rather than adding large helper systems.
6. **Whether Liberty launch readiness is currently blocked:** Yes. Liberty launch readiness is blocked pending V732 remediation and Denise re-validation.

## Denise validation steps for V732

1. Start from a clean app session on mobile/portrait with Liberty active.
2. Run `gridlyRoadNameResolverDebug()` and save the baseline output.
3. Tap-report flooding on TX 146 2 miles south of Dayton.
4. Confirm the sheet acknowledges immediately and the marker appears without a long frozen interval.
5. Run `gridlyPostSubmitRefreshAudit()` and `gridlyRefreshBreakdownAudit()` immediately after submission.
6. Open Awareness, Alerts, marker popup, and route/alert surfaces.
7. Confirm every surface uses one consistent location description for the same incident.
8. Confirm no surface says US 90/Waco Street for the TX 146 report unless the report was actually placed at that location.
9. Run `gridlyReportVisibilityPipelineAudit()` and `gridlyActiveHazardCountReconciliationAudit()` to verify the report is visible exactly once in expected active surfaces.
10. Repeat once after app reload to confirm persisted data does not reintroduce stale resolver wording.

## Merge recommendation

Merge the V731 audit artifacts as a blocker audit only. Do not treat this as launch approval. Use the findings to scope V732 remediation and Denise mobile re-certification.

## Testing performed

- `git diff --check`
- `node -c js/app.js`
- Static review of `buildLocalizedIncidentLabel`, `buildRoadHazardDisplay`, `resolveGridlyAuthoritativeIncidentDisplayLocation`, `collectNearbyRoadCandidates`, `handleHazardPlacementMapClick`, `createSharedHazardReport`, and `refreshPortraitV2LocalizedIntelligence`.
- Existing lifecycle/count tests: `node scripts/v729-liberty-cleared-incident-count-reconciliation-validation.mjs`
