Community loading performance repair validation

Run commands from the repository root. No command in this directory commits,
pushes, merges, runs a store build, or deploys the application.

Tests

  node tools/community-loading-repair/run-tests.cjs before investigation
  node tools/community-loading-repair/run-tests.cjs after investigation
  node tools/community-loading-repair/run-tests.cjs before expanded
  node tools/community-loading-repair/run-tests.cjs after expanded
  node --test --test-reporter=tap tests/community-loading-performance-repair.test.cjs

The before hook reads app.js from commit 9c28c002 using git show. It substitutes
that source in test processes only; it never writes an application file.
The investigation manifest reproduces all 339 original reported tests. The
expanded suite adds relevant native, portrait, popup and road-context checks.
It overlaps one passing test file with the investigation suite. Count results
by suite rather than claiming every reported test is unique.

Controlled browser replay (PowerShell)

  $env:AUDIT_HOST = 'preview.gridlygo.com'
  $env:AUDIT_ROAD_REPLAY = '1'
  $env:AUDIT_RUNS = '3'
  $env:REPAIR_PHASE = 'before'
  node tools/community-loading-repair/replay.cjs
  $env:REPAIR_PHASE = 'after'
  node tools/community-loading-repair/replay.cjs

Requires installed Edge and Playwright, plus the original investigation's
library and hash-verified roadway fixtures in .artifacts/community-loading-audit.
Use GRIDLY_PLAYWRIGHT_MODULE to select an installed Playwright module directory;
otherwise the repository package or the bundled Windows runtime is used.
The recognized hostname resolves exclusively to the loopback server. External
writes, WebSockets, and unfixtureed providers are blocked. These are controlled
browser replays; they do not certify a paid store launch, live feed or device.
The runner preserves/serves before-app.js under the artifact directory. Do not
replace that file with a different baseline. Outputs stay in ignored artifacts.

For functional checks set REPAIR_CHECKS=1 and AUDIT_RUNS=1. Run both phases.
The checks retain fresh countywide NWS and nearby roadway alerts, exercise
community clearing, errors, real popup activation, Search, Around Me, expiry,
Return Home, Route Watch context protection and fast county switching.
Each state awaits the real context-qualified weather refresh and rejects an
in-flight authority capture, avoiding comparison of different loading phases.
The clear-fixture step uses its own report-read reason and verifies a new
successful retrieval, so the existing manual-refresh dedupe cannot skip it.
For the active blocked-crossing popup case also set REPAIR_ACTIVE_POPUP=1
and AUDIT_CASES=Dayton. Clear those two variables for the full four-case run.
Clear REPAIR_CHECKS for the normal performance comparison cohort.

  node tools/community-loading-repair/report.cjs

This last command asserts the ordered crossing sets, context/membership/camera
parity, every paired settled functional surface's IDs, source ownership and
coordinates, popup content, and exact before/after failure lists. It writes
comparison.json. Read REPAIR_REPORT.txt beside it for interpretation and limits.

Do not call reload cases warm HTTP-cache benchmarks: interception prevents a
representative warm-cache measurement. Sampled CPU figures are totals across
different observed navigation/probe windows, not a per-call microbenchmark.
