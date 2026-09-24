# LP244.49B local certification

Run tools from the repository root with Node and the installed Playwright/Edge.
Use at most two heavy browser workers. All browser sessions block production
mutation methods, service workers and WebSockets before navigation; providers
are blocked or fulfilled locally. This is not live-provider or native testing.

The baseline is branch `LP244.48-destination-quick-check-around-me`, commit
`5538432be3bfe12c6dc0d3f34dcc9fd97c6edc3c`. `baseline.mjs` captures it once and
refuses overwrite. Preserve all LP244.49 and LP244.49A artifacts.

`cluster.mjs`, `prepare-regressions.mjs`, and `prepare-identity-report.mjs` are
one-time audit setup records. Do not rerun them over the finalized harnesses.
`finalize-hold-tooling.mjs` and `finalize-hold-wording.mjs` are also one-time
report corrections, retained to explain the final HOLD aggregation.
`repair.mjs` records the uniquely matched app edits and refuses an already
modified seam. The weather cache repair is recorded in the product diff and
its failing-baseline/passing-current regression test.

## Independent source and data proofs

- `node tools/lp24449b/static.mjs`
- `node tools/lp24449b/crossing-ownership.mjs`
- `node tools/lp24449b/crossing-geometry-proof.mjs`
- `node tools/lp24449b/crossing-statewide.mjs`
- `node tools/lp24449b/targeted-tests.mjs`
- `node tools/lp24449b/weather-tests.mjs`
- `node tools/lp24449b/tests.mjs`

Run ownership before geometry: geometry adds independent containment proof to
the ownership report. The render contract preserves the actual bare canonical
IDs and prefixed package IDs, including the existing governed-inventory fallback.
No package or identity projection is rewritten.

## Browser runs

The two Home workers each cover alternating membership indices:

- `node tools/lp24449b/home-browser.mjs --shard=0/2`
- `node tools/lp24449b/home-browser.mjs --shard=1/2`

The Home cohort is exactly 793 unique memberships at the final app.js hash.
Two weather-cache failure/race corrections landed during this healthy-fixture
batch; final weather compatibility and regression suites certify those paths
separately. Count completed
JSONL rows by membership and source hash, not the cumulative worker log counters.
`node tools/lp24449b/progress.mjs` reports those counts.

`home-weather-retry.mjs` records one full transaction retry for West University
Place after the original correct-owner snapshot preceded weather completion.
It waits for controlled weather completion, preserves the first observation,
and appends the new result; attempt-summary.json counts that retry explicitly.

`regression-queue.mjs --shard=0` and `--shard=1` wait for their Home worker's
result file and then run disjoint browser suites. `extra-queue.mjs` waits for
queue 1, and `ui-queue.mjs` waits for the extra queue. These are ordinary local
processes for this audit, not recurring automations. Do not start duplicate queues.
Queue logs and exit codes are retained; failures are investigated, not discarded.

Individual browser entry points are:

- `search.mjs` — all 2,058 real county-qualified results; source copy and runtime
  inventory per membership; all 362 multi-county County-button interactions.
- `transitions.mjs --shard=0/2` and `--shard=1/2` — 254 ring transitions.
- `contracts.mjs`, `profiles.mjs`, `visible-search.mjs`, `nueces-baseline.mjs` —
  preserved LP244.49A identity, startup, collision and original-witness checks.
- `provider-matrix.mjs` — ten controlled source states and visible KBYG/Alerts.
- `baseline-replay.mjs --pulse` — starting-source original Pulse witnesses.
- `baseline-replay.mjs --current --pulse` — repaired-source timed witnesses,
  normal refresh and original Return Home/county transition queries.
  It also repeats the original snapshot-helper capture order separately from
  passive timed samples, then reruns the starting-source cases sequentially
  with those same observation points. Initial baseline output is archived.
- `baseline-replay.mjs` / `--current` — Aransas Pass County-filter witness.
- `filter-lifecycle.mjs` — Search, Around Me, Return Home and route protection.
- `pulse-statewide.mjs` — local active/clear fixture in all 254 county representatives.
- `rail-lifecycle.mjs` — neutral, blocked, popup clear, delay and popup clear.
- `freeze-three-hazards.mjs`, `freeze-verify-settings.cjs`, `freeze-geometry.cjs`,
  `freeze-saved-places.mjs`, `freeze-clear-compare.cjs`, `text-size-baseline.mjs`,
  `ui-messages.mjs` — frozen UI, same-baseline diagnostic and accessibility checks.
- `label-baseline.mjs`, `home-read-performance.mjs` — preserved formatting and
  repeated-read timing, with exact starting-source comparisons.

After all suites finish, rerun integrity and assemble reports:

1. `node tools/lp24449b/integrity.mjs`
2. `node tools/lp24449b/identity-report.mjs`
3. `node tools/lp24449b/report.mjs`

Reports fail closed on missing required suites. The original 2,020 stable failure
IDs are always retained. Historical Pulse observations are preserved even when
current timed replays pass; no unverifiable historical writer ordering is asserted.
Only a fully passing local gate permits the user-authorized single local commit.
`attempt-summary.json` retains failed/repeated membership attempts separately
from accepted results. `performance.json` itemizes the counted browser scenarios.

## Final Pulse blocker

The primary statewide Pulse result is **253/254**, not 254/254. Two independent
sequence diagnostics also returned 253/254, with different failed witnesses.
Never retry the primary script merely to replace its failed observation with a
passing isolated run. The original evidence remains intact.

`pulse-sequence-diagnostic.mjs` adds passive timed follow-up after a failure.
`pulse-writer-diagnostic.mjs` records publication writers and freshly rebuilt
model counts. Their generated scripts retain the exact executed code.
`pulse-diagnostic.mjs` planned 30 isolated cases but was stopped after five
completed passing cases to prioritize sequence reproduction; its output explicitly
records the partial execution. None of these diagnostics authorizes a product patch.

Run `pulse-blocker-analysis.mjs` before the final report. HOLD prevents a commit.
The ten original Pulse witnesses converge in isolation but their family closure
remains pending because the defect reproduced in three statewide sequences.
