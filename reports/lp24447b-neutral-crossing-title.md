# LP244.47B neutral crossing card title repair

Starting branch: LP244.47-marker-system-unification
Starting HEAD: 78f1b482dd08896125ab8ec6c2736a3c4f1cded0
Starting worktree: clean.

## RCA (reported before patch)
renderCrossings binds the existing Leaflet crossing popup. buildGridlyLeafletCrossingPopupConsumerModel sets popupState=no_report for a crossing without an active report, but defaults its internal type to rail_blocked. buildGridlyCrossingPopupConsumerModel correctly uses no_report for Ready for reports, while prioritizing the canonical incident title regardless of popup state. That canonical path produces Blocked Crossing. The title helper's former neutral fallback was Report a Crossing Issue.

## Correction
Two title-selection lines changed in js/app.js: the helper returns Crossing Location for no_report, and the crossing card model gives that neutral title precedence for no_report. Active canonical titles remain unchanged. No state, taxonomy, action, popup mechanics, identity, marker mapping, anchor, backend or reporting changes.

## Verification
Focused suites: 54 passed, 0 failed. Includes neutral card/helper/actual no-report Leaflet adapter, active blocked and delay models, marker mapping, authority and all 31 original PNG hashes.
Same broader suites as LP244.47: 74 passed, 0 failed.

Real runtime: http://127.0.0.1:5500/ using existing Live Server. Disposable Edge portrait 390x844, cache-disabled reload (hard-refresh equivalent), GET-only network observer. Existing naturally visible Waco Street — Dayton neutral marker still loads 25-crossing-location.png. Tap opens Crossing Location with Ready for reports. Existing Report Blocked / Report Delay actions remain available; these are actions, not assertions of current state. Close works. Existing popup-containment pan occurs on opening; zoom stays 13 and closing causes no additional camera movement. Camera and popup code were untouched. Zero uncaught app errors and zero missing marker requests.

Separate calls through the real browser's existing card model confirm Blocked Crossing with #24, and the existing Train Blocking Crossing delay title with #23. No synthetic report was persisted or published.

All 28 hazard/reference PNGs and 3 navigation PNGs remain byte-identical, verified against Git/source hashes and the served bytes. No PNG files changed.

## Exact changed files
- js/app.js
- tests/lp24447-marker-system.test.cjs
- reports/lp24447b-neutral-crossing-title.md

Local ignored evidence:
- .artifacts/lp24447-runtime-acceptance/lp24447b-focused.txt
- .artifacts/lp24447-runtime-acceptance/lp24447b-broader.txt
- .artifacts/lp24447-runtime-acceptance/lp24447b-runtime.json
- .artifacts/lp24447-runtime-acceptance/lp24447b-popup.png
- .artifacts/lp24447-runtime-acceptance/verify-repair.mjs

One local commit authorized after passing verification: Correct neutral crossing card title.
No merge, push, native build, deployment, backend write, reporting activation or artwork changes.
