# V650R — San Jacinto Controlled Browser Validation Activation

## Quick Summary

V650R temporarily enables San Jacinto County only for controlled browser validation of the full awareness, boundary, reporting, marker, alert, wording, count, and cross-county switching experience.

This milestone is **not** final production activation approval. San Jacinto remains production-disabled, activation-blocked, rollback-governed, and subject to a later reauthorization milestone before any production acceptance.

## Validation Activation Summary

Temporarily enabled for validation only:

- San Jacinto County
- Coldspring
- Shepherd
- Point Blank
- Oakhurst

Camilla is intentionally not enabled.

Runtime governance for San Jacinto during V650R:

- `stage: validation-only`
- `operational: true` only to allow browser validation paths to execute
- `productionEnabled: false`
- `selectable: true` only for the validation milestone
- `validationOnly: true`
- `productionActivationBlocked: true`
- `productionReauthorizationRequired: true`
- `rollbackRequiredIfBlockersRemain: true`
- Next milestone required: **V651 — San Jacinto Activation Reauthorization Review**

## Browser Validation Instructions

1. Open the app in a real browser.
2. Select San Jacinto County, then choose Coldspring.
3. Run:

   ```js
   window.gridlyCountyBoundaryOverlayAudit?.()
   ```

   Expected audit values:

   - `activeCountyId: "san-jacinto-tx"`
   - `usesCountySpecificPayload: true`
   - `usesStatewidePayload: false`
   - `activeBoundaryVisiblePass: true`

   Visual correctness overrides a mechanical audit pass. The boundary must appear visually credible around San Jacinto County.

4. Submit a fresh San Jacinto hazard from the San Jacinto context.
5. Run:

   ```js
   window.gridlySanJacintoReportSubmissionAudit?.()
   ```

   Expected audit values:

   - `activeCounty: "san-jacinto-tx"`
   - `reportSubmitCounty: "san-jacinto-tx"`
   - `reportRegistrationStatus: "correct_county"`
   - `lastReportVisible: true`
   - `markerVisible: true`
   - `alertVisible: true`
   - `awarenessVisible: true`

6. Confirm user-facing text does not show:

   - Local road impact
   - Road Closed Reported
   - Unknown road
   - placeholder wording

7. Reconcile counts across markers, alerts, top awareness, location card, and route/location panel.
8. Switch counties in this sequence and verify no leakage:

   - Dayton
   - Willis
   - Coldspring
   - Dayton
   - Willis

## Rollback Behavior

If any blocker remains after browser validation, San Jacinto must be returned to:

- not operational
- not production-enabled
- not selectable
- activation blocked

Rollback should remove San Jacinto validation-only selector exposure and restore the non-operational staged posture while preserving the boundary evidence and audit artifacts.

## Merge Recommendation

Merge V650R only as a controlled browser-validation activation patch. Do **not** recommend or declare final San Jacinto production activation from this milestone. If browser validation passes, proceed to **V651 — San Jacinto Activation Reauthorization Review**.
