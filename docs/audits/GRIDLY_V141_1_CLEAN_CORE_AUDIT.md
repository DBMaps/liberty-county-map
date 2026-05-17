# Gridly V141.1 Clean Core Audit

## Executive Summary

This is an audit-only review of V140 stabilization diagnostics and temporary helpers in `js/app.js`.

Current status:
- The requested global helpers are present and operational for field triage.
- Most helpers are passive (on-demand `window.*` functions) and low-risk to leave temporarily.
- There are still active debug systems that run continuously (notably click diagnostics and recurring refresh polling).
- Forced reflow risk is credible due to broad use of layout measurement APIs (`getBoundingClientRect`, `scrollHeight`, etc.), especially in diagnostics and UI state audits.
- No code changes were made to application logic; only this markdown audit file was added.

## Helpers Found

| Helper/Diagnostic | Purpose | Passive or Active | Keep Temporarily? | Remove Later? | Risk Notes |
|---|---|---|---|---|---|
| `window.gridlyRefreshAudit()` | Returns refresh counts/source attribution/render call counters. | Passive (invoked manually) | Yes | Yes | Useful to verify refresh ownership chain; low runtime risk by itself. Backing counters increment on each refresh path. |
| `window.gridlyGeoAudit()` | Returns geolocation request source accounting and startup-block detection status. | Passive (invoked manually) | Yes | Yes | Critical for confirming startup geolocation protection remains intact; low runtime overhead. |
| `window.gridlyActiveIncidentAudit()` | Produces generated road incident snapshot and aggregation consistency summary. | Passive (invoked manually) | Yes | Yes | Valuable until incident source cleanup is fully validated; potentially heavy when invoked but not persistent. |
| `window.gridlyDevPurgeRecentRoadHazards()` | Dev-only Supabase road-hazard source-row purge helper with dry-run and host guardrails. | Passive (invoked manually) | Yes (strictly dev/triage) | Yes | High blast-radius if misused; has dev-host and `confirm` safeguards, but should be retired once cleanup playbooks are complete. |
| `window.gridlyUnifiedHazardSourceAudit()` | Verifies source rows vs generated incident counts and source breakdown. | Passive (invoked manually) | Yes | Yes | Relevant to V140 “unified incident source audit”; low steady-state cost. |
| `window.gridlyNetworkAudit()` | Reports dedupe/in-flight stats for shared report loads and OSRM nearest calls. | Passive (invoked manually) | Yes | Yes | Helpful for refresh ownership and duplicate-load validation; depends on persistent audit state. |
| `window.gridlyCrossingRenderAudit()` | Exposes crossing render/filter call count history and latest render context. | Passive (invoked manually) | Yes | Yes | Useful for render fanout diagnosis; minor memory churn bounded by audit log limit. |
| `window.gridlyRouteWatchDebug()` | Large diagnostic dump for Route Watch state, route relevance, confidence metrics. | Passive (invoked manually) | Yes | Yes | Heavy object assembly when called; keep through Portrait V2 lifecycle validation then trim. |

## Console Logs / Warnings Found

Observed categories added/retained in V140-era diagnostic surface:
- Audit helper info/warn/error output for unified hazard audit, active incident audit, and purge helper lifecycle.
- Post-submit refresh debug logs (`started`, `complete`, `failed`).
- Map/style drift warning and non-array sync payload warning.
- Search and selection guard warnings (deduped via `debugWarningsSeen` set).
- Layer/health/layout/local-edit guard warnings.

Notes:
- Several logs are intentionally deduped or gated by host/debug mode patterns.
- Diagnostic noise still exists in some flows (click diagnostics, crossing report interactions, layout helpers), though much of it is contextual rather than unconditional spam.

## Persistent Debug Systems Found

### Polling
- `setInterval(() => loadSharedReports("interval_live_refresh"), LIVE_REFRESH_MS)` is active continuously after bootstrap.
- This is production-refresh behavior, but it is also a persistent diagnostic signal source due to audit counters and skip accounting.

### Mutation Observers
- No long-running `MutationObserver`-based debug observer was identified in this audit pass.

### Event tracing
- `traceMobileModeMutation()` is currently a no-op return, so mutation trace hooks are effectively disabled though callsites remain.

### Click tracing
- `installMapClickDiagnostics()` attaches a document-level click listener and performs per-click frame/bounds/target diagnostics.
- This is persistent and can contribute overhead in active sessions.

### Render tracing
- Crossing/render/network audit states continuously accumulate bounded call metadata (`lastCalls`) and counters.
- Render audit and refresh audit counters are always updated along refresh/render paths.

### Network tracing
- `gridlyNetworkAuditState` tracks load reasons, success timestamps, in-flight state, dedupe skips, and OSRM call metadata.

### Long-running debug listeners
- Window/visualViewport resize/scroll listeners exist for viewport var updates (functional, not strictly debug) and remain continuously active.

## Forced Reflow Candidate Areas

Audit-only likely contributors to `[Violation] Forced reflow ...`:

1. **Frequent geometry reads in interaction paths**
   - Extensive `getBoundingClientRect()` usage across map/report/route/layout diagnostics and UI guards.
   - Some calls happen in click handlers and responsive-mode transitions, where style/class updates may already have occurred.

2. **Read-after-write risk pattern**
   - Multiple flows adjust classes/styles/UI mode and then compute bounds/visibility/scroll metrics in nearby execution paths.
   - Candidate metrics: `scrollHeight`, `clientHeight`, overflow checks, and repeated parent/child rect comparisons.

3. **Map resize / invalidate timing**
   - Several `map.invalidateSize()` invocations (immediate and delayed) exist across tactical sync, section switches, and report flows.
   - These can trigger layout recalculation bursts depending on concurrent DOM updates.

4. **Diagnostic helper geometry snapshots**
   - Debug helpers that capture many element rects in one call can be expensive if invoked during busy rendering.

5. **Fanout refresh path**
   - `refreshReportHazardViews()` triggers a broad UI update chain (alerts, hazards, incidents, crossings scheduling, route intelligence, widgets, mirrors), increasing chance of layout pressure when coupled with geometry reads.

No fixes were applied per instruction.

## Safe Removal Candidates

Candidates that appear safe for V141.2 removal (post-validation), prioritized:

1. `installMapClickDiagnostics()` global click diagnostic listener (or gate behind explicit debug flag).
2. Remaining verbose console debug logs for routine interaction telemetry (non-error, non-warning triage logs).
3. Optional helper globals that are pure diagnostics and not used by runtime behavior:
   - `window.gridlyCrossingRenderAudit`
   - `window.gridlyNetworkAudit`
   - `window.gridlyRefreshAudit`
   - `window.gridlyGeoAudit`
   - `window.gridlyActiveIncidentAudit`
4. Transient audit state buckets that only support removed globals/logging.

## Do Not Remove Yet

Retain until after source cleanup and Portrait V2 lifecycle cleanup are fully validated:

1. `window.gridlyUnifiedHazardSourceAudit()` (source-of-truth verification).
2. `window.gridlyActiveIncidentAudit()` (generated incident consistency checks).
3. `window.gridlyRefreshAudit()` + refresh source counters (refresh ownership confirmation).
4. `window.gridlyGeoAudit()` (startup geolocation guard validation).
5. `window.gridlyDevPurgeRecentRoadHazards()` (dev triage utility with guardrails), until cleanup playbooks are retired.
6. Network dedupe/in-flight audit state supporting refresh de-duplication validation.

## Protected Systems Confirmed Untouched

Confirmed this audit made no implementation changes to:
- Supabase sync
- FRA crossing loading
- Liberty County GeoJSON
- routing engine
- Route Watch logic
- saved places
- map bootstrap
- desktop layout
- landscape tactical architecture
- unified incident generation
- report submission flow
- refresh ownership chain

## Recommended V141.2 Patch

Proposed next patch (not implemented):

1. **Introduce a single debug gate** (e.g., `GRIDLY_DEBUG_DIAGNOSTICS`) default-off in production.
2. **Wrap/remove persistent click diagnostics** (`installMapClickDiagnostics`) behind gate.
3. **Trim routine console logs** to warnings/errors only for production paths; keep high-value audits callable on-demand.
4. **Consolidate audit globals** into one namespaced debug object and remove redundant counters.
5. **Target forced-reflow hotspots** by batching layout reads and separating DOM writes from measurements in key flows:
   - map invalidate/section transitions
   - report surface open/close lifecycle
   - heavy diagnostic geometry snapshots
6. **Re-run performance pass** with explicit before/after measurements for forced reflow events.
