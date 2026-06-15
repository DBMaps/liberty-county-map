# V341 — Awareness Cleared Hazard Count Reconciliation

## Goal

V341 reconciles the bottom awareness panel ownership mismatch where the quiet headline could say “No active local issues reported” while the panel count still displayed a non-zero active hazard total after a hazard had been cleared.

## Ownership Decision

The bottom awareness status text and the bottom awareness active hazard count now share one lifecycle-safe policy:

- The headline remains owned by `buildGridlyLightweightActiveAwareness()` and its lifecycle-filtered top-awareness active count.
- The active hazard count is owned by `buildGridlyAwarenessHazardCountConsistencyModel()` using lifecycle-active hazards grouped by incident identity.
- Rendered marker, visible alert, and unified incident fallback counts are retained as audit observations only; they do not inflate the bottom active hazard count when lifecycle-active hazards are zero.

## Lifecycle Reconciliation

Recently-cleared hazards may continue to exist for history, recently-cleared surfaces, marker visibility tracking, and audit diagnosis. They must not contribute to active hazard totals when the lifecycle-filtered awareness headline is quiet.

The reconciliation invariant is:

```js
headlineActiveCount === 0 && awarenessHazardCount === 0
```

unless a future milestone documents an intentional exception.

## V322.6 Preservation

V322.6 confirmation-count protections are preserved. Multiple active records for the same hazard are still grouped by stable incident identity so confirmations can increase confidence and report count without increasing active hazard incident count.

## Audit Helper

V341 adds:

```js
window.gridlyAwarenessCountReconciliationAudit?.()
```

Expected cleared-hazard result:

```js
{
  available: true,
  policyVersion: "V341",
  productionBehaviorChanged: true,
  headlineActiveCount: 0,
  awarenessHazardCount: 0,
  mismatchDetected: false,
  reconciliationApplied: true,
  countsConsistent: true
}
```

## Manual Validation

1. Create a hazard.
2. Confirm the hazard.
3. Clear the hazard.
4. Verify the bottom awareness panel shows quiet status and `0 active hazards`.
5. Run `window.gridlyAwarenessCountReconciliationAudit?.()` and confirm the expected cleared-hazard result above.
