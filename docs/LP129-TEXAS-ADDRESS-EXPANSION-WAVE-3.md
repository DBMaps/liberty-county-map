# LP129 — Texas Address Expansion Wave 3 Final Reconciliation

## Decision

**Candidate manufacturing is complete; merge is recommended as candidate-only evidence.** Owner manufacturing commit `7c558757` adds Burleson, Trinity, and Victoria packages. This reconciliation audited only committed outputs: it did not access the owner workspace, mount the source, or rerun manufacturing. It does not activate any package or change production behavior.

## Source and manufactured results

The owner used the verified **TxGIO 2026 Statewide Address Points** source at owner-relative path `Texas-Address-Points/Raw/Texas-2026.gdb` (LP127B inventory: 126 logical components, 1,715,018,101 bytes, 12,142,647 statewide records; EPSG:3857 input and EPSG:4326 output). The original source is not committed.

| County | FIPS | Source records | Accepted | Rejected | Duplicates | Compressed bytes | Package SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---|
| Burleson | 48051 | 17,790 | 17,790 | 0 | 0 | 596,519 | `d8db4098133e23444aeef498faa0df281843660ef79262a0d397db4ab6d935bb` |
| Trinity | 48455 | 13,792 | 13,750 | 0 | 42 | 499,106 | `c75007278d50c9d064b666eb012d9b7f2d50bde1c1ef026072546cb92f321f62` |
| Victoria | 48469 | 46,129 | 45,991 | 0 | 138 | 1,326,361 | `3bea2448d541dbcd06e37857ae4259d53995b1e6c10645342e57b7c6608bc711` |
| **Total** | — | **77,711** | **77,531** | **0** | **180** | **2,421,986** | — |

Node-based streaming validation completely decompressed every gzip, parsed every non-empty JSONL line, and confirmed every record's county name and five-digit FIPS. Filenames, sizes, counts, and hashes agree across package bytes, sidecars, runtime certificates, LP104.6 certification reports, the selected-cohort manufacturing report, the aggregate address manifest, and the inactive candidate runtime manifest. All certifications pass and the manufacturing report records three successes and zero failures.

## Manifest reconciliation

The main address manifest advanced from the 31-package baseline by exactly three packages to **34**. All 34 FIPS values are unique and all 34 package basenames are unique. The LP129 candidate manifest contains exactly the three governed counties and remains `activated: false`. The production runtime manifest remains byte-for-byte at SHA-256 `9680601f4ecbdcd51f54523ec4b09e6757dc2dfb33a9520e4da0222c4a35963a`.

## Determinism

The first committed hashes supplied by the owner exactly match recalculation from the committed bytes (case-insensitively) and every governed metadata surface. A distinct second-run artifact set was not committed, so byte-identical rerun evidence is **pending**, not falsely claimed as a failure or success.

The focused comparator makes that remaining owner check deterministic:

```bash
npm run reconcile:lp129:rerun -- \
  --first <first-run-package-directory> \
  --second <rerun-package-directory>
```

It compares only the governed package filename, compressed byte count, and SHA-256. It deliberately ignores `generatedAt`, report and certificate timestamps, absolute local paths, and all other operational metadata; timestamp-only and path-only differences are therefore not failures. A successful run prints three JSON rows with `"identical":true` and exits zero. The owner must retain that output as rerun evidence; the rerun must not overwrite the committed candidates.

## Validation and evidence

Machine-readable reconciliation evidence is in `evidence/lp129/texas-address-expansion-wave-3-preflight.json` (the stable historical filename is retained while its schema and status now describe completion). `npm run test:lp129` independently validates gzip integrity, complete JSONL parsing, governed identity, record counts, sizes, hashes, every agreement surface, manifest totals and uniqueness, inactive status, and the unchanged production boundary. Compatibility checks cover LP128 and the relevant LP104.4, LP104.6, and LP105.1 tooling.

## Protected boundary

LP129 is candidate-only. There was no runtime activation, Storage upload, Supabase change, deployment, candidate approval, or production authorization. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, address matching behavior, certified runtime selection, Storage objects, Edge Functions, and the production runtime manifest were not modified. Candidate packages are not runtime eligible.

## Merge and owner handoff

**Merge as candidate-only evidence** after CI confirms the focused checks. Production promotion requires a separate explicitly authorized milestone. To remove this reconciliation, revert `Finalize LP129 address expansion evidence`; to remove the unactivated package cohort as well, separately revert owner manufacturing commit `7c558757` after reverting the reconciliation. Do not manually edit individual manifest rows and do not treat rollback or merge as activation authority.
