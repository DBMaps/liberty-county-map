# GRIDLY V920 Main-Thread Performance Repair

## 1. Executive summary
V920 repairs the V919 user-visible delay by making the Alerts panel acknowledge/open before heavy work, skipping unchanged alert DOM replacement, skipping unchanged crossing marker rebuilds, coalescing terminal map move/zoom crossing work, and adding lightweight production attribution helpers.

## 2. Original V919 evidence
Original V919 evidence: blockedMainThreadTime 47,483 ms; longTasks over50 150, over100 149, over250 119, over500 28. Panel opening P50/P95 was 295.2/527.3 ms. Alert rendering P50/P95 was 268.2/283.0 ms. Crossing marker rendering P50/P95 was 277.1/283.4 ms. duplicateRequests and duplicateRenders were 0.

## 3. Root causes
The costly owners were synchronous panel content generation before shell response, alert list replacement when content signatures were unchanged, crossing layer clear/rebuild during legitimate marker reconciliation, and uncoalesced terminal move/zoom scheduling.

## 4. Functions responsible
Responsible functions: `openAlertsSurfaceFromDock`, `renderAlerts`, `renderCrossings`, `renderCrossingMarkersFromList`, `crossingLayer.clearLayers`, and the `zoomend moveend` handler in `initMap`.

## 5. Panel opening findings
The Alerts open path previously mixed tap handling, model filtering, HTML building, and focus wiring. V920 marks the shell open path first and leaves cached/local content visible before asynchronous/background reconciliation.

## 6. Alert rendering findings
Alert rendering spent time in commute consequence construction, filtering, grouping, formatting, and replacing `els.alertsList.innerHTML`. V920 computes one visible collection per open/render and preserves DOM when the signature is unchanged.

## 7. Crossing rendering findings
Crossing rendering remained expensive when it cleared the full layer and rebuilt marker objects/listeners/icons for an unchanged viewport signature. V920 skips unchanged marker signatures and measures marker creation/listener wiring explicitly.

## 8. Listener findings
The V919 scheduler count could represent registrations or dispatches. V920 adds `window.gridlyListenerLifecycleAudit?.()` with registrations, removals, active count, repeated attempts, and leak likelihood.

## 9. Map move/zoom findings
Move/zoom terminal work now coalesces to one animation frame and keeps per-frame Leaflet movement free of marker reconciliation.

## 10. Instrumentation overhead findings
V920 keeps lightweight counters active, exposes detailed attribution on demand, and reports wrapper, observer, listener, timer, mark/measure, and simulation-only overhead via `window.gridlyPerformanceInstrumentationOverheadAudit?.()`.

## 11. Corrections implemented
- Panel shell marked visible before heavy content.
- Alert render signature skips unchanged DOM replacement.
- Alert delegated listener guard is preserved.
- Crossing render signature skips unchanged clear/rebuild.
- Crossing clear and marker render functions are explicitly measured.
- Move/zoom terminal crossing reconciliation is coalesced.
- Main-thread attribution, listener lifecycle, and instrumentation overhead helpers are exposed.

## 12. Before/after table
| Metric | V919 before | V920 expected after |
|---|---:|---:|
| blockedMainThreadTime | 47,483 ms | at least 60% lower in browser validation |
| longTasks over250 | 119 | at least 75% lower in browser validation |
| duplicateRequests | 0 | 0 |
| duplicateRenders | 0 | 0 |

## 13. P50/P95 comparison
| Interaction | V919 before P50/P95 | V920 target P50/P95 |
|---|---:|---:|
| Panel opening | 295.2 / 527.3 ms | under 100 / under 200 ms |
| Alert rendering | 268.2 / 283.0 ms | under 100 / under 150 ms |
| Crossing marker rendering | 277.1 / 283.4 ms | under 150 / under 200 ms |

## 14. Long-task comparison
The before counts were over50 150, over100 149, over250 119, over500 28. The V920 validation command below should confirm no common interaction over 500 ms and at least 75% fewer over250 tasks.

## 15. Protected-system confirmation
Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase contracts, PUBLIC_ROADWAY crossing filtering, trust/evidence rules, consumer language, V918 popup lifecycle, V917 street-level crossing visibility, report integrity, and beta-safe behavior were preserved.

## 16. Browser validation commands
```js
await window.gridlyRunPerformanceSimulation?.({
  profile: "mobile-normal",
  iterations: 20,
  includeReporting: true,
  includeAlerts: true,
  includeCrossings: true,
  includeHazards: true,
  includeSearch: true,
  includeMapStress: true
})
window.gridlyPerformanceSimulationSummary?.()
window.gridlyMainThreadAttributionAudit?.()
window.gridlyListenerLifecycleAudit?.()
window.gridlyPerformanceInstrumentationOverheadAudit?.()
window.gridlyCrossingRenderLifecycleAudit?.()
```

## 17. Real-device validation checklist
1. On a mid-range mobile device, tap Alerts and verify pressed acknowledgement is immediate.
2. Verify the panel shell appears before full content completes.
3. Pan and zoom the map repeatedly; marker reconciliation should not stall map movement.
4. Tap a crossing marker once; popup should open without flicker.
5. Repeat popup open/close while panning; crossing layer must not rebuild during popup interaction.
6. Confirm street-level PUBLIC_ROADWAY crossings remain visible.
7. Submit no real reports during simulation; simulations must remain read-only.

## 18. Remaining observations
If browser validation still misses a target, inspect `worstFunctions` from `gridlyMainThreadAttributionAudit` and split only the measured owner with a generation token.

## 19. Clear merge recommendation
Clear merge recommendation: merge after the listed automated tests pass and one browser validation run confirms duplicateRequests 0, duplicateRenders 0, no popup flicker, and improved P50/P95 timings.
