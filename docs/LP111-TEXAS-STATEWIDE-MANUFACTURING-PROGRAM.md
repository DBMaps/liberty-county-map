# LP111 — Texas statewide manufacturing program execution baseline

## 1. Startup verification

LP111 started on branch `work` at commit `ea64c1c3a0bc4830f5f5f6eec8a1a759c35551cd`. `git status --short --branch` reported only `android/.gradle/`, `android/build/`, and `node_modules/` as untracked; these are the explicitly permitted generated directories. There were no modified or deleted tracked files. No applicable `AGENTS.md` was present in `/`, `/root`, `/workspace`, or the repository. The branch name was accepted as-is.

The available repository has one local branch (`work`), no configured remotes, and no LP104–LP108 tags. Nevertheless, the complete merged pull-request history is reachable from `HEAD`. LP111 inspected all refs, path history, renamed/deleted paths, package scripts, tests, documentation, manifests, and object names with `git branch --all`, `git log --all`, `git log --all --name-status`, `git rev-list --all --objects`, `git grep`, and `git show`. The relevant tools are already present at their latest merged versions; therefore **no historical file restoration was necessary** and no generated artifact was changed.

## 2. Recovered tooling inventory and authoritative sources

“Source” below names the most recent governing implementation commit, not merely a documentation commit. Every listed commit is an ancestor of the current merged baseline.

| Component | Classification | Authoritative path and commit | Purpose / last validated milestone | Tests and dependency assessment |
|---|---|---|---|---|
| Texas county control plane | **READY** | `data/lp104/texas-counties.json` — `2e3766f` | Exactly 254 canonical county/FIPS identities and the unchanged initial-28 cohort; LP104.1. | Exercised by LP104.1, LP105, LP105.1, LP107, and LP108 tests. Self-contained and safe unchanged. |
| TxGIO package builder | **RESTORED AND VALIDATED** | `tools/lp104/build-txgio-address-packages.mjs` — `d79ec8b`, corrected by `b2f6b89` | Selects Liberty, initial 28, comma-separated FIPS, or all Texas; deterministic gzip/sidecars/manifest; resumable verified-county skip; LP104.4. | `tests/lp1044-txgio-address-builder.test.mjs`; needs the owner FileGDB and GDAL only for real builds. Current corrected version supersedes the original ogr2ogr invocation. |
| Package query and certification | **RESTORED AND VALIDATED** | `tools/lp104/query-txgio-address-package.mjs` — `a03887c`; `tools/lp104/certify-texas-address-package.mjs` — `bdef93a` | Read-only exact query and strict deterministic certification; LP104.4/LP104.6. | LP104.4 query and LP104.6 suites. Requires a selected package/manifest for execution; no runtime redesign. |
| Statewide source inventory | **RESTORED AND VALIDATED** | `tools/lp105/inventory-txgio-statewide.mjs` — `60fabc7`, corrected by `7e56624` | Aggregate-only `--fips`, `--gridly-counties`, or `--all-texas`; atomic checkpoint, resume, source-identity guard, concurrency 1–4; LP105. | `tests/lp105-texas-statewide-readiness.test.mjs`. Needs owner FileGDB/GDAL for a real inventory. Shape-column correction supersedes the original query. |
| Manufacturing orchestration | **READY** for 28; **REQUIRES PARAMETERIZATION** for expansion | `tools/lp1051/manufacture-gridly-28-address-counties.mjs` — `99a2674` | Continue-on-failure orchestration and candidate manifest/certification evidence for exactly the governed 28; LP105.1. | `tests/lp1051-28-county-manufacturing-orchestrator.test.mjs`. Intentionally fixed to the production cohort; do not use it as a 254-county activator. |
| Runtime certificate generator | **RESTORED AND VALIDATED** for 28; **REQUIRES PARAMETERIZATION** for expansion | `tools/lp107/generate-runtime-certificates.mjs` — `30ccd7a` | Deterministic package hash/certificate generation, verification-only mode, atomic preservation; LP107. | `tests/lp107-runtime-certificate-readiness.test.mjs`. Uses tracked packages/manifests; selection is intentionally initial-28. |
| Storage planning/upload/download verification | **RESTORED AND VALIDATED** for 28; **REQUIRES PARAMETERIZATION** for expansion | `tools/lp108/sync-certified-address-storage.mjs`, `tools/lp108/lp108-core.mjs` — `91dd9c3`, fixes through `709ad3f` | Plan, private upload, bounded retry, mismatch refusal, and SHA-256/size verification of downloaded bytes; LP108–LP108.4. | `tests/lp108-storage-and-runtime-certification.test.mjs`. Plan is credential-free; remote modes require owner Supabase values. Later fixes supersede metadata/listing-only verification and legacy-only authentication. |
| Remote runtime certification | **RESTORED AND VALIDATED** for 28; **REQUIRES PARAMETERIZATION** for expansion | `tools/lp108/certify-remote-runtime.mjs` — `91dd9c3`, fixes through `8f24ada` | Deterministic representative, exact case, negative controls, authentication/origin, bounded diagnostics, and Harris bucket requests; LP108–LP108.12. | LP108, LP108.9, and LP108.11 suites. Requires deployed owner endpoint and credentials for real evidence. |
| Harris bounded runtime | **RESTORED AND VALIDATED** | `tools/lp108/harris-certified-lookup.mjs`, `harris-sidecar-core.mjs`, `sync-harris-sidecar.mjs` — final architecture `8f24ada` | Generates and verifies 256 independently hashed, source-bound bucket objects; resumable upload and downloaded-byte remote verification; LP108.12. | `tests/lp10811-harris-sidecar.test.mjs`. Requires the governed Harris package locally; remote commands require owner credentials. |

All of these implementations were merged via pull requests in the reachable history. No newer branch-only implementation exists in the available refs. Their present files match the authoritative merged descendants, so restoring an older blob would have regressed fixes.

## 3. Files restored or changed

No source, test, manifest, generated package, runtime artifact, or package script required restoration: the current branch already contains the most complete validated merged toolchain. LP111 adds only this execution-baseline document. It intentionally does not track reports, `.artifacts`, FileGDB data, credentials, statewide output, or temporary extraction files.

## 4. Superseded implementations intentionally excluded

* The original LP104.4 ogr2ogr argument sequence was superseded by `b2f6b89`.
* The original LP105 geometry aggregate was superseded by the FileGDB `Shape` correction in `7e56624`.
* Metadata/listing-only Storage conclusions were superseded by downloaded-byte size and SHA-256 verification through LP108.1–LP108.3.
* Legacy-only Supabase authentication was superseded by modern secret handling in `e46e81b` and the shared final handling in `709ad3f`.
* Full Harris artifact scanning, the combined 65 MB Harris sidecar container, and its pre-bucket upload path were superseded by the 256 independent objects in `8f24ada`.
* Liberty-only and pre-multi-county runtime assumptions were not restored over LP104.7 and the current 28-county identity boundary.

These exclusions preserve exact house-number matching, canonical-road matching, city/ZIP and FIPS containment, no interpolation, no nearby-number substitution, no road-only residential promotion, and fail-closed outcomes.

## 5. Current 28-county production baseline

The canonical manifest contains 254 unique Texas FIPS codes and exactly 28 entries marked `initial28`. The tracked current baseline contains 28 governed packages, sidecars, and runtime certificates. Validation found all 28 ready without modifying any gzip and confirmed 56 unique private Storage object paths. LP111 does not rebuild, overwrite, activate, or alter any member of this cohort.

Protected Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, and address acceptance runtime files were untouched. The LP104.7/LP108 regression contracts confirm the governed cohort, county/FIPS conflict rejection, exact house and canonical-road requirements, negative controls, and fail-closed behavior remain unchanged.

## 6. Statewide manufacturing capability

| Capability | Status |
|---|---|
| 254-county canonical inventory and selective/all-Texas source inspection | **READY** |
| Selective FIPS, current-28, and all-254 deterministic package build | **READY** |
| Resume/checkpoint and deterministic package-manifest contracts | **RESTORED AND VALIDATED** |
| Exact package query and strict local package certification | **RESTORED AND VALIDATED** |
| Initial-28 orchestrated manufacture, runtime certificates, Storage plan/verification, and remote certification | **RESTORED AND VALIDATED** |
| Harris 256-bucket local generation/verification and remote downloaded-byte verification | **RESTORED AND VALIDATED** |
| Real statewide aggregate inventory | **REQUIRES OWNER SOURCE DATA** |
| TxGIO redistribution/derivative/browser/residential authorization | **STATEWIDE BUILD BLOCKER** |
| Expansion cohort flowing through LP105.1/LP107/LP108/runtime identities | **REQUIRES PARAMETERIZATION** |
| Urban outlier measurement and decision on bounded bucket treatment | **STATEWIDE BUILD BLOCKER** |
| Authenticated Storage/upload and deployed remote certification evidence | **REQUIRES OWNER SOURCE DATA** |

The manufacturing foundation is ready for a safe inventory and selective pilot. It is **not ready for a 254-county production build, activation, upload, or cutover**.

## 7. Missing prerequisites and owner-controlled paths

The default owner paths are:

* TxGIO FileGDB: `C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb`
* QGIS/GDAL binaries: `C:\Program Files\QGIS 3.44.11\bin`
* Repository checkout: owner-selected; commands below assume its root.
* Remote-only later steps: owner Supabase project URL, supported secret/service-role credential, private `gridly-runtime` bucket access, deployed function URL, and approved certification origin.

The checked-in license decision remains `UNRESOLVED_FAIL_CLOSED`; all redistribution, derivative-package, browser-delivery, residential-address, attribution, retention, evidence, reviewer, and review-date fields must be affirmatively governed before package manufacture. Inventory does not waive that gate.

## 8. Safe next execution step and exact commands

The first safe action is aggregate-only inventory, not package generation. From PowerShell at the repository root:

```powershell
$Repo = "C:\GitHub\liberty-county-map"
$Gdb = "C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb"
$Gdal = "C:\Program Files\QGIS 3.44.11\bin"
Set-Location $Repo
node .\tools\lp105\inventory-txgio-statewide.mjs --all-texas --resume --concurrency 1 --gdb $Gdb --gdal $Gdal --reports .\reports\lp111 --name lp111-texas-statewide-inventory
```

Review the checkpoint and summary before any build:

```powershell
Get-Content .\reports\lp111\lp111-texas-statewide-inventory.checkpoint.json -Raw | ConvertFrom-Json | Select-Object schemaVersion, startedAt, @{Name='CountyRows';Expression={$_.counties.Count}}
Get-ChildItem .\reports\lp111\lp111-texas-statewide-inventory* | Select-Object Name, Length, LastWriteTime
```

If the owner wants a smaller extraction-free smoke pilot first, run selected FIPS into a separate report namespace:

```powershell
node .\tools\lp105\inventory-txgio-statewide.mjs --fips 48291,48001,48453 --resume --concurrency 1 --gdb $Gdb --gdal $Gdal --reports .\reports\lp111-pilot --name lp111-three-county-inventory
```

Do not run `build-txgio-address-packages.mjs --all-texas`, authenticated uploads, identity expansion, or deployments until license authorization, inventory review, pilot selection, disk budget, and owner approval are recorded.

## 9. Validation result

The consolidated LP104.4/LP104.6/LP104.7/LP105/LP105.1/LP107/LP108/LP108.9/LP108.11 suite passed **152/152** tests with zero failures, skips, cancellations, or todos. It directly covered 254 unique FIPS, selective manufacturing selection, deterministic packages, unchanged 28-county governance, runtime certificate integrity, credential-free Storage planning contracts, downloaded-byte verification, strict acceptance and negative behavior, 256 deterministic Harris buckets, bounded streaming, corruption/source mismatch rejection, and protected runtime invariants.

A direct credential-free `--plan` completed against the 28-county local baseline. It planned the expected 56 objects and made no remote request or repository change. Git diff remained limited to this LP111 document.

## 10. Risks and rollback

* **Authorization risk:** stop closed while `data/lp105/txgio-license-decision.json` is unresolved.
* **Source/version risk:** retain the FileGDB identity and checkpoint; resume refuses source changes. Use a new report name or explicitly reviewed `--force`, never merge incompatible evidence.
* **Capacity/runtime risk:** measure rural, suburban, urban, and Harris profiles before manufacture. Reuse the proven bucket pattern only for measured outliers.
* **Cohort risk:** package build does not authorize runtime activation. Expansion requires a separately reviewed cohort parameterization with original-28 parity tests.
* **Replacement risk:** never use replacement upload flags against the certified 28 during expansion. Matching objects are skipped; mismatches must remain closed pending review.
* **Privacy risk:** keep reports aggregate-only and exclude source paths, address rows, credentials, signed URLs, and raw response bodies.

Rollback for LP111 is `git revert` of the LP111 documentation commit. No runtime or artifact rollback is needed. For a later pilot, retain the prior Edge identity deployment and all verified current objects; remove only a failing new county from the approved cohort, redeploy the previous identity set, and preserve evidence. Never delete or overwrite the current 28 packages as part of statewide expansion.

## 11. Merge recommendation

**Merge LP111.** It is a documentation-only, validated consolidation of the already merged manufacturing investment and establishes an owner-executable inventory gate. **Do not authorize statewide manufacture or cutover from this merge alone.** The next approval is limited to the aggregate inventory command above; the license, urban-profile, and cohort-parameterization blockers remain explicit.
