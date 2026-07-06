# GRIDLY V894C — Beta First Run Experience

## Objective

Add a lightweight, friendly, skippable first-run walkthrough for beta testers so they understand the major Gridly controls before testing.

## Runtime behavior

- The walkthrough uses local device storage only.
- Completion is stored under `gridlyBetaFirstRunWalkthroughCompleteV894C`.
- The first-run open path checks the existing welcome key and the V894C walkthrough key before opening, so the walkthrough appears only when incomplete.
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
- `completedStateDetected`
- `appearsOnlyWhenIncomplete`
- `skippable`
- `restartableFromSettings`
- `consumerLanguage`
- `protectedSystemsUnchanged`
- `safeForBeta`

## Protected systems

No Supabase schema, hazard lifecycle, alert generation, awareness filtering, Route Watch logic, report acceptance logic, clearing logic, weather logic, or protected system behavior was changed. This is a presentation/UI guidance change only.
