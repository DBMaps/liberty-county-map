# LP128 — Texas Address Expansion Wave 2 Final Reconciliation

## Decision and mission

**Manufacturing succeeded. Merge is recommended as candidate-only evidence.** LP128 adds audited address candidates for Lee, Milam, and Robertson while preserving Gridly's order of operations: **Awareness Platform First, Route Intelligence Second**, and **Audit First, Patch Second**. This reconciliation neither activates runtime data nor changes production behavior.

## Initial blocker reconciliation

The initial Codex preflight truthfully reported that its isolated container could not access the owner-controlled TxGIO file geodatabase. That was an environment limitation, not a source or manufacturing failure. The owner subsequently ran the existing manufacturing workflow locally from the verified source, performed two runs, and committed the packages and operational reports in manufacturing commit `466878abf931d156786e4ae68ee00bf7c4da657c`. Codex then audited those committed artifacts without mounting the source, rerunning extraction, or manufacturing again.

The completed state supersedes the blocker-era outcome: there are three packages, three sidecars, three runtime certificates, three certification reports, one selected-cohort manufacturing report, and one candidate runtime manifest. The governed sequence remains recorded in `evidence/lp128/texas-address-expansion-wave-2-preflight.json`.

## Authoritative source identity

The authoritative input was **TxGIO 2026 Statewide Address Points**, owner-relative path `Texas-Address-Points/Raw/Texas-2026.gdb`. LP127B inventoried it as a 126-component logical geodatabase totaling 1,715,018,101 bytes. Its directory components did not have a fabricated aggregate hash. The package aggregate manifest records 12,142,647 statewide source records, source CRS EPSG:3857, and output CRS EPSG:4326. No geodatabase component or original source-data byte was copied into this repository by LP128.

## Manufactured county results

| County | FIPS | Source read | Accepted | Rejected | Duplicates | Package bytes | Package SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---|
| Lee | 48287 | 11,096 | 11,030 | 0 | 66 | 370,322 | `2bd75bece2db6308e433efe3d734333894dbd62bad04b9223acc26d29615ec53` |
| Milam | 48331 | 10,992 | 10,992 | 0 | 0 | 375,753 | `eff1e9f78ce0f32c425f3ec7ac687a16589c9403626cfbef3041b55e24157fd0` |
| Robertson | 48395 | 11,846 | 11,846 | 0 | 0 | 401,846 | `dbed5f383863fbf4f52dfd98657af8edfd7416943c6e5b1b9b179b36aea8c1e6` |
| **Total** | — | **33,934** | **33,868** | **0** | **66** | **1,147,921** | — |

All gzip streams open, every non-empty JSONL line parses, all records retain the intended county FIPS, record totals match accepted counts, byte sizes and SHA-256 values match sidecars, and all sidecar counts reconcile. The aggregate address manifest contains all three county entries alongside previously governed packages.

## Governed artifacts

County packages and sidecars:

- `data/generated/lp104/txgio-addresses/lee-48287.addresses.jsonl.gz` and `.json`
- `data/generated/lp104/txgio-addresses/milam-48331.addresses.jsonl.gz` and `.json`
- `data/generated/lp104/txgio-addresses/robertson-48395.addresses.jsonl.gz` and `.json`
- aggregate `data/generated/lp104/txgio-addresses/manifest.json`

Runtime certificates:

- `reports/lp128-wave-2/certificates/lee-48287.runtime-certificate.json`
- `reports/lp128-wave-2/certificates/milam-48331.runtime-certificate.json`
- `reports/lp128-wave-2/certificates/robertson-48395.runtime-certificate.json`

Certification reports:

- `reports/lp128-wave-2/certification/lee-48287.certification.json`
- `reports/lp128-wave-2/certification/milam-48331.certification.json`
- `reports/lp128-wave-2/certification/robertson-48395.certification.json`

Each runtime certificate binds county identity, package size, and SHA-256. Each LP1046 certification report binds the same package, reports the accepted indexed-address count, and has certification status `PASS`. The selected-cohort manufacturing report records three completions, three successes, zero failures, and `activated: false`.

## Candidate manifest and deterministic rerun

`reports/lp128-wave-2/runtime-manifest.candidate.json` contains exactly Lee (48287), Milam (48331), and Robertson (48395), points to their three runtime certificates, and remains `activated: false`. It is an operational candidate artifact, not the production runtime manifest.

The owner performed two local manufacturing runs. The governed package rows in `lp128-run-1-hashes.csv` and `lp128-run-2-hashes.csv` match in filename, byte count, and SHA-256 for every county: **Lee BYTE IDENTICAL; Milam BYTE IDENTICAL; Robertson BYTE IDENTICAL**. The second-run decompressed hashes were also retained. Timestamp fields, generated-at values, certificate/report timestamps, and owner-local paths are operational metadata and are deliberately excluded from the governed package determinism comparison.

## Tests and audit scope

`npm run test:lp128` validates the exact cohort, files, gzip/JSONL integrity, county identity, counts, byte sizes, hashes, sidecars, aggregate manifest entries, certificates, certification reports, candidate manifest, manufacturing report, deterministic run comparison, totals, and candidate/production protections. The focused compatibility command covers the LP1044 builder, LP1046 certification, LP1051 orchestrator, LP120 wave-one evidence, LP127B reconciliation (where available), and LP128 reconciliation without running the legacy suite.

The manufacturing-commit audit found that LP128 introduced no temporary `.records` file, no Burleson, Trinity, Victoria, or unrelated Grimes output, and no `.gdb` or copied original TxGIO dataset. A zero-byte Liberty temporary record file predates LP128 (commit `3bc3611`) and is outside this reconciliation's authorized scope; LP128 neither created nor modified it. The only LP128 manufacturing outputs are the intended three-county cohort and its reports.

## Protected systems and production boundary

LP128 does not modify Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, runtime behavior, search behavior, address matching, county selection, production runtime manifests, deployment configuration, or Storage configuration. No Storage upload, deployment, runtime activation, candidate approval, or production authorization occurred. `candidateApproval`, `productionAuthorization`, and `runtimeEligible` remain false in governed evidence.

## Risks

- The source is owner-controlled and was unavailable inside the reconciliation container, so Codex audited committed outputs rather than repeating extraction.
- The source geodatabase has no aggregate directory hash; its identity rests on the governed LP127B logical inventory and manifest metadata.
- Sidecars and operational reports retain owner-local Windows paths. Those paths are provenance metadata and are not portable runtime paths.
- Candidate certification is not production approval. Human review and a separately authorized promotion remain required before any runtime use.

These risks do not invalidate the byte-identical packages, their content validation, or their candidate certificates, but they prohibit treating this reconciliation as activation authority.

## Rollback and merge recommendation

Merge the single follow-up reconciliation commit after focused tests pass. To roll back the reconciliation only, revert `Finalize LP128 address expansion evidence`; this removes the LP128 report, machine-readable reconciliation evidence, test, and npm test entry without rewriting the already committed package binaries. To remove the full unactivated candidate cohort, separately revert manufacturing commit `466878abf931d156786e4ae68ee00bf7c4da657c` after the reconciliation revert. Do not delete individual manifest rows or binary files manually, and do not use rollback as authorization to alter any production manifest.

The merge recommendation is **MERGE AS CANDIDATE-ONLY EVIDENCE**. Production promotion remains a separate, explicitly authorized milestone.
