# LP244.49A certification

Run from the repository root with Node and the installed Playwright package.
Browser scripts use desktop Edge, a loopback server, controlled local provider
responses and mutation-request blocking. They do not certify live providers or
native devices. Do not run more than two browser workers on this audit machine.

`baseline.mjs` captures the starting state once and refuses to overwrite it.
`inventory.mjs` is a read-only shared module. Preserve all LP244.49 evidence.

## Reproduction

1. `node tools/lp24449a/contracts.mjs`
2. `node tools/lp24449a/profiles.mjs`
3. `node tools/lp24449a/search.mjs`
4. `node tools/lp24449a/visible-search.mjs` (`--resume` retries incomplete cases)
5. `node tools/lp24449a/nueces-baseline.mjs`
6. `node tools/lp24449a/home-browser.mjs --shard=0/2` and then or alongside it
   `node tools/lp24449a/home-browser.mjs --shard=1/2`
7. `node tools/lp24449a/transitions.mjs --shard=0/2` and
   `node tools/lp24449a/transitions.mjs --shard=1/2` (default is `0/2`)
8. `node tools/lp24449a/freeze-three-hazards.mjs`
9. `node tools/lp24449a/freeze-verify-settings.cjs`
10. `node tools/lp24449a/freeze-geometry.cjs`
    and `node tools/lp24449a/freeze-saved-places.mjs`
    and `node tools/lp24449a/freeze-clear-compare.cjs`
    and `node tools/lp24449a/text-size-baseline.mjs`
11. `node tools/lp24449a/tests.mjs`
    and `node tools/lp24449a/home-read-performance.mjs`
12. `node tools/lp24449a/integrity.mjs`
    and `node tools/lp24449a/label-baseline.mjs`
13. `node tools/lp24449a/report.mjs`
14. `node tools/lp24449a/docs.mjs`

Search and Home save JSONL checkpoints under `.artifacts/lp24449a`. The report
accepts only Home checkpoints matching the final product source hash. Search
archives checkpoints when the source hash changes. Use `progress.mjs` for a
compact checkpoint summary. A completed row is evidence; an interrupted row is
retried. The report must be generated only after every required suite finishes.

Home shards alternate membership indices and share the completed checkpoint
inventory. Each worker reuses one isolated browser session and performs a real
page reload after every Home save. Earlier checkpoints used county partitions
and fresh contexts between counties; their per-membership assertions are the
same and remain valid. Ring shards alternate county representatives.
Ring workers use exclusive per-shard lock files to avoid duplicate browsers if
a finishing Home queue reaches a shard already running in another worker. If a
worker is forcibly stopped, verify it has ended before removing its stale lock.

The copied historical `freeze-verify-browser.cjs` harness is retained for wider
diagnosis. Its pointer/navigation timing failures are recorded separately; the
explicit three-hazard, Settings and geometry suites form this milestone's gate.
No production handler is replaced to obtain a passing result.

`report.mjs` reconciles all 369 original assertions by stable ID, builds the
362-membership and statewide reports, and emits APPROVE only when every required
gate passes. `docs.mjs` writes the review document, exact managed-file manifest,
and hashes for local screenshot/log artifacts. Neither script commits or pushes.
