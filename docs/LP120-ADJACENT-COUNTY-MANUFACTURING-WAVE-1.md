# LP120 — Adjacent County Manufacturing Wave 1

## Scope and safety result

The owner completed the LP120 rerun for Lee (48287), Milam (48331), and Robertson (48395) Counties with the authentic TxGIO 2026 statewide geodatabase and official TIGER 2025 county roadway ZIP files. This reconciliation audits the owner-generated outputs retained locally under `reports/lp120-wave-1-owner-rerun/`; it does not rerun manufacturing.

The results remain candidate-only. The rerun performed no upload, Supabase mutation, deployment, activation, promotion, selector expansion, production manifest/package replacement, or production authorization. Governed outcomes are committed in `evidence/lp120/adjacent-county-manufacturing-wave-1-readiness.json`; bulky working reports and source archives remain local and uncommitted.

## Authentic owner-rerun source result

| Source family | Result | Evidence and classification |
| --- | --- | --- |
| TxGIO addresses | `GENERATED` | The authentic TxGIO 2026 statewide geodatabase generated each county address package and sidecar; each address certification passed and each candidate runtime certificate was generated. |
| FRA crossings | `PASS` | The existing authentic results are preserved: Lee 47, Milam 110, and Robertson 169; every county certification passed. |
| TIGER 2025 county roads | `GENERATED` | The official county roadway ZIP generated each TIGER roadway source, candidate package, manifest, and candidate roadway runtime identity; every roadway certification passed. |
| County boundary | `PASS` | Each FIPS matched exactly one county boundary and retained its inactive candidate. |
| ZIP coverage | `PASS` | Existing county ZIP relationships and split-county ambiguity were preserved. |

## Independent county results

| County | Addresses | Crossings | Roadways | Human gates | Overall readiness |
| --- | --- | ---: | --- | --- | --- |
| Lee (48287) | package `GENERATED`; sidecar `GENERATED`; certification `PASS`; runtime certificate `GENERATED` | 47 (`PASS`) | source/package/manifest/runtime identity `GENERATED`; certification `PASS` | `REVIEW_REQUIRED` | `REVIEW_REQUIRED`; not approved; not production-ready |
| Milam (48331) | package `GENERATED`; sidecar `GENERATED`; certification `PASS`; runtime certificate `GENERATED` | 110 (`PASS`) | source/package/manifest/runtime identity `GENERATED`; certification `PASS` | `REVIEW_REQUIRED` | `REVIEW_REQUIRED`; not approved; not production-ready |
| Robertson (48395) | package `GENERATED`; sidecar `GENERATED`; certification `PASS`; runtime certificate `GENERATED` | 169 (`PASS`) | source/package/manifest/runtime identity `GENERATED`; certification `PASS` | `REVIEW_REQUIRED` | `REVIEW_REQUIRED`; not approved; not production-ready |

For every address and roadway candidate, production authorization is `false` and activation is `false`. The technical-source blockers are closed; no county remains blocked by a missing source.

## Remaining governance and merge decision

Community/locality, curated destinations, and search coverage remain `REVIEW_REQUIRED`. Candidate approval has not been granted, and production authorization has not been granted. These human gates are the sole reason every county remains not approved and not production-ready.

This reconciliation may merge as governed candidate evidence. It is not a merge-to-production recommendation: promotion and activation require a later, separately authorized milestone after all named human reviewers close their gates. Production remains unchanged.
