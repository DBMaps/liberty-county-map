# Gridly V309 Stability Baseline Validation

Date: 2026-06-14

Scope: validation-only post-crossing-recovery baseline. This document records the accepted state after the crossing recovery and portrait stabilization stack. No production JavaScript, CSS, HTML, data-source priority, or crossing architecture changes are included in V309.

## Baseline Purpose

V309 establishes a clean stability baseline before any new feature work resumes. The current stack is accepted as visually passing for crossing visibility, crossing interaction, FRA remote fetch/normalization, and portrait bottom containment.

This milestone is documentation-only and should be used as the handoff reference for post-merge smoke validation.

## Confirmed Merged Stack Coverage

The current merged stack is considered to include the following recovery and stabilization work:

- Crossing render audit count fix.
- Crossing marker readability.
- Portrait bottom containment structure.
- Bottom cushion and popup containment polish.
- Crossing popup safe-zone pan.
- Measured usable-area popup centering.

## Accepted Visual Status

The following user-facing behavior is accepted for this baseline:

- FRA remote fetch is working.
- FRA normalization succeeds.
- Crossings are visible on the map.
- Crossings are tappable.
- Crossing popups open.
- Portrait bottom region is contained.
- Dock remains tappable and is not dimmed.

## Known Audit Discrepancy

`gridlyCrossingRenderAudit` currently reports `0` crossing markers. This is a known discrepancy and is classified as an audit accuracy issue, not a production blocker for V309.

Accepted interpretation:

- `gridlyCrossingRenderAudit` reports `0` markers and is therefore suspect for this milestone.
- `gridlyRenderedMapObjectCensus` detects crossing inventory and rendered marker objects.
- User-facing crossing behavior passes: crossings are visible, tappable, and popups open.
- This discrepancy should not block the V309 stability baseline.

Follow-up should focus on audit cleanup rather than crossing architecture changes or source-priority changes.

## Recommended Post-Merge Validation Checklist

Run these browser-console checks after merging V309 and loading the app in the target validation environment:

```js
window.gridlyUiSmokeTest?.()
window.gridlyPortraitStabilitySmokeAudit?.()
window.gridlyCrossingPipelineAudit?.()
window.gridlyRenderedMapObjectCensus?.()
```

Notes:

- Treat `gridlyRenderedMapObjectCensus` as the preferred crossing-render evidence for this baseline.
- Do not use `gridlyCrossingRenderAudit` as a blocking criterion until its marker-count discrepancy is corrected.
- If user-facing crossing behavior regresses, stop and investigate the visible behavior first before relying on the suspect audit.

## Do Not Proceed Yet

The following workstreams are explicitly out of scope until a post-V309 decision is made:

- Route Watch shadow scoring.
- Directional display, including NB/SB/EB/WB work.
- PWA work.
- County expansion.
- Alternate routes.

Additional guardrails for this baseline:

- Do not rewrite crossing architecture.
- Do not change FRA source priority.
- Do not hardcode Liberty County as the primary source.
- Do not make local crossing inventory primary.
- Do not chase cosmetic polish.

## Recommended Next Decision Options After V309

After V309 is merged and validated, choose one of these next tracks deliberately:

1. **Route Watch stability review** — assess whether existing Route Watch behavior is stable enough before any shadow-scoring work resumes.
2. **Beta readiness polish** — address user-facing readiness, supportability, and small polish items that do not alter crossing architecture.
3. **Audit cleanup** — correct the `gridlyCrossingRenderAudit` marker-count discrepancy and align audit evidence with rendered-object census results.
4. **PWA/app path** — resume app/PWA decisions only after the baseline remains stable.

## V309 Classification

V309 is accepted as a stability and validation baseline. The milestone should not be interpreted as approval to restart deferred feature work. The only known blocker-like item is the suspect `gridlyCrossingRenderAudit` marker count, and it is intentionally classified as an audit accuracy issue rather than a production crossing-render blocker.
