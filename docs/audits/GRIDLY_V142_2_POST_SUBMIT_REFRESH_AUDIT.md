# GRIDLY V142.2 — Post-Submit Refresh Duplication Audit

## Scope
Audit-only pass for duplicate post-submit background refresh logs.

## Function audited
- `runPostSubmitRefreshInBackground(submitAudit, markSubmitStage, sourceTag?)`

## Callers found
- **Direct caller (1):** `createSharedHazardReport(...)` success path calls `runPostSubmitRefreshInBackground(...)` after UI reset.
  - File: `js/app.js`
  - This call occurs once in code, but can execute more than once if submit completion logic runs more than once.

## Submit handlers / flows reviewed
- `window.submitHazardNearMe(...)` (mobile + portrait flow, GPS path) → `createSharedHazardReport(...)`.
- Tap-map submit flow (`finalizeTapMapHazardPlacement`) → `createSharedHazardReport(...)`.
- Data-action delegate (`document.addEventListener("click", handleDataActionClick)`) dispatches `submit-hazard`.
- Desktop report CTA wiring reviewed; it opens hazard/report surfaces and feeds same submit pipeline.

## Duplicate listener / duplicate completion risks

### 1) Global delegated click handler can be double-bound if init path re-enters
- Found unguarded registration:
  - `document.addEventListener("click", handleDataActionClick);`
- If the enclosing initialization block executes more than once (e.g., repeated startup path introduced during V140/V141 stabilization sequencing), each submit click can trigger duplicate handler execution.
- Classification: **likely double listener risk**.

### 2) Submit completion can run twice from parallel submit entry points
- `createSharedHazardReport(...)` has one direct refresh launch point, but multiple UX paths can converge rapidly (Use My Location / map placement / portrait sheet).
- Existing `submissionInProgress` guard reduces risk, but race/timing around listener duplication can still cause near-back-to-back successful completion handling.
- Classification: **double submit completion handling risk**.

### 3) Intentional separate refresh?
- No second intentional `runPostSubmitRefreshInBackground` caller found.
- Current duplicated console pattern is **not explained by intentional separate refresh paths** in source.
- Classification: **not intentional separate refresh** based on static audit.

## Retry/background refresh paths checked
- `loadSharedReports("post_submit_refresh")` dedupe and suppression logic exists.
- Realtime and interval refresh are suppressed around post-submit windows, but these do not generate the same “Post-submit refresh started in background” log (that log is from `runPostSubmitRefreshInBackground` entry itself).

## V140/V141 change interaction suspicion
- Stabilization era introduced additional global/document delegated event wiring and modal/surface orchestration.
- Most plausible regression mechanism: init re-entry causing duplicated delegated click bindings, resulting in duplicate submit completion pipeline execution.

## Added passive audit helper (no behavior change)
- `window.gridlyPostSubmitRefreshAudit()` now returns:
  - `callCount`
  - `callSources`
  - `lastCallAt`
  - `recentCalls`
  - `submitHandlersFound`
  - `duplicateHandlerRisks`
  - `recommendedFixes`

## Recommended V142.3 fix scope (do not apply in V142.2)
1. Add idempotent guard for global submit/data-action delegated click binding.
2. Add submit-lifecycle nonce/idempotency gate around post-submit completion section in `createSharedHazardReport`.
3. Add optional per-lifecycle dedupe gate for `runPostSubmitRefreshInBackground` launch, while preserving current refresh behavior semantics.

