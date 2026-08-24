# LP226 — Alerts Idle Snapshot Reconciliation

## Finding and ownership repair

LP224's bounded baseline (7 snapshot builds/42 downstream stages in 35.9 seconds; a later LP225 trace observed 21 builds but only 3 renders/writes) established repeated snapshot preparation, not a Long Task owner. The production call audit found no single idle timer owned the work. Instead, independently refreshed consumers and diagnostic/count/location audits use `getAlertsSurfaceSnapshot()` as a fallback source. Several fallback expressions call it twice (eligibility check and value read). Because the function previously had no validity generation, every request rebuilt community collection, provider promotion, area filtering, merge, and sorting even when the underlying state was identical.

The narrow repair is a generation guard at the shared snapshot owner. A cheap FNV-1a signature projects only fields already relevant to Alerts and reuses the same snapshot object while that signature is unchanged. It has no clock, timer, delay, polling, debounce, throttle, hidden-tab behavior, consumer identity, or town exception. On a changed signature it rebuilds immediately through the existing path. The LP223 authoritative portrait writer remains the only authoritative writer.

## Production caller inventory

| Caller family (actual functions) | Trigger / open requirement | Why it reads Alerts; downstream presentation |
|---|---|---|
| `gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync`, `buildAlertsSurfaceHtml`, `renderAlerts` synchronization | Alerts open or already-open refresh; open required only for authoritative apply | Authoritative card input; render and authoritative write follow only on the established open chain. |
| `normalizeGridlyMobileAwarenessPanelSummary`, `refreshGridlyPortraitLocationAwarenessPanel`, `getGridlyAwarenessBriefActiveState`, `getGridlyVisibleAlertIncidentCount` | mobile/location/awareness refresh; Alerts may be closed | Counts and awareness state; no Alerts writer follows. |
| `getGridlyDestinationRouteAlertSource` | route/destination refresh; Alerts may be closed | Route-relevant alert source; no Alerts writer follows. |
| `getGridlyTopAwarenessRoadHazardAuthoritativeRecord`, `buildGridlyV322TopAwarenessAuthoritativeRoadHazardHeadline`, `getGridlyAlertsSurfaceActiveCommunityReportRows` | awareness/headline/community-row refresh; Alerts may be closed | Fallback when no supplied snapshot/model exists; no Alerts writer follows. |
| `gridlyRenderHazardMarkersDebug`, `getGridlyAlertsPanelAuditSnapshot`, `gridlyGetVisibleDevCleanupCounts`, `gridlyBuildIncidentSourceTrace`, `gridlyTxDotSourceAudit` | explicit debug/audit or periodic diagnostic convergence; Alerts may be closed | Inspection only; no render/write follows. |
| `gridlyAlertLocationSpecificityAudit`, `gridlyReferenceRoadResolverAudit`, `gridlyLp023ConsumerLocationAdapterAudit`, `gridlyRoadHazardLocationConsistencyAudit`, `gridlyTopAwarenessLocationConsistencyAudit`, `gridlyLocationTruthAudit` | location audit/convergence; Alerts may be closed | Location correctness inspection; no render/write follows. |
| `gridlyActiveHazardCountReconciliationAudit`, `gridlyAwarenessAlertsCountSyncAudit`, `gridlyGovernedAwarenessAudit` | count/governance reconciliation; Alerts may be closed | Eligibility/count comparison; no render/write follows. |
| `gridlyEditorialRenderingRuntimeAudit`, `gridlyCanonicalEventPresentationCertificationAudit`, `gridlyPrimaryCorridorSelectionAudit`, `gridlyAlertMarkerIntegrityAudit`, `gridlyDirectionConfidenceAudit` | explicit certification/integrity audit; Alerts may be closed | Presentation/identity/direction inspection; no production writer follows. |

All direct production references were classified above. Legitimate changed-state and initial-open reads rebuild. Closed-surface audits, count consumers, and duplicate fallback reads were demonstrably capable of requesting an identical logical generation and are now reuses.

## Invalidation dependency contract

The signature includes canonical active community records; active report/hazard identity and lifecycle; UUID/crossing/provider identity; status, clear/expiry, confirmation/support/count; relevant content, severity, location and update revisions; DriveTexas and weather normalized records plus provider revisions; selected awareness-area mode/key; community and county; active county; Smart Alerts preferences; and route state. Thus submit, sync, confirmation, clear, blocked-crossing lifecycle, provider completion/change, weather change, community/county/area change, preferences, and route change invalidate synchronously on the next legitimate request. An Alerts open after a change and an already-open refresh both use the unchanged LP223 writer chain.

## Acceptance

Baseline authority: 7 builds and 7 invocations of each downstream stage (42 total) in LP224.3; later LP225 evidence recorded 21 builds and 21 invocations of each measured downstream stage, with 3 renders and 3 authoritative writes. After LP226, for one unchanged generation, the first request builds once and every remaining request reuses: 7 requests become 1 build/6 reuses (6 suppressed), and 21 requests become 1 build/20 reuses (20 suppressed). These are deterministic same-input projections of the supplied baselines; owner browser acceptance supplies live after counts.

Owner console block after Ctrl+F5, selecting Sulphur Springs, convergence, and roughly 30 seconds untouched:

```js
const id = gridlyRuntimePerformanceAudit("BEGIN", "IDLE", "LP226 owner idle acceptance");
// Leave Gridly untouched for about 30 seconds, then run the single line below.
gridlyLP226AlertsIdleAcceptance(id);
```

For real invalidation acceptance, use the existing owner-created test-report flow, keep Alerts open, and compare the returned `alertsSnapshotReconciliation.events`: the change must add a `build` with a new signature/generation, update the concise card through the authoritative writer, preserve location and IDs, and leave no duplicate/stale card.

**NO UNRELATED PERFORMANCE OPTIMIZATION WAS APPLIED.**
