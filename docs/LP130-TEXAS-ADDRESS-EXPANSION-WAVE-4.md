# LP130 — Texas Statewide Address Manufacturing Completion

## Scope and baseline

LP130 replaces the former five-county Wave 4 scope with one owner-local statewide workflow. The committed starting aggregate has 34 unique candidate counties, including Burleson, Trinity, and Victoria. The official registry has 254 counties, leaving exactly 220 candidates to manufacture. The former Angelina, Bastrop, Bee, Bell, and Caldwell cohort has no separate status; those counties retain their normal positions in the ascending five-digit-FIPS queue.

All outputs are inactive candidates. LP130 does not activate a runtime manifest, upload Storage objects, change Supabase or Edge Functions, promote production data, or alter address matching, search, deployment, awareness, hazards, alerts, Shared Reports, or Route Watch. The production runtime manifest is hashed before work and verified unchanged after work.

## Deterministic statewide plan

The runner reads `data/lp104/texas-counties.json` and the aggregate address-package manifest, rejects duplicate FIPS or package names, excludes every represented FIPS, sorts the remainder by FIPS, and persists the plan so later runs cannot be renumbered as the aggregate grows. The default size is 25; `--batch-size` supplies a positive-integer override.

The initial plan contains nine batches: batches 01–08 contain 25 counties apiece and batch 09 contains 20. The governed county-by-county plan is in `evidence/lp130/statewide-batch-plan.json` and `.csv`.

`--batch N` processes one batch. `--all` processes incomplete batches in order. With `--resume`, a county is skipped only after its package, sidecar, runtime certificate, and LP104.6 certification all pass independent validation. A failure stays in the deterministic resume list and prevents that batch from receiving `COMPLETE` status. Existing represented counties are never selected, and there is no force/rebuild option in this runner.

For each package, validation fully decompresses gzip, parses every non-empty JSONL row, checks county/FIPS identity, reconciles source/accepted/rejected/duplicate and indexed-record counts, and independently reconciles bytes and SHA-256 across metadata surfaces. Each batch gets a manufacturing report, batch-only inactive candidate manifest, validation report, and package hash inventory. Statewide progress, failures, and resume-list outputs live under `reports/lp130-statewide-addresses/`. The runner prints the completed batch, stage paths, and exact suggested commit subject; it never commits or pushes.

## Owner PowerShell 5.1 commands

### Preview the complete plan (manufactures nothing)

```powershell
Set-Location C:\GitHub\liberty-county-map

node tools/lp130/manufacture-remaining-texas-addresses.mjs `
  --gdb "C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb" `
  --batch-size 25 `
  --dry-run `
  --reports "reports/lp130-statewide-addresses"
```

### Run or resume batch 01 only

```powershell
Set-Location C:\GitHub\liberty-county-map

node tools/lp130/manufacture-remaining-texas-addresses.mjs `
  --gdb "C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb" `
  --batch-size 25 `
  --batch 1 `
  --resume `
  --reports "reports/lp130-statewide-addresses"
```

### Run or resume every remaining batch

```powershell
Set-Location C:\GitHub\liberty-county-map

node tools/lp130/manufacture-remaining-texas-addresses.mjs `
  --gdb "C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb" `
  --batch-size 25 `
  --all `
  --resume `
  --reports "reports/lp130-statewide-addresses"
```

## Batch commit workflow

After each `COMPLETE` batch, review the printed stage paths and reports, then run (substituting the printed two-digit batch number):

```powershell
git status --short
git add data/generated/lp104/txgio-addresses evidence/lp130 reports/lp130-statewide-addresses
git diff --cached --check
git commit -m "Add Texas statewide address batch 01"
git push
```

Repeat as `batch 02` / `Add Texas statewide address batch 02` through `batch 09` / `Add Texas statewide address batch 09`. Do not stage the GDB or temporary extraction files. No Codex review is required between batches.

## Final determinism and phase boundary

Manufacture and automatically validate the 220 counties once. After all batches are committed, rerun all 254 packages into a separate owner workspace and compare every package filename, byte size, and SHA-256. Save one statewide deterministic comparison report; timestamps and local paths may be operational metadata but must not govern pass/fail. Return to Codex once for final reconciliation only after that evidence exists. Runtime activation and launch sequencing (where adjacency may matter) remain deferred to a separately authorized milestone.
