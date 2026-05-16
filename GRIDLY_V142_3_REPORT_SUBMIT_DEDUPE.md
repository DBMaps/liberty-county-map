# GRIDLY V142.3 — Report Submit Binding Dedupe Patch

## Root Cause
Duplicate report-submit/post-submit handling could occur when report UI entry points were reached by both:
- direct button click handlers, and
- delegated global `[data-action]` click handling.

In re-entry scenarios, the global `document.addEventListener("click", handleDataActionClick)` could be rebound, increasing duplicate path risk. Separately, the post-submit success lifecycle could be entered more than once for a logically identical submit completion path.

## Exact Guards Added
1. **Global delegated click bind idempotency guard**
   - Added one-time binding gate using `window.__gridlyHandleDataActionClickBound`.
   - Result: `handleDataActionClick` is only globally bound once, even if init code re-runs.

2. **Submit lifecycle dedupe guard (nonce/id based)**
   - Added short-lived submit lifecycle guard keyed by submit lifecycle id (`row.crossing_id`).
   - New state:
     - `activeSubmitGuard`
     - `lastSubmitLifecycleId`
     - `lastCompletedAt`
     - `duplicateSuppressedCount`
   - New helpers:
     - `beginSubmitLifecycleGuard(lifecycleId)`
     - `endSubmitLifecycleGuard(lifecycleId)`
   - TTL: `GRIDLY_SUBMIT_LIFECYCLE_GUARD_TTL_MS = 15000`.
   - If duplicate lifecycle entry is detected for same lifecycle id in guard window, duplicate success handling is suppressed before post-submit completion path re-runs.

3. **Audit surface updated**
   - `window.gridlyPostSubmitRefreshAudit()` now reports:
     - `duplicateSuppressedCount`
     - `lastSubmitLifecycleId`
     - `activeSubmitGuard`

## Why Legitimate Repeat Submits Still Work
- Each legitimate report creates a **new** `row.crossing_id` using timestamped device-specific id format.
- Guard dedupe key is lifecycle id, so a fresh user submit uses a new id and is not blocked.
- Guard is short-lived and auto-clearing (`endSubmitLifecycleGuard`) with TTL backing behavior, preventing stale suppression.

## Protected Systems
- Post-submit refresh launch path (`runPostSubmitRefreshInBackground` call site) from duplicate success lifecycle execution.
- Global delegated action click registration from duplicate app-init/re-entry bindings.
- Existing reporting paths preserved:
  - Tap Map Location
  - Use My Location
  - popup report
  - mobile flow
  - desktop flow

## Validation Checklist
- [ ] Hard refresh app.
- [ ] Submit one test report.
- [ ] Run `window.gridlyPostSubmitRefreshAudit()`.
- [ ] Verify one post-submit refresh start for one submit.
- [ ] Verify no duplicate “Post-submit refresh started” pair.
- [ ] Verify `duplicateSuppressedCount` is `0` unless a true duplicate was suppressed.
- [ ] Verify report still appears.
- [ ] Verify Tap Map Location still works.
- [ ] Verify Use My Location still works.
- [ ] Verify crossing popup still opens.
