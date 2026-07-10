# GRIDLY V927R — Community Pulse Simulation Path Repair

## V926 stable baseline
V926 browser validation was treated as the restoration baseline: completed, correctness, popup, marker membership, generation consistency, public persistence, run ID alignment, panel/Alerts/crossing samples, long-task capture, and blocked-main-thread capture passed. Its only unresolved required sample was Community Pulse.

## V927 failed browser evidence
The first V927 run did not complete, reported unsafe beta status, failed correctness/restoration/marker membership, timed out during `zoom_restore`, `large_movement_restore`, and final `restoration`, and did not prove Community Pulse production-path execution.

## Regression root cause
The V927 scenario still depended on directly reaching the lexical portrait refresh function from inside the simulation and then sampled marker membership before a restored, settled final state. That made final expected and actual marker inventories vulnerable to being taken from different viewport/render-generation states.

## Community Pulse invocation root cause
The production refresh function is lexical in `js/app.js`, so a window-level monkey patch is not authoritative proof that the production function entered. V927 also did not expose an explicit audit invocation contract, so an unavailable or bypassed callable could look like a completed scenario without production entry evidence.

## Restoration timeout causes
The prior bounded wait only watched the current frame-scheduling active-generation array. It did not record the generation/marker state used by each phase, and final validation could proceed before the same restored generation was used for expected and actual marker snapshots.

## Simulation-path repair
V927R adds a narrow audit adapter, `window.gridlyInvokePortraitLocalizedRefreshForAudit(reason)`, which calls the exact lexical `refreshPortraitV2LocalizedIntelligence({ reason })` function without changing inputs, guards, DOM behavior, or production write behavior. The simulation records attempted/available/entered/exited/result/completion/error/skipped invocation diagnostics.

## Completion synchronization strategy
The simulation wait now records generation state at start and completion, waits for bounded animation frames plus stable marker membership, and reports timeout phases with generation evidence. Scenario isolation snapshots are captured around Community Pulse invocation.

## Marker snapshot alignment
Final validation restores the original viewport, awaits settling, computes expected marker IDs from that restored state, waits one bounded alignment phase, then reads actual marker IDs for comparison.

## Rendered versus reuse classification
Rendered outcomes still require finite real timing. Reuse outcomes keep `durationMs: null`, require production/evaluation evidence, and report `captureStatus: "reused_unchanged"`. No fake zero Community Pulse timing is introduced.

## Protected systems unchanged
V927R is limited to simulation invocation, diagnostics, and completion synchronization. It does not add production write paths or change crossing behavior, marker lifecycle, viewport product behavior, Community Pulse product behavior, V923 reuse guards, Alerts, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase contracts, or protected-system flags.

## Browser validation steps
Run the milestone browser console command after loading the app and inspect `window.gridlyCommunityPulseSimulationPathAudit?.()` alongside the existing summary and capture helpers. Do not merge if restoration or marker membership fails, even if Community Pulse evidence passes.
