# GRIDLY V894C — Beta First Run Experience

## Objective

Add a lightweight, friendly, skippable first-run walkthrough for beta testers so they understand the major Gridly controls before testing.

## Corrected V894C1 state model

- The canonical completion source is `gridlyBetaFirstRunWalkthroughCompleteV894C`.
- `getGridlyFirstRunCompletionStorageKey()` returns the canonical completion source, and `isGridlyFirstRunWalkthroughComplete()` is the shared completion detector.
- Skip, finish, and setup completion all call the same completion path, so walkthrough completion is stored once instead of partially synchronized across welcome/setup keys.
- Legacy welcome/setup completion keys are treated as orphan-prone compatibility keys and are cleared when completion is stored or reset.
- The legacy `gridlyWelcomeSeenV1` key is no longer written as a parallel completion source.
- A fresh user has no canonical completion value, so the walkthrough appears.
- Skip marks the canonical walkthrough completion source and the walkthrough does not appear again.
- Finish/setup completion marks the canonical walkthrough completion source and the walkthrough does not appear again.
- **Show walkthrough again** from Settings resets the canonical completion source, clears welcome/setup completion state owned by the walkthrough, and then reopens the walkthrough.
- `window.gridlyResetFirstRunWalkthrough?.()` uses the same reset path and fully restores first-run walkthrough state.

## Runtime behavior

- The walkthrough uses local device storage only.
- Completion is stored under `gridlyBetaFirstRunWalkthroughCompleteV894C`.
- The first-run open path checks the canonical completion source before opening, so the walkthrough appears only when incomplete.
- Opening is scheduled with `requestAnimationFrame`, allowing the core app shell to render first.
- The walkthrough can be skipped, completed through setup, or restarted from Settings with the **Show walkthrough again** action.

## Walkthrough coverage

The beta walkthrough uses consumer-facing language and explains:

- `Know Before You Go / Awareness Brief` — the starting summary for what may affect a drive.
- `Map` — nearby crossings, reports, and road conditions.
- `Alerts` — important items in one list.
- `Report` — how testers share a road hazard or crossing issue.
- `Search` / destination awareness — check a destination before leaving.
- `Awareness area` / `Home area` — the community Gridly watches first.

## Console helpers

```js
window.gridlyFirstRunExperienceAudit?.()
window.gridlyResetFirstRunWalkthrough?.()
```

The audit reports:

- `available`
- `walkthroughConfigured`
- `localStorageKey`
- `canonicalCompletionSource`
- `walkthroughCompletionStored`
- `walkthroughCompletionDetected`
- `resetFullyClearsCompletion`
- `skipPersistsCompletion`
- `finishPersistsCompletion`
- `restartFromSettingsWorks`
- `noOrphanedLocalStorageKeys`
- `completedStateDetected`
- `appearsOnlyWhenIncomplete`
- `skippable`
- `restartableFromSettings`
- `consumerLanguage`
- `protectedSystemsUnchanged`
- `safeForBeta`

## Protected systems

No Supabase schema, hazard lifecycle, alert generation, awareness filtering, Route Watch logic, report acceptance logic, clearing logic, weather logic, or protected system behavior was changed. This is a walkthrough state bug fix only.
